import {NextRequest} from 'next/server';
import {auth, success, fail, s, amount} from '@/lib/srinuma/api';
import {rows, append, nextId, withLock, now, audit} from '@/lib/srinuma/store';

type Entry=Record<string,string>;
const allowed=['income','expense'];
const validDate=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
function publicEntry(row:Entry){return {payment_id:row.payment_id,paid_at:row.paid_at,entry_type:row.entry_type,amount_inr:row.amount_inr,counterparty:row.counterparty,category:row.category,purpose:row.purpose,employee_id:row.employee_id,work_id:row.work_id,invoice_id:row.invoice_id,quotation_id:row.quotation_id,note:row.note,created_at:row.created_at};}
export async function GET(req:NextRequest){try{await auth(req,true);const list=(await rows('Payments')).items.map(publicEntry);return success({payments:list});}catch(e){return fail(e,401);}}
export async function POST(req:NextRequest){try{
 const actor=await auth(req,true),payload=await req.json() as Record<string,unknown>;
 const type=s(payload.entry_type,12).toLowerCase(), paidAt=s(payload.paid_at,10), price=amount(payload.amount_inr);
 const category=s(payload.category,90),purpose=s(payload.purpose,500),counterparty=s(payload.counterparty,150);
 const employeeId=s(payload.employee_id,70),workId=s(payload.work_id,70),invoiceId=s(payload.invoice_id,70),quotationId=s(payload.quotation_id,70),note=s(payload.note,600);
 if(!allowed.includes(type))throw Error('Choose income or expense.');
 if(!validDate(paidAt))throw Error('Choose a valid payment date (YYYY-MM-DD).');
 if(price<=0)throw Error('Payment amount must be greater than zero.');
 if(!category||!purpose)throw Error('Category and payment purpose are required.');
 if(type==='expense'&&employeeId&&!(await rows('Employees')).items.some(x=>x.employee_id===employeeId))throw Error('Unknown employee ID.');
 if(workId&&!(await rows('Works')).items.some(x=>x.work_id===workId))throw Error('Unknown work ID.');
 if(invoiceId&&!(await rows('Invoices')).items.some(x=>x.invoice_id===invoiceId))throw Error('Unknown invoice ID.');
 // SRINUMA INVOICE CASH SOURCE V1: avoid posting the same linked receipt twice.
 if(type==='income'&&invoiceId)throw Error('Record customer invoice payments in Billing → Invoices → Record / Update Payment. It automatically adds the new cash received to Payments.');
 if(quotationId&&!(await rows('Quotations')).items.some(x=>x.quotation_id===quotationId))throw Error('Unknown quotation ID.');
 const payment=await withLock('Payments',async()=>{const record:Entry={payment_id:await nextId('Payments'),paid_at:paidAt,entry_type:type,amount_inr:price.toFixed(2),counterparty,category,purpose,employee_id:employeeId,work_id:workId,invoice_id:invoiceId,quotation_id:quotationId,note,created_at:now(),created_by:actor.id};await append('Payments',record);return publicEntry(record);});
 await audit(actor.id,'CREATE','Payments',payment.payment_id);
 return success({payment},201);
 }catch(e){return fail(e);}}
