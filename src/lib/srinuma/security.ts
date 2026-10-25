import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { rows } from './store';
import { authRedis, revokedKey } from './auth-redis';
export type Actor={id:string;username:string;name:string;role:'admin'|'employee'};
const COOKIE='srinuma_secure_session',DURATION=30*24*60*60;
const RENEW_WINDOW=7*24*60*60;
function secret(){const v=process.env.SRINUMA_SESSION_SECRET||'';if(v.length<40)throw Error('Missing session secret');return v;}
function sign(v:string){return createHmac('sha256',secret()).update(v).digest('base64url');}
export function makeHash(password:string){const salt=randomBytes(16).toString('hex');const digest=scryptSync(password,Buffer.from(salt,'hex'),64).toString('hex');return `scrypt$${salt}$${digest}`;}
export function checkHash(password:string,hash:string){const [alg,salt,digest]=hash.split(hash.includes(':') ? ':' : '$');if(alg!=='scrypt'||!/^[a-f0-9]{32}$/i.test(salt||'')||!/^[a-f0-9]{128}$/i.test(digest||''))return false;const expected=Buffer.from(digest,'hex'),got=scryptSync(password,Buffer.from(salt,'hex'),64);return timingSafeEqual(got,expected);}
export async function checkAdminCredentials(username:string,password:string){
 if(username.trim().toLowerCase()!=='srinuma')return false;
 const saved=await authRedis().get<string>('srinuma:auth:admin:password_hash');
 return checkHash(password,saved||process.env.SRINUMA_ADMIN_PASSWORD_HASH||'');
}
export async function checkEmployeeCredentials(username:string,password:string):Promise<Actor|null>{const rec=(await rows('Employees')).items.find(x=>x.username.toLowerCase()===username.trim().toLowerCase()&&x.active.toLowerCase()==='true');if(!rec||!checkHash(password,rec.password_hash))return null;return {id:rec.employee_id,username:rec.username,name:rec.name,role:'employee'};}
export function createSession(actor:Actor){const p=Buffer.from(JSON.stringify({...actor,iat:Date.now(),exp:Math.floor(Date.now()/1000)+DURATION})).toString('base64url');return `${p}.${sign(p)}`;}
export async function currentUser():Promise<Actor|null>{const t=(await cookies()).get(COOKIE)?.value;if(!t||t.length>4096)return null;const [payload,sig,...extra]=t.split('.');if(!payload||!sig||extra.length)return null;const expected=Buffer.from(sign(payload)),got=Buffer.from(sig);if(expected.length!==got.length||!timingSafeEqual(expected,got))return null;
 try{const p=JSON.parse(Buffer.from(payload,'base64url').toString()) as Actor&{exp:number;iat?:number};if(p.exp<=Date.now()/1000)return null;
 const invalidatedAt=await authRedis().get<number>(revokedKey(p.id));
 if(invalidatedAt!==null && (!p.iat || p.iat<=Number(invalidatedAt)))return null;if(p.role==='admin'&&p.id==='srinuma')return {id:'srinuma',username:'srinuma',name:'Srinuma Admin',role:'admin'};
 if(p.role==='employee'){const emp=(await rows('Employees')).items.find(e=>e.employee_id===p.id);if(emp?.active.toLowerCase()==='true'&&emp.username===p.username)return {id:p.id,username:p.username,name:emp.name,role:'employee'};}
 }catch{}return null;}
export async function isAdmin(){return (await currentUser())?.role==='admin';}
export async function setLoginCookie(token:string){(await cookies()).set(COOKIE,token,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:DURATION});}
export async function clearLoginCookie(){(await cookies()).delete(COOKIE);}
export function sameOrigin(req:NextRequest){const origin=req.headers.get('origin');return !origin||origin===req.nextUrl.origin;}

export async function renewLoginIfNeeded(actor:Actor){const jar=await cookies();const token=jar.get(COOKIE)?.value;if(!token)return;try{const [payload]=token.split('.');const body=JSON.parse(Buffer.from(payload,'base64url').toString()) as {exp?:number};if(typeof body.exp==='number'&&body.exp-Date.now()/1000<RENEW_WINDOW)await setLoginCookie(createSession(actor));}catch{}}
