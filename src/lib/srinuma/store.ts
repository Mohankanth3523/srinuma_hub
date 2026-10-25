import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';

type RecordRow = Record<string,string>;
type Token = { value:string; until:number };
let tokenCache:Token|null=null;
const ID_PREFIX:Record<string,string>={Leads:'LED',Employees:'EMPID',Works:'WRK',Quotations:'QUO',Invoices:'INV',Files:'FIL',AuditLog:'AUD',Payments:'PAY'};
const ALLOWED = ['Leads','Employees','Works','Quotations','QuotationItems','Invoices','InvoiceItems','Packages','PackageFeatures','ExtraFeatures','Files','Settings','AuditLog','Payments'] as const;
export type Tab = typeof ALLOWED[number];
import { randomUUID } from 'node:crypto';
import { authRedis } from './auth-redis';
// Cross-process Redis lock for Google Sheets read+ID+append sequences.
// All writers MUST continue to call withLock(table, ...); do not bypass for IDs.
export async function withLock<T>(name:string,fn:()=>Promise<T>):Promise<T>{
 const lockKey='srinuma:sheets:lock:'+name;
 const token=randomUUID();
 const client=authRedis();
 let acquired=false;
 for(let attempt=0;attempt<75;attempt++){
  const ok=await client.set(lockKey,token,{nx:true,px:180000});
  if(ok==='OK'){acquired=true;break;}
  await new Promise<void>(r=>setTimeout(r,120+Math.floor(Math.random()*80)));
 }
 if(!acquired)throw Error('This Google Sheet is busy. Please retry after checking the existing record.');
 const renew=`if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('PEXPIRE',KEYS[1],ARGV[2]) else return 0 end`;
 const unlock=`if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end`;
 let lost=false;let renewing=false;
 const heartbeat=setInterval(()=>{if(renewing)return;renewing=true;void client.eval(renew,[lockKey],[token,'180000']).then(v=>{if(Number(v)!==1)lost=true;}).catch(()=>{lost=true;}).finally(()=>{renewing=false;});},30000);
 try{
  const result=await fn();
  if(lost)throw Error('Sheet lock lost during save. Check the record before retrying.');
  return result;
 }finally{
  clearInterval(heartbeat);
  try{await client.eval(unlock,[lockKey],[token]);}catch(e){console.error('Sheet lock release failed',e);}
 }
}
function cfg(){
 const spreadsheet=process.env.SRINUMA_SHEET_ID;
 const path=process.env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH;
 if(!spreadsheet||(!path&&!process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64))throw Error('Sheet ID or service-account path not configured');
 const sa=JSON.parse((process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 ? Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64,'base64').toString('utf8') : readFileSync(path!,'utf8'))) as {client_email:string;private_key:string;token_uri?:string};
 if(!sa.client_email||!sa.private_key)throw Error('Invalid service-account JSON');
 if(sa.token_uri && sa.token_uri!=='https://oauth2.googleapis.com/token')throw Error('Unrecognized OAuth endpoint');
 return {spreadsheet,sa};
}
const b64=(s:string)=>Buffer.from(s).toString('base64url');
export async function token(force=false){
 if(!force&&tokenCache&&tokenCache.until-Date.now()>60000)return tokenCache.value;
 const {sa}=cfg(), now=Math.floor(Date.now()/1000);
 const scope='https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive';
 const payload=`${b64(JSON.stringify({alg:'RS256',typ:'JWT'}))}.${b64(JSON.stringify({iss:sa.client_email,scope,aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3500}))}`;
 const sig=createSign('RSA-SHA256').update(payload).end().sign(sa.private_key).toString('base64url');
 const res=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:`${payload}.${sig}`}),cache:'no-store'});
 if(!res.ok)throw Error(`Google service-account authentication failed: HTTP ${res.status}`);
 const data=await res.json() as {access_token:string;expires_in:number};
 tokenCache={value:data.access_token,until:Date.now()+(data.expires_in||3600)*1000};return data.access_token;
}
export async function gfetch(url:string, init:RequestInit={},retry=true):Promise<Record<string,unknown>>{
 const t=await token();const r=await fetch(url,{...init,headers:{...init.headers,Authorization:`Bearer ${t}`},cache:'no-store'});
 if(r.status===401&&retry){tokenCache=null;await token(true);return gfetch(url,init,false);}
 if(!r.ok){let error='';try{const d=await r.json() as {error?:{message?:string}};error=d.error?.message||'';}catch{}throw Error(`Google API ${r.status}: ${error.slice(0,180)}`);}
 return r.json() as Promise<Record<string,unknown>>;
}
function endpoint(tab:Tab, range='A1:Z10000'){
 if(!ALLOWED.includes(tab))throw Error('Invalid table');
 return `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(cfg().spreadsheet)}/values/${encodeURIComponent(`'${tab}'!${range}`)}`;
}
const val=(x:unknown)=>String(x??'');
export async function rows(tab:Tab):Promise<{header:string[];items:RecordRow[];numbers:number[]}>{
 const resp=await gfetch(endpoint(tab)) as {values?:unknown[][]};
 const [hdr=[],...data]=resp.values||[];const header=hdr.map(val);if(!header.length)throw Error(`${tab} table has no headers`);
 const items:RecordRow[]=[],numbers:number[]=[];
 data.forEach((r,i)=>{if(!r.some(x=>val(x).trim()))return;const rec:RecordRow={};header.forEach((k,j)=>rec[k]=val(r[j]));items.push(rec);numbers.push(i+2);});
 return {header,items,numbers};
}
export async function append(tab:Tab,data:RecordRow):Promise<RecordRow>{
 const {header}=await rows(tab);const values=header.map(key=>val(data[key]));
 await gfetch(endpoint(tab,'A1:Z10000')+':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({values:[values]})});return data;
}
// Write related child rows in one Google Sheets append request instead of one request per item.
// Uses the live header so existing spreadsheet column order is preserved.
export async function appendMany(tab:Tab,data:RecordRow[]):Promise<void>{
 if(data.length===0)return;
 const {header}=await rows(tab);
 const values=data.map(record=>header.map(key=>val(record[key])));
 await gfetch(endpoint(tab,'A1:Z10000')+':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS',{
  method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({values})
 });
}
export async function replace(tab:Tab,idField:string,id:string,changes:RecordRow):Promise<RecordRow>{
 const {header,items,numbers}=await rows(tab);const matches=items.map((r,i)=>r[idField]===id?i:-1).filter(i=>i>=0);if(matches.length===0)throw Error(`${tab} record not found`);if(matches.length>1)throw Error(`Duplicate ${tab} ${idField}: ${id}. No record changed; resolve duplicates in the Google Sheet first.`);const index=matches[0];
 const updated={...items[index],...changes};const last=String.fromCharCode(64+header.length);
 await gfetch(endpoint(tab,`A${numbers[index]}:${last}${numbers[index]}`)+'?valueInputOption=RAW',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({values:[header.map(k=>val(updated[k]))]})});return updated;
}
export async function upsertSetting(key:string,value:string){
 return withLock('Settings',async()=>{
 const existing=await rows('Settings');const found=existing.items.find(x=>x.setting_key===key);
 const changes={setting_key:key,setting_value:value,updated_at:new Date().toISOString(),note:found?.note||''};
 if(found)return replace('Settings','setting_key',key,changes);return append('Settings',changes);
 });
}
export async function nextId(tab:Tab){
 const prefix=ID_PREFIX[tab];if(!prefix)throw Error('No sequence configured');
 const list=(await rows(tab)).items;const field:{[key:string]:string}={Leads:'lead_id',Employees:'employee_id',Works:'work_id',Quotations:'quotation_id',Invoices:'invoice_id',Files:'file_id',AuditLog:'audit_id',Payments:'payment_id'};
 const regex=new RegExp(`^${prefix}(\\d+)$`,'i');const high=list.reduce((n,r)=>Math.max(n,Number(r[field[tab]]?.match(regex)?.[1]||0)),0);
 return `${prefix}${String(high+1).padStart(3,'0')}`;
}
export async function audit(actor:string,action:string,entity:string,id:string){
 try{await withLock('AuditLog',async()=>append('AuditLog',{audit_id:await nextId('AuditLog'),timestamp:new Date().toISOString(),actor_user_id:actor,action,entity_type:entity,entity_id:id,details:''}));}catch(e){console.error('SRINUMA audit write failed:',e);}
}
export function now(){return new Date().toISOString();}
