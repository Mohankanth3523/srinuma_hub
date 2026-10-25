import { NextRequest } from 'next/server';
import { auth,success,fail,s } from '@/lib/srinuma/api';
import { rows,append,nextId,withLock,now,audit } from '@/lib/srinuma/store';
import { driveToken,driveFetch } from '@/lib/srinuma/drive';

async function mayReadWork(workId:string,user:{id:string;role:string}){const record=(await rows('Works')).items.find(w=>w.work_id===workId);if(!record||user.role!=='admin'&&record.employee_id!==user.id)throw Error('Work not accessible');return record;}
const acceptedExt=new Set(['png','jpg','jpeg','webp','pdf','svg','zip','psd','ai']);
const contentTypes:Record<string,string>={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',pdf:'application/pdf',svg:'image/svg+xml',zip:'application/zip',psd:'application/octet-stream',ai:'application/octet-stream'};
const MAX_BYTES=8*1024*1024;

export async function GET(req:NextRequest){try{const user=await auth(req),id=req.nextUrl.searchParams.get('download');
 if(req.nextUrl.searchParams.get('configuration')==='1'){if(user.role!=='admin')throw Error('Admin only');return success({configured:Boolean(process.env.SRINUMA_DRIVE_FOLDER_ID),owner_oauth_connected:Boolean(process.env.SRINUMA_DRIVE_OAUTH_REFRESH_TOKEN)});}
 if(id){const record=(await rows('Files')).items.find(x=>x.file_id===id);if(!record)throw Error('File not found');await mayReadWork(record.work_id,user);
  const url=`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(record.drive_file_id)}?alt=media&supportsAllDrives=true`;
  let res=await fetch(url,{headers:{Authorization:`Bearer ${await driveToken()}`},cache:'no-store'});
  if(res.status===401)res=await fetch(url,{headers:{Authorization:`Bearer ${await driveToken(true)}`},cache:'no-store'});
  if(!res.ok)throw Error(`Google Drive download failed (${res.status})`);
  const name=record.original_filename.replace(/["\r\n\\/]/g,'_').slice(0,160);
  return new Response(res.body,{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="${name.replace(/[^\x20-\x7E]/g,'_')}"; filename*=UTF-8''${encodeURIComponent(name)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }
 const list=(await rows('Files')).items;if(user.role==='admin')return success({files:list});
 const works=new Set((await rows('Works')).items.filter(w=>w.employee_id===user.id).map(w=>w.work_id));
 return success({files:list.filter(f=>works.has(f.work_id)).map(x=>({file_id:x.file_id,work_id:x.work_id,original_filename:x.original_filename,mime_type:x.mime_type,created_at:x.created_at,uploaded_by_employee_id:x.uploaded_by_employee_id}))});
 }catch(e){return fail(e,401);}}
export async function POST(req:NextRequest){try{const user=await auth(req),data=await req.json() as Record<string,unknown>,workId=s(data.work_id,100),name=s(data.filename,170).replace(/[\\/\r\n"]/g,'_'),b64=s(data.base64,11500000);
 if(!workId||!name||!b64)throw Error('File, name, and work required');
 const work=await mayReadWork(workId,user);
 if(['Approved','Completed'].includes(work.status))throw Error('Completed work is locked. Create a new assignment for further updates.');
 if(user.role==='employee'&&!['Assigned','In Progress','Rework'].includes(work.status))throw Error('Upload is allowed before submitting assigned, in-progress or rework tasks.');
 const ext=name.split('.').pop()?.toLowerCase()||'';if(!acceptedExt.has(ext))throw Error('Allowed: PNG, JPG, WEBP, PDF, SVG, ZIP, PSD, AI');
 if(!/^[A-Za-z0-9+/]*={0,2}$/.test(b64)||b64.length%4!==0)throw Error('Invalid file encoding');
 const contents=Buffer.from(b64,'base64');if(!contents.length||contents.length>MAX_BYTES)throw Error('File must be 8 MB or smaller');
 const mime=contentTypes[ext];
 const folder=process.env.SRINUMA_DRIVE_FOLDER_ID;if(!folder)throw Error('Drive not connected. Run: node scripts\\connect-srinuma-drive.cjs');
 const boundary='srinuma_'+Date.now()+'_'+Math.random().toString(16).slice(2),metadata={name,parents:[folder],mimeType:mime};
 const body=Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`),contents,Buffer.from(`\r\n--${boundary}--`)]);
 const drive=await driveFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType&supportsAllDrives=true',{method:'POST',headers:{'Content-Type':`multipart/related; boundary=${boundary}`},body});
 const driveId=String(drive.id||'');if(!driveId)throw Error('Drive did not return file ID');
 const rec=await withLock('Files',async()=>{const r={file_id:await nextId('Files'),work_id:workId,lead_id:work.lead_id||'',drive_file_id:driveId,original_filename:name,mime_type:mime,uploaded_by_employee_id:user.role==='employee'?user.id:'',created_at:now()};await append('Files',r);return r;});
 await audit(user.id,'UPLOAD','Files',rec.file_id);
 return success({file:{file_id:rec.file_id,original_filename:name,work_id:workId,mime_type:mime,uploaded_by_employee_id:rec.uploaded_by_employee_id}},201);
 }catch(e){return fail(e);}}
