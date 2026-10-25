import { NextRequest } from 'next/server';
import { auth } from '@/lib/srinuma/api';
import { rows } from '@/lib/srinuma/store';
import { includedFeatures } from '@/lib/srinuma/package-features';

const safe=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));
const cents=(n:unknown)=>{const x=Number(n);return Number.isFinite(x)?Math.round((x+Number.EPSILON)*100)/100:0;};
const inr=(n:unknown)=>'₹'+cents(n).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
const dt=(value?:string)=>{if(!value)return '—';const date=new Date(value);return Number.isNaN(date.getTime())?safe(value):date.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});};
const tr=(label:string,value:unknown)=>`<div class="tot-row"><span>${safe(label)}</span><b>${safe(value)}</b></div>`;

export async function GET(request:NextRequest){
 try{
  await auth(request,true); // Employee session must never receive customer contact or accounting PDFs.
  const type=request.nextUrl.searchParams.get('type');
  const id=request.nextUrl.searchParams.get('id')||'';
  const page=request.nextUrl.searchParams.get('paper')||'A4';
  const preview=request.nextUrl.searchParams.get('mode')==='preview';
  if(!['quote','invoice'].includes(type||'')||!['A4','A5','Letter'].includes(page)||!/^[A-Za-z0-9-]{1,90}$/.test(id))return new Response('Invalid document selection',{status:400});
  const [qs,ql,ins,il,leads,settings,packages,packageFeatures]=await Promise.all([rows('Quotations'),rows('QuotationItems'),rows('Invoices'),rows('InvoiceItems'),rows('Leads'),rows('Settings'),rows('Packages'),rows('PackageFeatures')]);
  const invoice=type==='invoice'?ins.items.find(x=>x.invoice_id===id):undefined;
  const quote=type==='quote'?qs.items.find(x=>x.quotation_id===id):qs.items.find(x=>x.quotation_id===invoice?.quotation_id);
  if(!quote||type==='invoice'&&!invoice)return new Response('Document not found',{status:404});
  const doc=type==='invoice'?invoice!:quote;
  const lines=(type==='invoice'?il.items.filter(x=>x.invoice_id===id):ql.items.filter(x=>x.quotation_id===id));
  const quoteLines=ql.items.filter(x=>x.quotation_id===quote.quotation_id);
  // Saved features take priority: subsequent catalog edits must not change issued quotes.
  // Older quotations without saved inclusions fall back to the current catalog.
  const snapshot=quoteLines.filter(x=>x.item_type==='included').map(x=>x.description).filter(Boolean);
  const resolved=snapshot.length?snapshot:includedFeatures(quote.package_id,packages.items,packageFeatures.items);
  const basePackage=packages.items.find(p=>p.package_id===quote.package_id);
  const featureHeading=basePackage?`${basePackage.tier} ${basePackage.service_name} Package — Included Features`:'Package — Included Features';
  const featureHtml=resolved.length?`<section class="inclusions"><h2>${safe(featureHeading)}</h2><ul>${resolved.map(f=>`<li>${safe(f)}</li>`).join('')}</ul><p class="note">Included in the package price. No separate charge.</p></section>`:'';
  const lead=leads.items.find(x=>x.lead_id===quote.lead_id);
  const config=Object.fromEntries(settings.items.map(x=>[x.setting_key,x.setting_value]));
  const title=type==='invoice'?'TAX / SERVICE INVOICE':'QUOTATION';
  const contact={name:quote.client_name||lead?.customer_name||'Customer',company:quote.company_name||lead?.company_name||'',phone:quote.client_phone||lead?.phone||'',address:quote.client_address||lead?.address||''};
  const amount=cents(doc.grand_total_inr),rawPaid=doc.advance_paid_inr,known=rawPaid!==''&&rawPaid!==undefined&&rawPaid!==null&&Number.isFinite(Number(rawPaid));
  const received=known?Math.max(0,cents(rawPaid)):0,balance=Math.max(0,cents(amount-received));
  const discount=type==='invoice'?cents(invoice!.discount_inr):cents(quote.discount_type==='percent'?cents(quote.subtotal_inr)*cents(quote.discount_value)/100:quote.discount_value);
  const tax=type==='invoice'?cents(invoice!.tax_inr):cents(amount-(cents(quote.subtotal_inr)-discount));
  const pageRule=page==='Letter'?'letter':page.toLowerCase();
  const a5=page==='A5';
  const dimensions=page==='A5'?'148mm':page==='Letter'?'216mm':'210mm';
  const details=[contact.company&&contact.company!==contact.name?`<p><b>Company</b>${safe(contact.company)}</p>`:'',contact.phone?`<p><b>Phone</b>${safe(contact.phone)}</p>`:'',contact.address?`<p><b>Address</b>${safe(contact.address).replace(/\n/g,'<br>')}</p>`:''].join('');
  const dateLabel=type==='invoice'?'Invoice Date':'Quotation Date';
  const shownDate=type==='invoice'?invoice!.issued_at:quote.created_at;
  const pricedLines=lines.filter(x=>x.item_type!=='included'&&!(type==='invoice'&&cents(x.unit_price_inr)===0&&snapshot.includes(x.description)));
  const tableRows=pricedLines.length?pricedLines.map((x,i)=>`<tr><td class="num">${i+1}</td><td>${safe(x.description)}</td><td class="qty">${safe(x.quantity||'1')}</td><td class="amt">${safe(inr(x.unit_price_inr))}</td><td class="amt">${safe(inr(cents(x.quantity||1)*cents(x.unit_price_inr)))}</td></tr>`).join(''):'<tr><td colspan="5">No line items found</td></tr>';
  const warnings=(!contact.phone||!contact.address?'<div class="warning screen-only">Customer phone or address missing. Update the linked Lead / quotation contact to print complete details.</div>':'')+(!known?'<div class="warning screen-only">Advance payment has not been recorded yet. Enter the amount in CRM before sending this document.</div>':'');
  // SRINUMA PAID STAMP V1: stamp only when the invoice is actually fully paid.
  const fullyPaid=type==='invoice'&&amount>0&&known&&received>=amount&&invoice?.status==='Paid';
  const partlyPaid=type==='invoice'&&known&&received>0&&!fullyPaid;
  // SRINUMA PAYMENT CREDIT V2: overpayments are shown as customer credit, never hidden.
  const excessReceived=known?Math.max(0,cents(received-amount)):0;
  const paidText=known?inr(received):'Not recorded';
  const balanceText=known?inr(balance):'Pending verification';
  // SRINUMA SETTINGS CONTROL CENTER V1: editable company name / document footer.
  const createdBy=safe(config.company_name||'SRINUMA DIGITAL SOLUTIONS');
  const footerText=safe(config.document_footer||('Thank you for choosing '+(config.company_name||'SRINUMA DIGITAL SOLUTIONS')));
  const customLogo=String(config.brand_logo_data||'');
  const printLogo=customLogo.length<=42000&&/^data:image\/(?:webp|png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(customLogo)?customLogo:'/srinuma-logo-print.png';
  const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safe(type==='invoice'?'Invoice':'Quotation')} ${safe(id)} · ${createdBy}</title><style>
   @page{size:${pageRule} portrait;margin:${a5?'9mm':'13mm'}}
   *{box-sizing:border-box}html,body{margin:0;padding:0}body{font-family:Arial,'Noto Sans Tamil',Latha,Vijaya,sans-serif;color:#1a2945;background:#e7edf7;font-size:11pt;line-height:1.42}
   .actionbar{background:#102747;padding:12px 20px;display:flex;justify-content:space-between;align-items:center;gap:12px;color:white;flex-wrap:wrap;position:sticky;top:0;z-index:2}.actionbar button{background:#176bc0;color:#fff;border:0;border-radius:8px;padding:10px 20px;font-weight:bold;cursor:pointer}.actionbar p{margin:0;font-size:13px}.warning{margin:14px auto;max-width:${dimensions};padding:10px 15px;background:#fff2d7;border:1px solid #dfb35e;border-radius:7px;font-size:12px;color:#815c0e}
   .sheet{width:${dimensions};max-width:100%;min-height:220mm;margin:20px auto 28px;background:#fff;padding:13mm;box-shadow:0 14px 55px #213c6a22;overflow-wrap:anywhere}
   .brand{display:flex;gap:16px;align-items:center;justify-content:space-between;border-bottom:2px solid #1f528f;padding-bottom:13px}.brand img{display:block;width:auto;max-width:65mm;max-height:25mm;object-fit:contain}.brand-address{font-size:9pt;max-width:48%;text-align:right;color:#44607c;white-space:pre-line}.brand-address b{font-size:9.5pt;color:#1a4077}
   .head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin:18px 0}.payment-stamp{display:inline-block;border:3px solid #167a46;color:#167a46;background:#f0fff5;font-size:22pt;font-weight:900;letter-spacing:2px;padding:4px 18px;border-radius:8px;transform:rotate(-5deg);margin:3px 0 12px}.payment-stamp small{display:block;font-size:9pt;letter-spacing:0;transform:rotate(5deg);text-align:center}.payment-partial{display:inline-block;border:2px solid #b97413;color:#80500b;background:#fff7e9;font-weight:bold;font-size:10pt;letter-spacing:1px;padding:5px 10px;border-radius:6px;margin-bottom:12px}.head h1{font-size:22pt;color:#1d4d83;margin:0 0 5px}.head .doc-id{font-weight:bold;color:#356698}.head .meta{text-align:right;font-size:9.5pt}.meta p{margin:0 0 5px}
   .client{background:#f2f6fc;border-left:3px solid #2366a6;padding:11px 14px;margin:14px 0 20px;break-inside:avoid}.client h2{font-size:9pt;letter-spacing:1.5px;color:#52719a;text-transform:uppercase;margin:0 0 6px}.client strong{font-size:12.5pt}.client p{margin:3px 0;font-size:9.5pt}.client p b{display:inline-block;min-width:72px;color:#4a6485}
   table{border-collapse:collapse;width:100%;table-layout:fixed;font-size:9.5pt}thead{display:table-header-group}th{background:#e8f0fa;color:#214d80;text-align:left;padding:9px 7px}th.amt,td.amt{text-align:right}th.qty,td.qty{text-align:center}th.num,td.num{width:8%;text-align:center}th.desc{width:40%}th.qty{width:10%}th.amt{width:21%}td{padding:9px 7px;border-bottom:1px solid #dbe4ef;vertical-align:top;overflow-wrap:anywhere}tr{break-inside:avoid;page-break-inside:avoid}
   .inclusions{margin:16px 0 8px;padding:11px 15px;background:#f5f8fc;border:1px solid #dce8f6;border-radius:7px;color:#1a3d65}.inclusions h2{margin:0 0 7px;font-size:11pt;color:#174d84}.inclusions ul{margin:0;padding-left:19px;columns:2;column-gap:22px;font-size:9pt}.inclusions li{padding:2px 3px 2px 0;break-inside:avoid;page-break-inside:avoid}.inclusions .note{font-size:8pt;color:#526e90;margin:9px 0 0}.totals{width:min(100%,92mm);margin:17px 0 0 auto;break-inside:avoid}.tot-row{display:flex;justify-content:space-between;gap:20px;padding:5px 0;font-size:10pt}.tot-row b{text-align:right;white-space:nowrap}.tot-row.final{border-top:2px solid #1f528f;margin-top:4px;padding-top:10px;font-size:12pt;color:#17457e}.tot-row.due{background:#e7f1fc;padding:10px;margin:8px -8px 0;font-weight:bold;color:#124b86;font-size:12pt}.paid{color:#167049}.not-recorded{font-size:8.5pt;color:#986d21}.footer{border-top:1px solid #e0e8f4;margin-top:23mm;padding-top:9px;color:#577292;font-size:9pt;text-align:center;break-inside:avoid}
   @media(max-width:600px){.sheet{margin:0 auto;padding:6mm}.brand img{max-width:46mm}.head h1{font-size:17pt}table{font-size:8pt}th,td{padding:6px 3px}}
   @media print{.inclusions{break-inside:auto;page-break-inside:auto}.inclusions h2{break-after:avoid}.inclusions li{break-inside:avoid}${a5?'.inclusions ul{columns:1;font-size:8pt}.inclusions{padding:2mm 3mm;margin:3mm 0}.inclusions h2{font-size:9pt}.inclusions .note{font-size:7pt}':''}html,body{background:#fff!important;width:auto!important;min-height:0!important;height:auto!important}.actionbar,.screen-only{display:none!important}.sheet{width:auto!important;max-width:100%!important;min-height:0!important;margin:0!important;padding:0!important;box-shadow:none!important}.brand,.client,.head,.totals,.footer{break-inside:avoid!important;page-break-inside:avoid!important}.head{margin:6mm 0 4mm!important}table{font-size:${page==='A5'?'7.5pt':'9pt'}!important}.brand img{max-height:22mm}.totals{max-width:${page==='A5'?'72mm':'92mm'}!important}.client{margin:4mm 0!important}.footer{margin-top:${a5?'5mm':'12mm'}}${a5?'.sheet{font-size:9pt!important}.brand img{max-height:14mm!important}.brand{padding-bottom:2mm!important}.head{margin:3mm 0 2mm!important}.head h1{font-size:16pt!important}.client{padding:2mm 3mm!important;margin:2mm 0!important}.client h2{font-size:7pt!important}.client strong{font-size:10pt!important}.client p{font-size:8pt!important;margin:1mm 0!important}th,td{padding:1.5mm 1mm!important}.totals{margin-top:4mm!important}.tot-row{padding:1mm 0!important;font-size:8.5pt!important}.tot-row.due{padding:2mm!important;font-size:10pt!important}':''}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style></head><body>${!preview?`<div class="actionbar"><p>${safe(title)} ${safe(id)} &nbsp;·&nbsp; ${safe(page)} &nbsp;·&nbsp; Save as PDF in Chrome</p><button type="button" onclick="window.print()">Print / Save PDF</button></div>`:''}${warnings}
  <main class="sheet"><div class="brand"><img alt="${createdBy} logo" src="${safe(printLogo)}"><div class="brand-address"><b>${createdBy}</b><div>${safe(config.company_address||'')}</div><div>${safe(config.company_phone||'')}</div></div></div>
  <div class="head"><div><h1>${safe(title)}</h1><span class="doc-id">${safe(id)}</span></div><div class="meta"><p><b>${dateLabel}:</b> ${safe(dt(shownDate))}</p>${invoice?.due_at?`<p><b>Due Date:</b> ${safe(dt(invoice.due_at))}</p>`:''}<p><b>Status:</b> ${safe(doc.status||'Draft')}</p>${quote.project_name?`<p><b>Project:</b> ${safe(quote.project_name)}</p>`:''}</div></div>
  ${fullyPaid?`<div class="payment-stamp" role="status">✓ FULLY PAID<small>PAYMENT COMPLETED ${invoice?.paid_at?safe(dt(invoice.paid_at)):""}</small></div>`:partlyPaid?`<div class="payment-partial">PART PAYMENT RECEIVED ${safe(inr(received))} · Balance ${safe(inr(balance))}</div>`:""}
  <section class="client"><h2>Bill To / வாடிக்கையாளர்</h2><strong>${safe(contact.name)}</strong>${details}</section>
  <table><thead><tr><th class="num">#</th><th class="desc">Description / விவரம்</th><th class="qty">Qty</th><th class="amt">Rate</th><th class="amt">Amount / தொகை</th></tr></thead><tbody>${tableRows}</tbody></table>
  ${featureHtml}
  <section class="totals">${tr('Subtotal',inr(doc.subtotal_inr))}${discount>0?tr('Discount','− '+inr(discount)):''}${tax>0?tr('Tax',inr(tax)):''}<div class="tot-row final"><span>Total / மொத்தம்</span><b>${safe(inr(amount))}</b></div><div class="tot-row paid"><span>Advance / Paid / பெற்ற தொகை</span><b class="${known?'':'not-recorded'}">${safe(paidText)}</b></div><div class="tot-row due"><span>Balance Due / மீதம்</span><b>${safe(balanceText)}</b></div>${excessReceived>0?`<div class="tot-row paid"><span>Extra received — customer credit / refund due</span><b>${safe(inr(excessReceived))}</b></div>`:""}</section>
  <footer class="footer">${footerText}</footer></main></body></html>`;
  return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'"}});
 }catch(e){return new Response(e instanceof Error?e.message:'Document unavailable',{status:401,headers:{'Cache-Control':'no-store','Content-Type':'text/plain; charset=utf-8'}});}
}
