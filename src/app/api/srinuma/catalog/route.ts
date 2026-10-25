import { NextRequest } from 'next/server';
import { auth,success,fail,s,amount } from '@/lib/srinuma/api';
import { rows,replace,withLock,audit } from '@/lib/srinuma/store';
async function updateUnique(tab:'Packages'|'PackageFeatures'|'ExtraFeatures',field:'package_id'|'feature_id',id:string,changes:Record<string,string>){
 return withLock(tab,async()=>{
  const found=(await rows(tab)).items.filter(r=>r[field]===id);
  if(found.length!==1)throw Error(found.length>1?`Duplicate ${tab} ID in Google Sheets; resolve duplicates before editing.`:`${tab} record not found`);
  return replace(tab,field,id,changes);
 });
}

export async function GET(req:NextRequest){try{await auth(req,true);const [packages,features,extras]=await Promise.all([rows('Packages'),rows('PackageFeatures'),rows('ExtraFeatures')]);return success({packages:packages.items.filter(x=>x.active.toLowerCase()!=='false'),features:features.items,extras:extras.items.filter(x=>x.active.toLowerCase()!=='false')});}catch(e){return fail(e,401);}}
export async function PATCH(req:NextRequest){try{const actor=await auth(req,true),data=await req.json() as Record<string,unknown>,kind=s(data.kind,30),id=s(data.id,100);
 if(!id)throw Error('Item ID required');
 if(kind==='package'){
  const v=amount(data.price),r=await updateUnique('Packages','package_id',id,{base_price_inr:String(v),price_status:'ADMIN_CONFIRMED'});await audit(actor.id,'PRICE','Packages',id);return success({item:r});
 }
 if(kind==='extra'){
  const v=amount(data.price),r=await updateUnique('ExtraFeatures','feature_id',id,{suggested_price_inr:String(v),price_status:'ADMIN_CONFIRMED'});await audit(actor.id,'PRICE','ExtraFeatures',id);return success({item:r});
 }
 // SRINUMA SETTINGS CONTROL CENTER V1: admin-only, editable package inclusion description.
 if(kind==='feature'){
  const description=s(data.description,240).trim();
  if(description.length<3||description.length>240)throw Error('Package feature description must be 3–240 characters');
  const r=await updateUnique('PackageFeatures','feature_id',id,{feature_description:description});
  await audit(actor.id,'FEATURE','PackageFeatures',id);return success({item:r});
 }
 throw Error('Unsupported catalog update');
 }catch(e){return fail(e);}}
