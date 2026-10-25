import { NextRequest } from 'next/server';
import { auth,success,fail,s } from '@/lib/srinuma/api';
import { rows,upsertSetting,audit } from '@/lib/srinuma/store';
// SRINUMA SETTINGS CONTROL CENTER V1: protected allowlist (never credentials, sheet IDs, or access rules).
const editable=['theme_accent','card_size','company_name','workspace_title','company_address','company_phone','quotation_default_language','default_paper_size','default_work_due_days','dashboard_leads','dashboard_employees','dashboard_work','dashboard_quotations','document_footer','brand_logo_data'];
export async function GET(req:NextRequest){try{await auth(req,true);const all=(await rows('Settings')).items;return success({settings:Object.fromEntries(all.filter(x=>editable.includes(x.setting_key)).map(x=>[x.setting_key,x.setting_value]))});}catch(e){return fail(e,401);}}
export async function PATCH(req:NextRequest){try{const user=await auth(req,true),v=await req.json() as Record<string,unknown>;for(const [k,x] of Object.entries(v)){if(!editable.includes(k))throw Error(`Cannot update setting: ${k}`);const value=k==='brand_logo_data'?String(x??''):s(x,600);if(k==='brand_logo_data'&&(value.length>42000||(value!==''&&!/^data:image\/(?:webp|png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(value))))throw Error('Brand logo must be a compressed PNG, JPEG or WebP under 42 KB');if(k==='theme_accent'&&!/^#[a-f\d]{6}$/i.test(value))throw Error('Invalid theme color');if(k==='card_size'&&!['compact','comfortable'].includes(value))throw Error('Invalid card size');if(k==='company_name'&&(value.length<2||value.length>100))throw Error('Company name must be 2–100 characters');
 if(k==='workspace_title'&&(value.length<2||value.length>70))throw Error('Workspace name must be 2–70 characters');
 if(k==='quotation_default_language'&&!['English','Tamil','Both'].includes(value))throw Error('Invalid quotation language');
 if(k==='default_paper_size'&&!['A4','A5','Letter'].includes(value))throw Error('Invalid paper size');
 if(k==='default_work_due_days'&&(!/^\d{1,3}$/.test(value)||Number(value)>365))throw Error('Work due days must be 0–365');
 if(k.startsWith('dashboard_')&&!['true','false'].includes(value))throw Error('Invalid dashboard visibility');
 if(k==='document_footer'&&value.length>220)throw Error('Document footer is too long');
 await upsertSetting(k,value);}await audit(user.id,'SAVE','Settings','ui');return GET(req);}catch(e){return fail(e);}}
