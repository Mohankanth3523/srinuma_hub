import { NextRequest } from 'next/server';
import { auth,success,fail,s } from '@/lib/srinuma/api';
import { rows,append,replace,nextId,withLock,now,audit } from '@/lib/srinuma/store';
import { sendWorkAssignmentEmail } from '@/lib/srinuma/work-assignment-email';

// SRINUMA BUSINESS OPS V1
// SRINUMA COMPLETED WORK BILLING V1 — Approved is the legacy status. Completed is final.
const statuses=['Assigned','In Progress','Submitted','Approved','Completed','Rework'];
function safeWork(x:Record<string,string>){return {work_id:x.work_id,lead_id:x.lead_id,employee_id:x.employee_id,title:x.title,description:x.description,status:x.status,due_date:x.due_date,admin_feedback:x.admin_feedback,started_at:x.started_at||'',submitted_at:x.submitted_at,approved_at:x.approved_at,created_at:x.created_at,updated_at:x.updated_at};}
export async function GET(req:NextRequest){try{const user=await auth(req);const list=(await rows('Works')).items.filter(x=>user.role==='admin'||x.employee_id===user.id).map(safeWork);return success({works:list});}catch(e){return fail(e,401);}}
export async function POST(req:NextRequest){try{const actor=await auth(req,true),v=await req.json() as Record<string,unknown>;const title=s(v.title,200),employeeId=s(v.employee_id,80),leadId=s(v.lead_id,80);if(!title||!employeeId)throw Error('Work title and employee required');const employee=(await rows('Employees')).items.find(e=>e.employee_id===employeeId&&e.active.toLowerCase()==='true');if(!employee)throw Error('Employee not active');if(leadId&&!(await rows('Leads')).items.some(l=>l.lead_id===leadId))throw Error('Lead not found');
 const work=await withLock('Works',async()=>{
  if(leadId){
   const [leads,quotes,existingWorks]=await Promise.all([rows('Leads'),rows('Quotations'),rows('Works')]);
   const lead=leads.items.find(l=>l.lead_id===leadId);
   if(!lead||lead.status==='Closed')throw Error('Lead is unavailable or closed');
   if(!quotes.items.some(q=>q.lead_id===leadId&&q.status==='Approved'))throw Error('Client approval required: approve linked quotation before assigning work.');
   if(existingWorks.items.some(w=>w.lead_id===leadId))throw Error('Work already assigned to this lead. Open existing Work instead of duplicating it.');
  }
  const time=now(),record={work_id:await nextId('Works'),lead_id:leadId,employee_id:employeeId,title,description:s(v.description,3000),status:'Assigned',due_date:s(v.due_date,30),admin_feedback:'',started_at:'',submitted_at:'',approved_at:'',created_at:time,updated_at:time};await append('Works',record);return safeWork(record);});await audit(actor.id,'CREATE','Works',work.work_id);
 const email_notification=await sendWorkAssignmentEmail({recipient:employee.email||'',employeeName:employee.name||'',workId:work.work_id,title:work.title,dueDate:work.due_date});
 return success({work,email_notification},201);
 }catch(e){return fail(e);}}
export async function PATCH(req:NextRequest){try{const actor=await auth(req),v=await req.json() as Record<string,unknown>,id=s(v.work_id,80),status=s(v.status);if(!id||(!statuses.includes(status)&&!Object.prototype.hasOwnProperty.call(v,'due_date')))throw Error('Invalid work ID or status');
 const work=await withLock('Works',async()=>{
  const source=(await rows('Works')).items.find(x=>x.work_id===id);if(!source)throw Error('Work not found');
  if(Object.prototype.hasOwnProperty.call(v,'due_date')){
   if(actor.role!=='admin')throw Error('Only admin may edit work due date');
   if(source.status==='Approved'||source.status==='Completed')throw Error('Completed work is closed');
   const due=s(v.due_date,10);
   if(due&&!/^\d{4}-\d{2}-\d{2}$/.test(due))throw Error('Due date must be YYYY-MM-DD');
   if(due&&(!Number.isFinite(Date.parse(due))||new Date(due+'T12:00:00Z').toISOString().slice(0,10)!==due))throw Error('Invalid due date');
   return safeWork(await replace('Works','work_id',id,{due_date:due,updated_at:now()}));
  }
  if(actor.role==='employee'){
   if(source.employee_id!==actor.id)throw Error('Work not assigned to this employee');
   if(status==='In Progress'){
    if(source.status!=='Assigned')throw Error('Only newly assigned work can be started; Rework must stay in Rework until a new corrected file is uploaded');
    const time=now();return safeWork(await replace('Works','work_id',id,{status,started_at:source.started_at||time,updated_at:time}));
   }
   if(status!=='Submitted'||!['Assigned','Rework','In Progress'].includes(source.status))throw Error('Employees may submit only assigned, in-progress or rework tasks');
   const outputs=(await rows('Files')).items.filter(f=>f.work_id===id&&f.uploaded_by_employee_id===actor.id);
   if(outputs.length===0)throw Error('Upload your completed file before submitting for review.');
   if(source.status==='Rework'&&!outputs.some(f=>Date.parse(f.created_at)>Date.parse(source.updated_at)))throw Error('Upload a NEW corrected file after the rework request before submitting again.');
  }else{
   // Legacy-approved jobs can be explicitly marked Completed by admin without deleting records.
   if(status==='Completed'&&source.status==='Approved'){
    const at=now();return safeWork(await replace('Works','work_id',id,{status:'Completed',approved_at:source.approved_at||at,updated_at:at}));
   }
   if(!['Completed','Rework'].includes(status)||source.status!=='Submitted')throw Error('Only submitted work can be completed or sent for rework');
   if(status==='Completed'){
    const outputs=(await rows('Files')).items.filter(f=>f.work_id===id&&f.uploaded_by_employee_id);
    if(outputs.length===0)throw Error('Employee has not uploaded completed files yet.');
   }
   if(status==='Rework'&&!s(v.feedback,2000))throw Error('Write the corrections required before requesting rework.');
  }
  const time=now(),change:Record<string,string>={status,updated_at:time};
  if(status==='Submitted')change.submitted_at=time;
  if(status==='Completed')change.approved_at=time;
  if(status==='Rework')change.admin_feedback=s(v.feedback,2000);
  return safeWork(await replace('Works','work_id',id,change));
 });
 await audit(actor.id,Object.prototype.hasOwnProperty.call(v,'due_date')?'DUE_DATE':status==='In Progress'?'START':status==='Rework'?'REWORK':status==='Completed'?'COMPLETE':'SUBMIT','Works',id);
 return success({work});
 }catch(e){return fail(e);}}
