import { NextRequest } from 'next/server';
import { auth, fail, success } from '@/lib/srinuma/api';
import { checkHash } from '@/lib/srinuma/security';
import { audit, rows, replace, upsertSetting, withLock } from '@/lib/srinuma/store';

type P={id:string;name:string;username:string;role:'admin'|'employee';email:string;phone:string;photo:string};
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern=/^\+?[0-9][0-9\s-]{6,18}$/;
const key=(id:string)=>'profile:photo:'+id;
const adminKey=(field:string)=>'profile:admin:'+field;
async function profile(user:{id:string;name:string;username:string;role:'admin'|'employee'}):Promise<P>{
 const all=(await rows('Settings')).items;
 const setting=(k:string)=>all.find(x=>x.setting_key===k)?.setting_value||'';
 if(user.role==='admin')return {id:user.id,name:setting(adminKey('name'))||user.name,username:user.username,role:'admin',email:setting(adminKey('email'))||process.env.SRINUMA_ADMIN_RECOVERY_EMAIL||'',phone:setting(adminKey('phone')),photo:setting(key(user.id))};
 const emp=(await rows('Employees')).items.find(x=>x.employee_id===user.id&&x.active.toLowerCase()==='true');
 if(!emp)throw Error('Employee account unavailable');
 return {id:emp.employee_id,name:emp.name,username:emp.username,role:'employee',email:emp.email||'',phone:emp.phone||'',photo:setting(key(user.id))};
}
export async function GET(req:NextRequest){try{const user=await auth(req);return success({profile:await profile(user)});}catch(e){return fail(e,401);}}
export async function PATCH(req:NextRequest){
 try{
  const user=await auth(req);
  const v=await req.json() as Record<string,unknown>;
  if('role' in v||'username' in v||'active' in v||'id' in v||'employee_id' in v)throw Error('Username, roles and access are admin-managed only');
  const name=String(v.name??'').trim(),email=String(v.email??'').trim().toLowerCase(),phone=String(v.phone??'').trim();
  if(name.length<2||name.length>120)throw Error('Name must contain 2–120 characters');
  if(!emailPattern.test(email)||email.length>254)throw Error('Enter a valid email address');
  if(phone&&!phonePattern.test(phone))throw Error('Enter a valid phone number');
  if(user.role==='admin'){
   // Contact email here does NOT silently alter the recovery email in .env.local.
   await upsertSetting(adminKey('name'),name);
   await upsertSetting(adminKey('email'),email);
   await upsertSetting(adminKey('phone'),phone);
  }else{
   await withLock('Employees',async()=>{
    const sheet=await rows('Employees');
    if(!sheet.header.includes('email')||!sheet.header.includes('phone'))throw Error('Employees Sheet needs lowercase email and phone headers');
    const existing=sheet.items.find(x=>x.employee_id===user.id&&x.active.toLowerCase()==='true');
    if(!existing)throw Error('Employee account unavailable');
    if(email!==existing.email?.toLowerCase()){
     if(typeof v.current_password!=='string'||!checkHash(v.current_password,existing.password_hash))throw Error('Current password required to change recovery email');
     if(sheet.items.some(x=>x.employee_id!==user.id&&(x.email||'').trim().toLowerCase()===email))throw Error('Email already registered');
    }
    await replace('Employees','employee_id',user.id,{name,email,phone});
   });
  }
  await audit(user.id,'SELF_PROFILE','Profile',user.id);
  return success({profile:await profile(user)});
 }catch(e){return fail(e);}
}
// Compact, square JPEG generated client-side. Stored in private Google Sheets Settings tab.
// JPG marker + SOF dimensions are verified; do not accept SVG/HTML/remote image URLs.
function dimensions(buf:Buffer):[number,number]|null{
 if(buf.length<16||buf[0]!==0xff||buf[1]!==0xd8)return null;
 let i=2;
 while(i+4<buf.length){
  if(buf[i]!==0xff)return null;
  let marker=buf[++i];while(marker===0xff)marker=buf[++i];i++;
  if(marker===0xda||marker===0xd9)break;
  if(marker===0xd8||marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;
  const n=buf.readUInt16BE(i);if(n<2||i+n>buf.length)return null;
  if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){
   if(n<7)return null;
   return [buf.readUInt16BE(i+3),buf.readUInt16BE(i+5)];
  }
  i+=n;
 }
 return null;
}
export async function PUT(req:NextRequest){
 try{
  const user=await auth(req);
  const v=await req.json() as {photo?:unknown};
  if(typeof v.photo!=='string')throw Error('Invalid profile image');
  if(v.photo===''){
   await upsertSetting(key(user.id),'');
  }else{
   if(v.photo.length>42000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(v.photo))throw Error('Upload a JPEG profile photo under 30 KB');
   const img=Buffer.from(v.photo.slice('data:image/jpeg;base64,'.length),'base64');
   const dim=dimensions(img);
   if(img.length>30000||img.length<100||!dim||dim[0]!==dim[1]||dim[0]>512||dim[0]<64)throw Error('Profile photo must be square (1:1) and under 30 KB');
   await upsertSetting(key(user.id),v.photo);
  }
  await audit(user.id,'PROFILE_PHOTO','Profile',user.id);
  return success({profile:await profile(user)});
 }catch(e){return fail(e);}
}
