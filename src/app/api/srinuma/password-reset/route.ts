import { NextRequest } from 'next/server';
import { createHash, createHmac, randomInt } from 'node:crypto';
import nodemailer from 'nodemailer';
import { authRedis, revokedKey } from '@/lib/srinuma/auth-redis';
import { makeHash, sameOrigin } from '@/lib/srinuma/security';
import { rows, replace, withLock, audit } from '@/lib/srinuma/store';
import { fail, success } from '@/lib/srinuma/api';
const generic = 'If the account has a registered recovery email, a one-time code has been sent.';
const codeScript = `
local value=redis.call('GET', KEYS[1]); if not value then return -1 end
local n=string.find(value, ':'); if not n then redis.call('DEL',KEYS[1]); return -1 end
local attempts=tonumber(string.sub(value,1,n-1)); local saved=string.sub(value,n+1)
if attempts>=5 then redis.call('DEL',KEYS[1]); return -2 end
if saved==ARGV[1] then redis.call('DEL',KEYS[1]); return 1 end
attempts=attempts+1
if attempts>=5 then redis.call('DEL',KEYS[1]); return -2 end
redis.call('SET', KEYS[1], tostring(attempts)..':'..saved, 'KEEPTTL')
return 0`;

function hash(value:string){return createHash('sha256').update(value).digest('hex');}
function otpDigest(userId:string,code:string){
 const key=process.env.SRINUMA_OTP_SECRET || process.env.SRINUMA_SESSION_SECRET || '';
 if(key.length<40)throw Error('OTP secret must be at least 40 characters');
 return createHmac('sha256',key).update(`${userId}:${code}`).digest('hex');
}
async function account(username:string):Promise<{id:string;email:string;role:'admin'|'employee'}|null>{
 if(username==='srinuma'){
  const email=(process.env.SRINUMA_ADMIN_RECOVERY_EMAIL||'').trim().toLowerCase();
  return email?{id:'srinuma',email,role:'admin'}:null;
 }
 const user=(await rows('Employees')).items.find(x=>x.username.toLowerCase()===username&&x.active.toLowerCase()==='true');
 if(!user?.email)return null;
 return {id:user.employee_id,email:user.email.trim().toLowerCase(),role:'employee'};
}
async function sendCode(to:string,code:string){
 const user=process.env.SRINUMA_SMTP_USER||process.env.SMTP_USER||process.env.GMAIL_USER||'';
 const pass=process.env.SRINUMA_SMTP_APP_PASSWORD||process.env.SMTP_APP_PASSWORD||process.env.GMAIL_APP_PASSWORD||'';
 if(!user||!pass)throw Error('SMTP sender credentials not configured');
 const port=Number(process.env.SMTP_PORT||465);
 const transport=nodemailer.createTransport({
  host:process.env.SMTP_HOST||'smtp.gmail.com', port,
  secure:port===465,auth:{user,pass},
  connectionTimeout:12000,greetingTimeout:12000,socketTimeout:15000
 });
 await transport.sendMail({from:process.env.SRINUMA_MAIL_FROM||user,to,subject:'SRINUMA HUB — Password reset code',text:`Your SRINUMA HUB password reset code is ${code}. It expires in 10 minutes. If you did not request this, ignore this email.`});
 transport.close();
}
async function ipLimit(req:NextRequest){
 // The deployment proxy must sanitize client IP headers; account throttling is enforced separately.
 const ip=(req.headers.get('x-real-ip')||req.headers.get('x-forwarded-for')?.split(',')[0]||'unknown').slice(0,128);
 const key=`srinuma:pwdreset:ip:${hash(ip)}`;
 const redis=authRedis();const count=await redis.incr(key);
 if(count===1)await redis.expire(key,900);
 return count<=30;
}
export async function POST(req:NextRequest){
 if(!req.headers.get('origin')||!sameOrigin(req))return fail('Invalid request origin',403);
 try{
  const body=await req.json() as {action?:unknown;username?:unknown;otp?:unknown;newPassword?:unknown};
  const username=typeof body.username==='string'?body.username.trim().toLowerCase():'';
  if(!/^[a-z][a-z0-9._-]{2,40}$/.test(username))return fail('Enter a valid username',400);
  if(!await ipLimit(req))return fail('Too many requests. Try again later.',429);
  const redis=authRedis();
  if(body.action==='request'){
   const acct=await account(username);
   const limitKey=`srinuma:pwdreset:cooldown:${hash(username)}`;
   const permitted=await redis.set(limitKey,'1',{nx:true,ex:60});
   if(!permitted || !acct)return success({message:generic});
   const otp=String(randomInt(100000,1000000));
   const key=`srinuma:pwdreset:code:${acct.id}`;
   await redis.set(key,`0:${otpDigest(acct.id,otp)}`,{ex:600});
   try {await sendCode(acct.email,otp);}
   catch(e){await redis.del(key);console.error('SRINUMA password recovery email failed',e instanceof Error?e.message:'SMTP error');}
   return success({message:generic});
  }
  if(body.action==='reset'){
   if(typeof body.otp!=='string'||!/^[0-9]{6}$/.test(body.otp))return fail('Enter the 6-digit code',400);
   if(typeof body.newPassword!=='string'||body.newPassword.length<12||body.newPassword.length>200)return fail('Password must be 12–200 characters',400);
   const acct=await account(username);
   if(!acct)return fail('Invalid or expired code',400);
   const result=Number(await redis.eval(codeScript,[`srinuma:pwdreset:code:${acct.id}`],[otpDigest(acct.id,body.otp)]));
   if(result!==1)return fail('Invalid or expired code',400);
   const passwordHash=makeHash(body.newPassword);
   if(acct.role==='admin'){
    await redis.multi().set('srinuma:auth:admin:password_hash',passwordHash).set(revokedKey(acct.id),Date.now()).exec();
   }else{
    await withLock('Employees',async()=>{
     const user=(await rows('Employees')).items.find(x=>x.employee_id===acct.id && x.username.toLowerCase()===username && x.active.toLowerCase()==='true');
     if(!user)throw Error('Account unavailable');
     // Revoke already logged-in sessions before updating the credential.
     await redis.set(revokedKey(acct.id),Date.now());
     await replace('Employees','employee_id',acct.id,{password_hash:passwordHash});
    });
    await audit(acct.id,'RESET_PASSWORD','Employees',acct.id);
   }
   return success({message:'Password reset successful. Sign in with your new password.'});
  }
  return fail('Invalid recovery action',400);
 }catch(e){console.error('SRINUMA password reset failed',e instanceof Error?e.message:'Recovery error');return fail('Password recovery is currently unavailable',503);}
}
