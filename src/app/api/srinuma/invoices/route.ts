import { NextRequest } from 'next/server';
import { auth,success,fail,s,amount } from '@/lib/srinuma/api';
import { rows,append,appendMany,replace,nextId,withLock,now,audit } from '@/lib/srinuma/store';
const round=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
// SRINUMA PAYMENT TIMELINE V2: keep actual cash received even when above invoice total.
function paidAmount(value:unknown,_total:number){return amount(value);}
const goodDate=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
export async function GET(req:NextRequest){try{await auth(req,true);const [parents,items]=await Promise.all([rows('Invoices'),rows('InvoiceItems')]);return success({invoices:parents.items.map(x=>({...x,items:items.items.filter(i=>i.invoice_id===x.invoice_id)}))});}catch(e){return fail(e,401);}}
export async function POST(req:NextRequest){try{const actor=await auth(req,true),v=await req.json() as Record<string,unknown>,qid=s(v.quotation_id,90);if(!qid)throw Error('Quotation ID required');
 const [quotes,lines]=await Promise.all([rows('Quotations'),rows('QuotationItems')]);const q=quotes.items.find(x=>x.quotation_id===qid);if(!q||q.status!=='Approved')throw Error('Admin must approve quotation before invoice');const quoteItems=lines.items.filter(i=>i.quotation_id===qid);if(!quoteItems.length)throw Error('Quotation items missing');
 const invoice=await withLock('Invoices',async()=>{if((await rows('Invoices')).items.some(i=>i.quotation_id===qid))throw Error('Invoice already exists');const time=now(),id=await nextId('Invoices'),subtotal=Number(q.subtotal_inr)||0,discount=q.discount_type==='percent'?subtotal*(Number(q.discount_value)||0)/100:Number(q.discount_value)||0,rate=Number(q.tax_rate_percent)||0,tax=round((subtotal-discount)*rate/100),total=round(Number(q.grand_total_inr)||0);
 const paid=q.advance_paid_inr===''||q.advance_paid_inr===undefined?'':String(paidAmount(q.advance_paid_inr,total));
 const record={invoice_id:id,quotation_id:qid,client_name:q.client_name,company_name:q.company_name,status:paid!==''&&total>0&&Number(paid)>=total?'Paid':paid!==''&&Number(paid)>0?'Partially Paid':'Issued',subtotal_inr:String(subtotal),discount_inr:String(round(discount)),tax_inr:String(tax),grand_total_inr:String(total),advance_paid_inr:paid,payment_note:q.payment_note||'',issued_at:time,due_at:s(v.due_at,40),paid_at:paid!==''&&Number(paid)>=total?time:'',updated_at:time};
 await appendMany('InvoiceItems',quoteItems.map((x,i)=>({item_id:`${id}-I${String(i+1).padStart(3,'0')}`,invoice_id:id,description:x.description,quantity:x.quantity,unit_price_inr:x.unit_price_inr,line_total_inr:x.line_total_inr})));
 await append('Invoices',record);return record;});await audit(actor.id,'CREATE','Invoices',invoice.invoice_id);return success({invoice},201);
 }catch(e){return fail(e);}}
export async function PATCH(req:NextRequest){try{const actor=await auth(req,true),v=await req.json() as Record<string,unknown>,id=s(v.invoice_id,80);if(!id)throw Error('Invoice ID required');const paymentEdit=Object.prototype.hasOwnProperty.call(v,'advance_paid_inr');
 const updated=await withLock('Invoices',async()=>{const current=(await rows('Invoices')).items.find(x=>x.invoice_id===id);if(!current)throw Error('Invoice not found');if(current.status==='Cancelled')throw Error('Cannot update a cancelled invoice');
  if(paymentEdit){
   // SRINUMA PAID RECEIPT SYNC V1: only the NEW cash received is added to Payments.
   const total=round(Number(current.grand_total_inr)||0),paid=paidAmount(v.advance_paid_inr,total),complete=total>0&&paid>=total;
   const oldReceived=current.advance_paid_inr===''?0:round(Number(current.advance_paid_inr)||0);
   if(paid<oldReceived)throw Error('Received amount cannot be reduced here. Record refunds or corrections separately; contact admin before changing a historical payment.');
   const difference=round(paid-oldReceived);
   // When the user records a payment, preserve its actual date in Payments.
   const nowInIndia=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Kolkata'});
   const chosenDate=s(v.receipt_date,10)||nowInIndia;
   if(difference>0&&!goodDate(chosenDate))throw Error('Select a valid received date (YYYY-MM-DD).');
   if(difference>0){
    // Payment first, invoice second: retry can finish invoice update without duplicating cash.
    // All finance writers use the same Payments lock. Google Sheets has no SQL transaction.
    const marker='AUTO_INVOICE_RECEIPT:'+id+':'+Math.round(oldReceived*100)+':'+Math.round(paid*100);
    await withLock('Payments',async()=>{
     const existing=(await rows('Payments')).items;
     if(existing.some(p=>p.note?.includes(marker)))return;
     const localDate=chosenDate;
     const reference=s(v.payment_note,450);
     const receipt={payment_id:await nextId('Payments'),paid_at:localDate,entry_type:'income',amount_inr:difference.toFixed(2),counterparty:current.company_name||current.client_name||'Customer',category:'Customer Payment',purpose:(complete?'Final payment':'Part payment')+' received for '+id,employee_id:'',work_id:'',invoice_id:id,quotation_id:current.quotation_id||'',note:(reference?reference+' | ':'')+marker,created_at:now(),created_by:actor.id};
     await append('Payments',receipt);
    });
   }
   return replace('Invoices','invoice_id',id,{advance_paid_inr:String(paid),payment_note:s(v.payment_note,500),status:complete?'Paid':paid>0?'Partially Paid':'Issued',paid_at:complete?current.paid_at||now():'',updated_at:now()});
  }
  const status=s(v.status);if(status==='Paid')throw Error('Record the actual amount received before marking invoice paid');if(!['Issued','Cancelled'].includes(status))throw Error('Invalid invoice status');return replace('Invoices','invoice_id',id,{status,updated_at:now()});
 });await audit(actor.id,paymentEdit?'PAYMENT_UPDATE':'STATUS','Invoices',id);return success({invoice:updated});
 }catch(e){return fail(e);}}
