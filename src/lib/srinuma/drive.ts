// SRINUMA HUB Drive: personal Gmail OAuth (drive.file scope), with existing shared-drive
// service-account fallback. No OAuth credentials ever sent to the browser.
import { token } from './store';
let cached:{value:string;until:number}|null=null;
export function usingOwnerOAuth(){return Boolean(process.env.SRINUMA_DRIVE_OAUTH_CLIENT_ID&&process.env.SRINUMA_DRIVE_OAUTH_CLIENT_SECRET&&process.env.SRINUMA_DRIVE_OAUTH_REFRESH_TOKEN);}
export async function driveToken(force=false):Promise<string>{
 if(!usingOwnerOAuth())return token(force);
 if(!force&&cached&&cached.until-Date.now()>60000)return cached.value;
 const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:process.env.SRINUMA_DRIVE_OAUTH_CLIENT_ID||'',client_secret:process.env.SRINUMA_DRIVE_OAUTH_CLIENT_SECRET||'',refresh_token:process.env.SRINUMA_DRIVE_OAUTH_REFRESH_TOKEN||'',grant_type:'refresh_token'}),cache:'no-store'});
 if(!response.ok)throw Error(`Drive authorization expired or failed (HTTP ${response.status}). Re-run node scripts\\connect-srinuma-drive.cjs`);
 const result=await response.json() as {access_token?:string;expires_in?:number};if(!result.access_token)throw Error('Drive OAuth returned no access token');
 cached={value:result.access_token,until:Date.now()+(result.expires_in||3600)*1000};return cached.value;
}
export async function driveFetch(url:string,init:RequestInit={},retry=true):Promise<Record<string,unknown>>{
 const access=await driveToken(),res=await fetch(url,{...init,headers:{...init.headers,Authorization:`Bearer ${access}`},cache:'no-store'});
 if(res.status===401&&retry){await driveToken(true);return driveFetch(url,init,false);}
 if(!res.ok){let detail='';try{const parsed=await res.json() as {error?:{message?:string}};detail=parsed.error?.message||'';}catch{}
  if(res.status===403&&/quota|storage/i.test(detail))throw Error('Google Drive upload blocked: service accounts have no My Drive storage. Connect your Gmail with scripts\\connect-srinuma-drive.cjs');
  throw Error(`Google Drive HTTP ${res.status}: ${detail.slice(0,170)}`);
 }
 return res.json() as Promise<Record<string,unknown>>;
}
