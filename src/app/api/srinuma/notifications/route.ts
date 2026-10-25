import { NextRequest } from 'next/server';
import { authRedis } from '@/lib/srinuma/auth-redis';
import { currentUser, sameOrigin } from '@/lib/srinuma/security';
import { rows } from '@/lib/srinuma/store';
import { success, fail } from '@/lib/srinuma/api';
import { createHash } from 'node:crypto';


type Notice = {id:string;title:string;detail:string;page:'leads'|'employees'|'work'|'payments'|'quotations';at:string;read:boolean};
function key(userId:string){return `srinuma:notice:read:${userId}`;}
function clearedKey(userId:string){return `srinuma:notice:cleared:${userId}`;}
function eventId(type:string, id:string, stamp:string){return createHash('sha256').update(`${type}:${id}:${stamp}`).digest('hex').slice(0,32);}
export async function GET(){
 try{
  const user=await currentUser();if(!user)return fail('Not authenticated',401);
  const out:Notice[]=[];
  if(user.role==='admin'){
   const [leads,works,audit]=await Promise.all([rows('Leads'),rows('Works'),rows('AuditLog')]);
   for(const l of leads.items){if(l.created_at)out.push({id:eventId('lead',l.lead_id,l.created_at),title:'New Lead',detail:l.company_name||l.customer_name||l.lead_id,page:'leads',at:l.created_at,read:false});}
   for(const w of works.items){if(w.submitted_at)out.push({id:eventId('submitted',w.work_id,w.submitted_at),title:'Work Submitted',detail:w.title||w.work_id,page:'work',at:w.submitted_at,read:false});}
   for(const a of audit.items){if(!a.timestamp||!['Employees','Payments','Invoices','Quotations','Settings','Works'].includes(a.entity_type))continue;if(a.entity_type==='Works' && a.action==='SUBMIT')continue;out.push({id:eventId('audit',a.audit_id,a.timestamp),title:`${a.entity_type} · ${a.action}`,detail:a.entity_id||'CRM activity',page:a.entity_type==='Employees'?'employees':a.entity_type==='Payments'?'payments':a.entity_type==='Settings'?'employees':a.entity_type==='Works'?'work':'quotations',at:a.timestamp,read:false});}
  }else{
   const works=(await rows('Works')).items.filter(w=>w.employee_id===user.id);
   for(const w of works){
    if(w.created_at)out.push({id:eventId('assigned',w.work_id,w.created_at),title:'Work Assigned',detail:w.title||w.work_id,page:'work',at:w.created_at,read:false});
    if(w.approved_at)out.push({id:eventId('approved',w.work_id,w.approved_at),title:'Work Approved',detail:w.title||w.work_id,page:'work',at:w.approved_at,read:false});
    if(w.status==='Rework'&&w.updated_at)out.push({id:eventId('rework',w.work_id,w.updated_at),title:'Rework Requested',detail:w.admin_feedback||w.title||w.work_id,page:'work',at:w.updated_at,read:false});
   }
  }
  const since=Date.now()-30*86400000;
  const recent=out.filter(n=>Number.isFinite(Date.parse(n.at))&&Date.parse(n.at)>=since).sort((a,b)=>b.at.localeCompare(a.at)).slice(0,80);
  const [read,cleared]=await Promise.all([authRedis().smembers(key(user.id)),authRedis().smembers(clearedKey(user.id))]);
  const readSet=new Set(read||[]),clearedSet=new Set(cleared||[]);
  return success({notifications:recent.filter(n=>!clearedSet.has(n.id)).map(n=>({...n,read:readSet.has(n.id)}))});
 }catch(e){console.error('Notifications failed',e);return fail('Notifications unavailable',503);}
}
export async function PATCH(req:NextRequest){
 if(!sameOrigin(req))return fail('Invalid origin',403);
 try{const user=await currentUser();if(!user)return fail('Not authenticated',401);const body=await req.json() as {id?:unknown};if(typeof body.id!=='string'||!/^[a-f0-9]{32}$/.test(body.id))return fail('Invalid event',400);
 // Accept only an ID that appears in this user's current authorized notification feed.
 const {notifications}=await (async()=>{const response=await GET();return response.json() as Promise<{notifications?:Notice[]}>;})();
 if(!notifications?.some(n=>n.id===body.id))return fail('Event not found',404);
 await authRedis().sadd(key(user.id),body.id);await authRedis().expire(key(user.id),90*86400);
 return success({read:true});}catch{return fail('Cannot update notification',503);}
}

// Clear only currently visible notifications owned by this authenticated user.
// New events after clearing still appear normally.
export async function DELETE(req:NextRequest){
 if(!sameOrigin(req))return fail('Invalid origin',403);
 try{
  const user=await currentUser();if(!user)return fail('Not authenticated',401);
  const response=await GET(),data=await response.json() as {notifications?:Notice[]};
  if(!response.ok)return fail('Could not load notifications',503);
  const ids=(data.notifications||[]).map(n=>n.id);
  if(ids.length){for(let i=0;i<ids.length;i+=10){await Promise.all(ids.slice(i,i+10).map(id=>authRedis().sadd(clearedKey(user.id),id)));}await authRedis().expire(clearedKey(user.id),90*86400);}
  return success({cleared:ids.length});
 }catch{return fail('Could not clear notifications',503);}
}
