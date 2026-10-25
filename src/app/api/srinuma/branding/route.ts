import { rows } from '@/lib/srinuma/store';
import { NextResponse } from 'next/server';

// Public brand identity used only for the login screen and employee workspace.
// Never expose all Settings rows, which may contain private profile data.
const publicKeys=['workspace_title','company_name','theme_accent','brand_logo_data'] as const;
export async function GET(){
 try{
  const records=(await rows('Settings')).items;
  const found=Object.fromEntries(records.filter(r=>publicKeys.includes(r.setting_key as typeof publicKeys[number])).map(r=>[r.setting_key,r.setting_value]));
  const logo=found.brand_logo_data||'';
  const safeLogo=logo.length<=42000&&/^data:image\/(?:webp|png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(logo)?logo:'';
  return NextResponse.json({branding:{workspace_title:String(found.workspace_title||'SRINUMA HUB').slice(0,70),company_name:String(found.company_name||'SRINUMA DIGITAL SOLUTIONS').slice(0,100),theme_accent:/^#[0-9a-fA-F]{6}$/.test(found.theme_accent||'')?found.theme_accent:'#25c8ff',brand_logo_data:safeLogo}},{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }catch{
  return NextResponse.json({error:'Branding temporarily unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});
 }
}
