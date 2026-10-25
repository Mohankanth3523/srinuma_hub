import { NextRequest } from 'next/server';
import { auth, success, fail, s } from '@/lib/srinuma/api';
import { rows, append, nextId, withLock, now, audit } from '@/lib/srinuma/store';

/* SRINUMA WORK LINKS + COMPLETED CUSTOMER CARDS V1
   Link references use existing Files columns:
   mime_type=text/uri-list, drive_file_id=LINK:<HTTPS URL>.
   Actual Drive upload/download API is NOT changed.
   Only admin and the employee assigned to this work may open shared links. */
const LINK_TYPE='text/uri-list';
const LINK_PREFIX='LINK:';
const MAX_URL_LENGTH=1800;

function validLink(raw:string):string {
 if(!raw||raw.length>MAX_URL_LENGTH)throw Error('HTTPS link required (max 1800 characters).');
 let u:URL;
 try{u=new URL(raw);}catch{throw Error('Enter a valid HTTPS link.');}
 if(u.protocol!=='https:'||!u.hostname||u.username||u.password)throw Error('Only secure HTTPS links without embedded passwords are allowed.');
 const host=u.hostname.toLowerCase();
 if(host==='localhost'||host.endsWith('.localhost')||host==='127.0.0.1'||host==='0.0.0.0'||host==='[::1]'||host==='::1'||host.endsWith('.local'))throw Error('Share an external HTTPS link, not a local address.');
 return u.toString();
}

async function allowedWork(workId:string,user:{id:string;role:string}){
 const work=(await rows('Works')).items.find(w=>w.work_id===workId);
 if(!work||user.role!=='admin'&&work.employee_id!==user.id)throw Error('Work not accessible');
 return work;
}

export async function GET(req:NextRequest){
 try{
  const user=await auth(req);
  const id=s(req.nextUrl.searchParams.get('open'),80);
  if(!id)throw Error('Link ID required');
  const record=(await rows('Files')).items.find(x=>x.file_id===id);
  if(!record||record.mime_type!==LINK_TYPE||!record.drive_file_id.startsWith(LINK_PREFIX))throw Error('Link not found');
  await allowedWork(record.work_id,user);
  const url=validLink(record.drive_file_id.slice(LINK_PREFIX.length));
  // Authenticated redirect; no server-side fetch to a third-party URL.
  return new Response(null,{status:302,headers:{'Location':url,'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});
 }catch(e){return fail(e,401);}
}

export async function POST(req:NextRequest){
 try{
  const user=await auth(req);
  const data=await req.json() as Record<string,unknown>;
  const workId=s(data.work_id,80);
  if(!workId)throw Error('Work required');
  const url=validLink(s(data.url,MAX_URL_LENGTH+1));
  const label=s(data.title,120).replace(/[\r\n]/g,' ').trim()||'Shared work URL';
  const work=await allowedWork(workId,user);
  if(work.status==='Completed'||work.status==='Approved')throw Error('Completed work is locked');
  if(user.role==='employee'&&!['Assigned','In Progress','Rework'].includes(work.status))throw Error('Finished URL can be shared only before work submission or during rework.');
  const record=await withLock('Files',async()=>{
   const row={file_id:await nextId('Files'),work_id:workId,lead_id:work.lead_id||'',drive_file_id:LINK_PREFIX+url,original_filename:label,mime_type:LINK_TYPE,uploaded_by_employee_id:user.role==='employee'?user.id:'',created_at:now()};
   await append('Files',row);
   return row;
  });
  await audit(user.id,'SHARE_LINK','Files',record.file_id);
  return success({file:{file_id:record.file_id,work_id:record.work_id,original_filename:record.original_filename,mime_type:record.mime_type,uploaded_by_employee_id:record.uploaded_by_employee_id}},201);
 }catch(e){return fail(e);}
}
