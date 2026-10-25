import { NextRequest } from 'next/server';
import { auth,success,fail } from '@/lib/srinuma/api';
import { gfetch } from '@/lib/srinuma/store';
export async function GET(req:NextRequest){try{await auth(req,true);const id=process.env.SRINUMA_SHEET_ID||'';if(!id)throw Error('Sheet ID missing');const v=await gfetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}?fields=properties.title`) as {properties?:{title?:string}};return success({connected:true,spreadsheetTitle:v.properties?.title||''});}catch(e){return fail(e,503);}}
