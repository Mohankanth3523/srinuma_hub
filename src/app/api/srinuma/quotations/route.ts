import { NextRequest } from 'next/server';
import { auth,success,fail,s,amount } from '@/lib/srinuma/api';
import { rows,append,appendMany,replace,nextId,withLock,now,audit } from '@/lib/srinuma/store';
import { includedFeatures } from '@/lib/srinuma/package-features';
type PriceItem={description:string;quantity:number;unit_price_inr:number;item_type:string};
const asNumber=(x:string)=>Number(x.replace(/[^0-9.-]/g,''))||0;
const round=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
function paidAmount(value:unknown,max:number){const n=amount(value);if(n>round(max))throw Error('Amount received cannot exceed document total');return n;}
export async function GET(req:NextRequest){try{await auth(req,true);const [parents,children]=await Promise.all([rows('Quotations'),rows('QuotationItems')]);return success({quotations:parents.items.map(p=>({...p,items:children.items.filter(i=>i.quotation_id===p.quotation_id)}))});}catch(e){return fail(e,401);}}
export async function POST(req:NextRequest){try{const actor=await auth(req,true),data=await req.json() as Record<string,unknown>;const raw=data.items;if(!Array.isArray(raw)||raw.length<1||raw.length>50)throw Error('Quotation must have 1–50 items');
 const service=s(data.service_type),packageId=s(data.package_id);if(!['website','crm','invention'].includes(service))throw Error('Invalid service');
 const pkg=(await rows('Packages')).items.find(x=>x.package_id===packageId&&x.service_type===service&&x.active.toLowerCase()!=='false');if(!pkg)throw Error('Package not found');
 const items:PriceItem[]=raw.map((v:unknown)=>{if(!v||typeof v!=='object')throw Error('Invalid feature');const x=v as Record<string,unknown>;return {description:s(x.description,300),quantity:amount(x.quantity),unit_price_inr:amount(x.unit_price_inr),item_type:s(x.item_type,30)||'extra'};});
 if(items.some(x=>x.quantity<=0||x.quantity>1000))throw Error('Invalid feature quantity');
 const base=asNumber(pkg.base_price_inr);if(base<=0)throw Error('Invalid package starting price in Sheet');
 // Snapshot the server-side catalog inclusions with each new quotation.
 const [packageRows,featureRows]=await Promise.all([rows('Packages'),rows('PackageFeatures')]);
 const savedInclusions=includedFeatures(packageId,packageRows.items,featureRows.items);
 const extras=items.filter(x=>x.item_type!=='base'&&x.item_type!=='included');const subtotal=round(base+extras.reduce((n,x)=>n+x.quantity*x.unit_price_inr,0));
 const discountType=s(data.discount_type)==='percent'?'percent':'amount',discountValue=amount(data.discount_value||0),taxRate=amount(data.tax_rate_percent||0);
 if((discountType==='amount'&&discountValue>subtotal)||(discountType==='percent'&&discountValue>100)||taxRate>28)throw Error('Invalid discount/tax');
 const discount=discountType==='percent'?subtotal*discountValue/100:discountValue;
 const grand=round((subtotal-discount)*(1+taxRate/100));
 const advance=paidAmount(data.advance_paid_inr??0,grand);
 const leadId=s(data.lead_id,100);let lead:Record<string,string>|undefined;
 if(leadId){lead=(await rows('Leads')).items.find(x=>x.lead_id===leadId);if(!lead)throw Error('Linked Lead not found');}
 const quote=await withLock('Quotations',async()=>{const time=now(),id=await nextId('Quotations');const q={quotation_id:id,lead_id:leadId,client_name:s(data.client_name,200)||lead?.customer_name||'Customer',company_name:s(data.company_name,200)||lead?.company_name||'',client_phone:s(data.client_phone,80)||lead?.phone||'',client_address:s(data.client_address,1000)||lead?.address||'',service_type:service,package_id:packageId,project_name:s(data.project_name,220),requirements:s(data.requirements,3000),language:['Tamil','English','Both'].includes(s(data.language))?s(data.language):'English',status:'Draft',subtotal_inr:String(subtotal),discount_type:discountType,discount_value:String(discountValue),tax_rate_percent:String(taxRate),grand_total_inr:String(grand),advance_paid_inr:String(advance),payment_note:s(data.payment_note,500),created_at:time,updated_at:time};
 const all=[{description:`${pkg.tier} ${pkg.service_name} Package`,quantity:1,unit_price_inr:base,item_type:'base'},...savedInclusions.map(description=>({description,quantity:1,unit_price_inr:0,item_type:'included'})),...extras];
 await appendMany('QuotationItems',all.map((x,i)=>({item_id:`${id}-I${String(i+1).padStart(3,'0')}`,quotation_id:id,item_type:x.item_type,description:x.description,quantity:String(x.quantity),unit_price_inr:String(x.unit_price_inr),line_total_inr:String(round(x.quantity*x.unit_price_inr))})));
 await append('Quotations',q);return {...q,items:all};});await audit(actor.id,'CREATE','Quotations',quote.quotation_id);return success({quotation:quote},201);
 }catch(e){return fail(e);}}
export async function PATCH(req:NextRequest){try{const actor=await auth(req,true),v=await req.json() as Record<string,unknown>,id=s(v.quotation_id,80);if(!id)throw Error('Quotation ID required');
 const paymentEdit=Object.prototype.hasOwnProperty.call(v,'advance_paid_inr');
 const updated=await withLock('Quotations',async()=>{
  const q=(await rows('Quotations')).items.find(x=>x.quotation_id===id);if(!q)throw Error('Quotation not found');
  if(paymentEdit){if(q.status==='Cancelled')throw Error('Cannot record a payment on cancelled quotation');if((await rows('Invoices')).items.some(x=>x.quotation_id===id))throw Error('Quotation already invoiced. Record payment on its Invoice instead.');
   const paid=paidAmount(v.advance_paid_inr,Number(q.grand_total_inr)||0);return replace('Quotations','quotation_id',id,{advance_paid_inr:String(paid),payment_note:s(v.payment_note,500),updated_at:now()});
  }
  const status=s(v.status);if(!['Draft','Sent','Approved','Cancelled'].includes(status))throw Error('Invalid quotation status');return replace('Quotations','quotation_id',id,{status,updated_at:now()});
 });await audit(actor.id,paymentEdit?'PAYMENT_UPDATE':'STATUS','Quotations',id);return success({quotation:updated});
 }catch(e){return fail(e);}}
