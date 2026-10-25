"use client";
import {useCallback,useEffect,useMemo,useRef,useState,type CSSProperties,type FormEvent} from 'react';
type Actor={id:string;username:string;name:string;role:'admin'|'employee'};
type Lead={lead_id:string;created_at:string;customer_name:string;company_name:string;phone:string;address:string;service_type:string;project_name:string;requirement:string;extra_features:string;status:string;assigned_employee_id:string;updated_at:string};
type Employee={employee_id:string;name:string;username:string;active:boolean;work_category:string;email?:string;phone?:string};
type Work={work_id:string;employee_id:string;lead_id:string;title:string;description:string;status:string;due_date:string;admin_feedback:string;started_at?:string;created_at?:string;submitted_at?:string;approved_at?:string;updated_at:string};
type PriceRow={package_id:string;service_type:string;service_name:string;tier:string;base_price_inr:string;price_status:string};
type FeatureRow={feature_id:string;package_id:string;feature_description:string;included:string;sort_order:string};
type ExtraRow={feature_id:string;service_type:string;feature_name:string;suggested_price_inr:string;price_status:string};
type QuoteItem={item_id?:string;description:string;quantity:number|string;unit_price_inr:number|string;item_type:string;line_total_inr?:string};
type Quote={quotation_id:string;lead_id:string;client_name:string;company_name:string;client_phone?:string;client_address?:string;advance_paid_inr?:string;payment_note?:string;service_type:string;package_id:string;project_name:string;requirements:string;language:string;status:string;subtotal_inr:string;discount_type:string;discount_value:string;tax_rate_percent:string;grand_total_inr:string;created_at:string;items:QuoteItem[]};
type Invoice={invoice_id:string;quotation_id:string;client_name:string;company_name:string;advance_paid_inr?:string;payment_note?:string;status:string;subtotal_inr:string;discount_inr:string;tax_inr:string;grand_total_inr:string;issued_at:string;due_at:string;items:QuoteItem[]};
type FileRec={file_id:string;work_id:string;original_filename:string;mime_type:string;created_at:string;uploaded_by_employee_id?:string};
type Payment={payment_id:string;paid_at:string;entry_type:string;amount_inr:string;counterparty:string;category:string;purpose:string;employee_id:string;work_id:string;invoice_id:string;quotation_id:string;note:string;created_at:string};
type Page='dashboard'|'leads'|'employees'|'work'|'quotations'|'invoices'|'billing_completed'|'payments'|'settings'|'profile';
const tabs:[Page,string,string][]=[['dashboard','Dashboard','◫'],['leads','Leads','◈'],['employees','Employees','♙'],['work','Work','☷'],['quotations','Billing','▤'],['payments','Payments','₹'],['settings','Settings','⚙'],['profile','My Profile','◉']];
const SERVICE:Record<string,string>={website:'Website Development',crm:'CRM Development',invention:'Digital Invitation'};
const money=(x:number|string)=>'₹'+(Number(String(x).replace(/[^0-9.-]/g,''))||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
const date=(s?:string)=>s?new Date(s).toLocaleDateString('en-IN'):'—';
const emptyLead=()=>({customer_name:'',company_name:'',phone:'',address:'',service_type:'website',project_name:'',requirement:'',extra_features:''});
async function api<T=Record<string,unknown>>(path:string,init?:RequestInit):Promise<T>{const r=await fetch(`/api/srinuma/${path}`,{credentials:'same-origin',cache:'no-store',...init,headers:{...(init?.body?{'Content-Type':'application/json'}:{}),...init?.headers}});const data=await r.json() as T&{error?:string};if(!r.ok)throw Error(data.error||`API HTTP ${r.status}`);return data;}
const req=(method:string,data:unknown)=>({method,body:JSON.stringify(data)});
function openingSound(){try{const Ctx=window.AudioContext;if(!Ctx)return;const ctx=new Ctx();if(ctx.state==='suspended')void ctx.resume();[[.1,250,580],[.47,360,840],[1.0,490,1150],[1.7,650,1150]].forEach(([offset,start,end])=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.setValueAtTime(start,ctx.currentTime+offset);o.frequency.exponentialRampToValueAtTime(end,ctx.currentTime+offset+.3);g.gain.setValueAtTime(.001,ctx.currentTime+offset);g.gain.exponentialRampToValueAtTime(.13,ctx.currentTime+offset+.07);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+offset+.32);o.connect(g);g.connect(ctx.destination);o.start(ctx.currentTime+offset);o.stop(ctx.currentTime+offset+.34);});setTimeout(()=>void ctx.close().catch(()=>{}),2600);}catch{}}
export default function Home(){
 const [ready,setReady]=useState(false),[intro,setIntro]=useState(true),[user,setUser]=useState<Actor|null>(null);
 const [notifications,setNotifications]=useState<{id:string;title:string;detail:string;page:Page;at:string;read:boolean}[]>([]),[showNotifications,setShowNotifications]=useState(false),[noticeError,setNoticeError]=useState('');
 const [page,setPage]=useState<Page>('dashboard'),[workView,setWorkView]=useState<'all'|'active'|'completed'>('active'),[more,setMore]=useState(false),[loading,setLoading]=useState(false),[saveNotice,setSaveNotice]=useState<{kind:'saving'|'success'|'error';title:string;detail?:string}|null>(null),[saving,setSaving]=useState(false),[error,setError]=useState(''),[lastSync,setLastSync]=useState('');
 // SRINUMA APPLE STYLE SAVE-ONCE UX V1: synchronous lock prevents repeated clicks before React can repaint.
 const savingRef=useRef(false),lastSavedRef=useRef<{label:string;at:number}|null>(null),noticeTimerRef=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>()=>{if(noticeTimerRef.current)clearTimeout(noticeTimerRef.current);},[]);
 const [username,setUsername]=useState('srinuma'),[password,setPassword]=useState(''),[showPassword,setShowPassword]=useState(false),[showNewPassword,setShowNewPassword]=useState(false);
 const [forgotPassword,setForgotPassword]=useState(false),[otpSent,setOtpSent]=useState(false),[recoveryCode,setRecoveryCode]=useState(''),[recoveryPassword,setRecoveryPassword]=useState(''),[recoveryStatus,setRecoveryStatus]=useState('');
  const [profile,setProfile]=useState<{id:string;name:string;username:string;role:string;email:string;phone:string;photo:string}|null>(null),[profileName,setProfileName]=useState(''),[profilePhone,setProfilePhone]=useState(''),[profileEmail,setProfileEmail]=useState(''),[profileCurrentPassword,setProfileCurrentPassword]=useState(''),[profileBusy,setProfileBusy]=useState(false),[profileError,setProfileError]=useState(''),[profileMessage,setProfileMessage]=useState('');
 const loadNotifications=useCallback(async()=>{try{const r=await api<{notifications:{id:string;title:string;detail:string;page:Page;at:string;read:boolean}[]}>('notifications');setNotifications(r.notifications);setNoticeError('');}catch{setNoticeError('Notifications temporarily unavailable');}},[]);
 useEffect(()=>{if(!user)return;void loadNotifications();const timer=setInterval(()=>void loadNotifications(),30000);return()=>clearInterval(timer);},[user,loadNotifications]);
 const markNotice=async(id:string)=>{try{await api('notifications',req('PATCH',{id}));setNotifications(v=>v.map(n=>n.id===id?{...n,read:true}:n));}catch{setNoticeError('Unable to mark notification as read');}};
 const clearNotifications=async()=>{if(!window.confirm('Clear the notifications displayed for your account? New notifications will still arrive.'))return;try{await api('notifications',{method:'DELETE'});setNotifications([]);setNoticeError('');}catch(e){setNoticeError(e instanceof Error?e.message:'Could not clear notifications');}};
 const [leads,setLeads]=useState<Lead[]>([]),[employees,setEmployees]=useState<Employee[]>([]),[works,setWorks]=useState<Work[]>([]),[quotations,setQuotations]=useState<Quote[]>([]),[invoices,setInvoices]=useState<Invoice[]>([]),[files,setFiles]=useState<FileRec[]>([]);
 const [packages,setPackages]=useState<PriceRow[]>([]),[features,setFeatures]=useState<FeatureRow[]>([]),[extras,setExtras]=useState<ExtraRow[]>([]);
 const extraCatalog=useMemo(()=>{
  const byId=new Map<string,ExtraRow>(),byTitle=new Map<string,string>(),ambiguous=new Set<string>();
  let duplicates=0;
  for(const x of extras){
   const id=x.feature_id.trim();const label=x.service_type.trim().toLowerCase()+'|'+x.feature_name.trim().toLowerCase().replace(/\s+/g,' ');
   if(!id){duplicates++;continue;}
   if(byId.has(id)){duplicates++;ambiguous.add(id);continue;}
   if(byTitle.has(label)){duplicates++;ambiguous.add(id);ambiguous.add(byTitle.get(label)!);continue;}
   byId.set(id,x);byTitle.set(label,id);
  }
  return {items:[...byId.values()],ambiguous,duplicates};
 },[extras]);
 const [priceEdits,setPriceEdits]=useState<Record<string,string>>({});
 const [editingFeature,setEditingFeature]=useState(''),[featureEdits,setFeatureEdits]=useState<Record<string,string>>({});
 const [openPackageRate,setOpenPackageRate]=useState<string>('');
 const [openExtraRate,setOpenExtraRate]=useState<string>('');
 const [settings,setSettings]=useState<Record<string,string>>({theme_accent:'#25c8ff',card_size:'comfortable',company_name:'SRINUMA DIGITAL SOLUTIONS',workspace_title:'SRINUMA HUB',company_address:'',company_phone:'',quotation_default_language:'English',default_paper_size:'A4',default_work_due_days:'0',dashboard_leads:'true',dashboard_employees:'true',dashboard_work:'true',dashboard_quotations:'true',document_footer:'',brand_logo_data:''});
 const [brandLogoBusy,setBrandLogoBusy]=useState(false),[brandReady,setBrandReady]=useState(false);
 // Login and employee pages use only PUBLIC brand identity, never private Settings rows.
 useEffect(()=>{let active=true;const fallback=setTimeout(()=>{if(active)setBrandReady(true);},4500);api<{branding:Record<string,string>}>('branding').then(r=>{if(active)setSettings(previous=>({...previous,...r.branding}));}).catch(()=>{}).finally(()=>{if(active){clearTimeout(fallback);setBrandReady(true);}});return()=>{active=false;clearTimeout(fallback);};},[]);
 async function chooseBrandLogo(file:File){
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8*1024*1024){setError('Select a PNG, JPG or WebP logo under 8 MB. SVG files are not accepted.');return;}
  setBrandLogoBusy(true);setError('');
  const source=URL.createObjectURL(file);
  try{
   const img=new Image();
   await new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=()=>reject(Error('Logo image could not be read'));img.src=source;});
   if(!img.naturalWidth||!img.naturalHeight)throw Error('Invalid image dimensions');
   const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
   if(!ctx)throw Error('Image processing is unavailable');
   let result='';
   // Preserve original aspect ratio: never stretch or force a square brand logo.
   for(const width of [640,520,400,320,240]){
    const scale=Math.min(1,width/img.naturalWidth,280/img.naturalHeight);
    canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
    ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
    for(const quality of [0.88,0.76,0.62,0.48,0.32]){
     result=canvas.toDataURL('image/webp',quality);
     if(!result.startsWith('data:image/webp')){ctx.globalCompositeOperation='destination-over';ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.globalCompositeOperation='source-over';result=canvas.toDataURL('image/jpeg',quality);}
     if(result.length<=40000)break;
    }
    if(result.length<=40000)break;
   }
   if(result.length>40000)throw Error('Logo is too detailed to save. Try a smaller or simplified PNG/JPG.');
   setSettings(previous=>({...previous,brand_logo_data:result}));
  }catch(e){setError(e instanceof Error?e.message:'Could not process logo');}
  finally{URL.revokeObjectURL(source);setBrandLogoBusy(false);}
 }
 const [leadDraft,setLeadDraft]=useState(emptyLead()),[empDraft,setEmpDraft]=useState({name:'',username:'',email:'',phone:'',password:'',work_category:'all'}),[workDraft,setWorkDraft]=useState({lead_id:'',employee_id:'',title:'',description:'',due_date:''});
 const [editEmployee,setEditEmployee]=useState<Employee|null>(null),[editEmployeeDraft,setEditEmployeeDraft]=useState({name:'',email:'',phone:'',work_category:'all'});
 const [leadForm,setLeadForm]=useState(false),[empForm,setEmpForm]=useState(false),[workForm,setWorkForm]=useState(false),[assignLead,setAssignLead]=useState('');
 // SRINUMA WORK LINKS + COMPLETED CUSTOMER CARDS V1
 const [referenceUploads,setReferenceUploads]=useState<File[]>([]);
 const [referenceUrl,setReferenceUrl]=useState(''),[referenceTitle,setReferenceTitle]=useState('');
 const [leadDuration,setLeadDuration]=useState('');
 const [workLinkFor,setWorkLinkFor]=useState(''),[workLinkTitle,setWorkLinkTitle]=useState(''),[workLinkUrl,setWorkLinkUrl]=useState('');
 const [expandedCompleteWork,setExpandedCompleteWork]=useState('');
 const [leadFilter,setLeadFilter]=useState<'all'|'approved'|'assigned'|'pending'|'ready'|'balance'>('all');
 const [query,setQuery]=useState(''),[quotePackage,setQuotePackage]=useState(''),[quoteLead,setQuoteLead]=useState(''),[quoteClient,setQuoteClient]=useState(''),[quoteCompany,setQuoteCompany]=useState(''),[quoteProject,setQuoteProject]=useState(''),[quoteRequirements,setQuoteRequirements]=useState(''),[quoteLanguage,setQuoteLanguage]=useState('English');
 const [quotePhone,setQuotePhone]=useState(''),[quoteAddress,setQuoteAddress]=useState(''),[quoteAdvance,setQuoteAdvance]=useState(0),[quotePaymentNote,setQuotePaymentNote]=useState('');
 const [customItems,setCustomItems]=useState<QuoteItem[]>([]),[discountType,setDiscountType]=useState('amount'),[discountValue,setDiscountValue]=useState(0),[taxRate,setTaxRate]=useState(0);
 const [documentPreview,setDocumentPreview]=useState<{kind:'Quotation'|'Invoice';record:Quote|Invoice}|null>(null),[paperSize,setPaperSize]=useState('A4');
 const [paymentEditor,setPaymentEditor]=useState<{kind:'Quotation'|'Invoice';id:string}|null>(null),[paymentAmount,setPaymentAmount]=useState('0'),[paymentNote,setPaymentNote]=useState('');
 // SRINUMA PAYMENT TIMELINE UI V2
 const [paymentDate,setPaymentDate]=useState(''),[paymentTypeFilter,setPaymentTypeFilter]=useState('all');
 // SRINUMA BUSINESS OPS V1
 const [payments,setPayments]=useState<Payment[]>([]),[reportFrom,setReportFrom]=useState(''),[reportTo,setReportTo]=useState('');
 const [financeDraft,setFinanceDraft]=useState({entry_type:'income',paid_at:'',amount_inr:'',counterparty:'',category:'Customer Payment',purpose:'',employee_id:'',work_id:'',invoice_id:'',quotation_id:'',note:''});
 useEffect(()=>{setFinanceDraft(old=>({...old,paid_at:old.paid_at||new Date().toLocaleDateString('en-CA')}));},[]);
 // SRINUMA COMPLETED WORK BILLING V1 — display archived records without deleting Sheets data.
 const admin=user?.role==='admin';
 const isCompletedWork=(w:Work)=>w.status==='Completed'||w.status==='Approved';
 const isCompletedInvoice=(i:Invoice)=>{const status=String(i.status||'').trim().toLowerCase();const total=Number(i.grand_total_inr);const paid=Number(i.advance_paid_inr);return ['paid','fully paid','completed'].includes(status)&&String(i.advance_paid_inr??'').trim()!==''&&Number.isFinite(total)&&total>0&&Number.isFinite(paid)&&paid>=total;};
 const activeWorks=works.filter(w=>!isCompletedWork(w));
 const completedWorks=works.filter(isCompletedWork);
 const activeInvoices=invoices.filter(i=>!isCompletedInvoice(i));
 const completedInvoices=invoices.filter(isCompletedInvoice);
 const completedQuoteIds=new Set(completedInvoices.map(i=>i.quotation_id));
 const activeQuotations=quotations.filter(q=>!completedQuoteIds.has(q.quotation_id));
 const notifySave=(kind:'saving'|'success'|'error',title:string,detail?:string)=>{
  if(noticeTimerRef.current)clearTimeout(noticeTimerRef.current);
  setSaveNotice({kind,title,detail});
  if(kind!=='saving')noticeTimerRef.current=setTimeout(()=>setSaveNotice(null),kind==='error'?6500:3700);
 };
 const refresh=useCallback(async(actor:Actor)=>{setLoading(true);setError('');try{
   if(actor.role==='admin'){
     const [a,b,c,d,e,f,g,h,i]=await Promise.all([api<{leads:Lead[]}>('leads'),api<{employees:Employee[]}>('employees'),api<{works:Work[]}>('works'),api<{quotations:Quote[]}>('quotations'),api<{invoices:Invoice[]}>('invoices'),api<{packages:PriceRow[],features:FeatureRow[],extras:ExtraRow[]}>('catalog'),api<{settings:Record<string,string>}>('settings'),api<{files:FileRec[]}>('files'),api<{payments:Payment[]}>('finance')]);
     setLeads(a.leads);setEmployees(b.employees);setWorks(c.works);setQuotations(d.quotations);setInvoices(e.invoices);setPackages(f.packages);setFeatures(f.features);setExtras(f.extras);setFiles(h.files);setPayments(i.payments);setSettings(prev=>({...prev,...g.settings}));
   }else {const [w,f]=await Promise.all([api<{works:Work[]}>('works'),api<{files:FileRec[]}>('files')]);setWorks(w.works);setFiles(f.files);setLeads([]);setEmployees([]);setQuotations([]);setInvoices([]);setPayments([]);}
   setLastSync(new Date().toLocaleTimeString('en-IN'));return true;
 }catch(e){setError(e instanceof Error?e.message:'Sync failed');return false;}finally{setLoading(false);}},[]);
 useEffect(()=>{let live=true;api<{user:Actor|null}>('session').then(async r=>{if(!live)return;if(r.user){setUser(r.user);setPage(r.user.role==='employee'?'work':'dashboard');await refresh(r.user);}}).catch(()=>{}).finally(()=>{if(live)setReady(true);});return()=>{live=false;};},[refresh]);
 useEffect(()=>{if(!ready||!intro)return;openingSound();const t=setTimeout(()=>setIntro(false),2200);return()=>clearTimeout(t);},[ready,intro]);
 async function login(e:FormEvent){e.preventDefault();setError('');setLoading(true);try{const r=await api<{user:Actor}>('session',req('POST',{username,password}));setUser(r.user);setPassword('');setPage(r.user.role==='employee'?'work':'dashboard');setMore(false);await refresh(r.user);}catch(e){setError(e instanceof Error?e.message:'Login failed');}finally{setLoading(false);}}
  const loadProfile=useCallback(async()=>{setProfileError('');setProfileBusy(true);try{const r=await api<{profile:{id:string;name:string;username:string;role:string;email:string;phone:string;photo:string}}>('profile');setProfile(r.profile);setProfileName(r.profile.name);setProfileEmail(r.profile.email);setProfilePhone(r.profile.phone||'');setProfileCurrentPassword('');setUser(prev=>prev&&prev.name!==r.profile.name?{...prev,name:r.profile.name}:prev);}catch(e){setProfileError(e instanceof Error?e.message:'Cannot load profile');}finally{setProfileBusy(false);}},[]);
  useEffect(()=>{if(user)void loadProfile();},[user?.id,loadProfile]);
  async function saveProfile(e:FormEvent){e.preventDefault();if(!profile)return;setProfileBusy(true);setProfileError('');setProfileMessage('');try{const result=await api<{profile:{id:string;name:string;username:string;role:string;email:string;phone:string;photo:string}}>('profile',req('PATCH',{name:profileName,email:profileEmail,phone:profilePhone,current_password:profileCurrentPassword}));setProfile(result.profile);setProfileName(result.profile.name);setProfileEmail(result.profile.email);setProfilePhone(result.profile.phone||'');setProfileCurrentPassword('');setUser(old=>old?{...old,name:result.profile.name}:old);setProfileMessage('Profile updated in Google Sheet.');}catch(e){setProfileError(e instanceof Error?e.message:'Unable to save profile');}finally{setProfileBusy(false);}}
  async function setPhoto(next:string){setProfileBusy(true);setProfileError('');setProfileMessage('');try{const result=await api<{profile:{id:string;name:string;username:string;role:string;email:string;phone:string;photo:string}}>('profile',req('PUT',{photo:next}));setProfile(result.profile);setProfileMessage(next?'Square profile picture saved in Google Sheet.':'Profile picture removed.');}catch(e){setProfileError(e instanceof Error?e.message:'Unable to save picture');}finally{setProfileBusy(false);}}
  async function chooseProfilePhoto(file:File){
   if(!file.type.startsWith('image/')||file.size>10*1024*1024){setProfileError('Choose an image under 10 MB');return;}
   const objectUrl=URL.createObjectURL(file);
   try{
    const image=new Image();image.src=objectUrl;
    await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(Error('Could not read image'));});
    const shortest=Math.min(image.naturalWidth,image.naturalHeight);
    if(!shortest)throw Error('Invalid image');
    const canvas=document.createElement('canvas');
    const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas unavailable');
    // Center crop: 1:1 exactly, so no stretching on desktop or mobile.
    let encoded='';
    for(const side of [256,192,160,128]){
     canvas.width=side;canvas.height=side;ctx.fillStyle='#ffffff';ctx.fillRect(0,0,side,side);
     ctx.drawImage(image,(image.naturalWidth-shortest)/2,(image.naturalHeight-shortest)/2,shortest,shortest,0,0,side,side);
     for(const q of [0.78,0.65,0.5,0.35,0.22]){encoded=canvas.toDataURL('image/jpeg',q);if(encoded.length<=40000)break;}
     if(encoded.length<=40000)break;
    }
    if(encoded.length>41000)throw Error('Image could not be compressed under 30 KB. Try a simpler photo.');
    await setPhoto(encoded);
   }catch(e){setProfileError(e instanceof Error?e.message:'Cannot crop image');}
   finally{URL.revokeObjectURL(objectUrl);}
  }
 async function recoverPassword(e:FormEvent){
  e.preventDefault();setLoading(true);setError('');setRecoveryStatus('');
  try{
   if(!otpSent){
    const result=await api<{message:string}>('password-reset',req('POST',{action:'request',username}));
    setOtpSent(true);setRecoveryStatus(result.message);
   }else{
    const result=await api<{message:string}>('password-reset',req('POST',{action:'reset',username,otp:recoveryCode,newPassword:recoveryPassword}));
    setForgotPassword(false);setOtpSent(false);setRecoveryCode('');setRecoveryPassword('');setPassword('');setRecoveryStatus(result.message);
   }
  }catch(err){setError(err instanceof Error?err.message:'Password recovery failed');}
  finally{setLoading(false);}
 }
 function closeRecovery(){setForgotPassword(false);setOtpSent(false);setRecoveryCode('');setRecoveryPassword('');setError('');setRecoveryStatus('');}
  async function logout(){try{await api('session',{method:'DELETE'});}catch{}setUser(null);setNotifications([]);setShowNotifications(false);setLeads([]);setEmployees([]);setWorks([]);setQuotations([]);setInvoices([]);setFiles([]);setPayments([]);setPassword('');setPage('dashboard');setProfile(null);setError('');}
 // One active save at a time across Leads, Employees, Work, Billing, Payments, Settings and Catalog.
 async function perform(label:string,task:()=>Promise<unknown>){
  if(savingRef.current)return; // prevent rapid multi-click BEFORE React rerender
  if(lastSavedRef.current?.label===label&&Date.now()-lastSavedRef.current.at<1800)return; // accidental double-submit after fast response
  savingRef.current=true;setSaving(true);setLoading(true);setError('');
  notifySave('saving','Saving changes…','Please wait. Your data is being saved.');
  try{
   await task();
   lastSavedRef.current={label,at:Date.now()};
   const synced=user?await refresh(user):true;
   if(synced)notifySave('success','Saved Successfully',label);
   else notifySave('error','Saved — refresh needed','Your change was sent successfully, but reloading the latest data failed. Refresh before saving again.');
  }catch(e){
   const detail=e instanceof Error?e.message:'Operation failed';
   setError(detail);
   notifySave('error','Save not confirmed',detail+' — Check the existing record before retrying, to avoid duplicates.');
  }finally{savingRef.current=false;setSaving(false);setLoading(false);}
 }
 const selectedPackage=packages.find(p=>p.package_id===quotePackage),included=features.filter(f=>f.package_id===quotePackage&&f.included.toLowerCase()!=='false');
 const selectedSub=Number((selectedPackage?.base_price_inr||'0').replace(/[^0-9.-]/g,''))||0;
 const quoteSubtotal=selectedSub+customItems.reduce((sum,i)=>sum+Number(i.quantity)*Number(i.unit_price_inr),0);
 const discount=Math.min(quoteSubtotal,discountType==='percent'?quoteSubtotal*Math.min(100,discountValue)/100:discountValue);
 const quoteTotal=(quoteSubtotal-discount)*(1+taxRate/100);
 // SRINUMA LEADS AUTO-HIDE WHEN WORK ASSIGNED V1: keep Lead records in Google Sheets, show only enquiries without an assigned employee or linked Work.
 const assignedLeadIds=new Set(works.map(w=>w.lead_id).filter(Boolean));
 const approvedLeadIds=new Set(quotations.filter(q=>q.status==='Approved').map(q=>q.lead_id).filter(Boolean));
 const assignedLeads=leads.filter(l=>assignedLeadIds.has(l.lead_id));
 const waitingApprovalLeads=leads.filter(l=>!assignedLeadIds.has(l.lead_id)&&!approvedLeadIds.has(l.lead_id)&&l.status!=='Closed');
 const readyLeads=leads.filter(l=>!assignedLeadIds.has(l.lead_id)&&approvedLeadIds.has(l.lead_id)&&l.status!=='Closed');
 const unassignedLeads=leads.filter(l=>!assignedLeadIds.has(l.lead_id)&&l.status!=='Closed');
 const approvedLeads=leads.filter(l=>approvedLeadIds.has(l.lead_id));
 const matchLeadFilter=(l:Lead)=>leadFilter==='all'||(leadFilter==='assigned'&&assignedLeadIds.has(l.lead_id))||(leadFilter==='approved'&&approvedLeadIds.has(l.lead_id))||(leadFilter==='pending'&&!assignedLeadIds.has(l.lead_id)&&!approvedLeadIds.has(l.lead_id)&&l.status!=='Closed')||(leadFilter==='ready'&&!assignedLeadIds.has(l.lead_id)&&approvedLeadIds.has(l.lead_id)&&l.status!=='Closed')||(leadFilter==='balance'&&!assignedLeadIds.has(l.lead_id)&&l.status!=='Closed');
 const shownLeads=leads.filter(l=>matchLeadFilter(l)&&[l.customer_name,l.company_name,l.requirement,l.service_type,l.lead_id].join(' ').toLowerCase().includes(query.toLowerCase()));
 const leadCard=(filter:typeof leadFilter)=>{setLeadFilter(filter);setQuery('');setAssignLead('');};
 const openQuote=(lead?:Lead)=>{setQuoteLanguage(settings.quotation_default_language||'English');if(lead){setQuoteLead(lead.lead_id);setQuoteClient(lead.customer_name);setQuoteCompany(lead.company_name);setQuotePhone(lead.phone);setQuoteAddress(lead.address);setQuoteProject(lead.project_name);setQuoteRequirements(lead.requirement);setQuotePackage(packages.find(p=>p.service_type===lead.service_type&&p.tier.toLowerCase()==='basic')?.package_id||'');setCustomItems(lead.extra_features.split(',').map(x=>x.trim()).filter(Boolean).map(description=>({description,quantity:1,unit_price_inr:0,item_type:'extra'})));}else{setQuoteLead('');setQuoteClient('');setQuoteCompany('');setQuotePhone('');setQuoteAddress('');setQuoteProject('');setQuoteRequirements('');setQuotePackage('');setCustomItems([]);}setPage('quotations');setDiscountValue(0);setQuoteAdvance(0);setQuotePaymentNote('');};
 const createLead=()=>perform('Lead saved to Google Sheet',async()=>{const res=await api('leads',req('POST',leadDraft));setLeadDraft(emptyLead());setLeadForm(false);return res;});
 const createEmp=()=>perform('Employee created in Google Sheet',async()=>{await api('employees',req('POST',empDraft));setEmpForm(false);setEmpDraft({name:'',username:'',email:'',phone:'',password:'',work_category:'all'});});
 const createWork=()=>perform('Work assigned to employee',async()=>{
  if(referenceUploads.some(f=>f.size>8*1024*1024))throw Error('Each reference file must be 8 MB or smaller');
  if(referenceUploads.length){const config=await api<{configured:boolean}>('files?configuration=1');if(!config.configured)throw Error('Connect Google Drive first with scripts\connect-srinuma-drive.cjs before assigning work with files.');}
  const created=await api<{work:Work}>('works',req('POST',workDraft));
  setWorkDraft({lead_id:'',employee_id:'',title:'',description:'',due_date:''});setWorkForm(false);
  try{for(const f of referenceUploads)await uploadOne(created.work.work_id,f);if(referenceUrl.trim())await api('work-links',req('POST',{work_id:created.work.work_id,title:referenceTitle.trim()||'Customer reference link',url:referenceUrl.trim()}));}
  catch(e){setReferenceUploads([]);if(user)await refresh(user);throw Error('Work '+created.work.work_id+' was assigned, but a reference file/link could not be shared: '+(e instanceof Error?e.message:'Upload failed')+'. Re-open Work and attach the reference (do NOT assign the job again).');}
  setReferenceUploads([]);setReferenceUrl('');setReferenceTitle('');
 });
  // Assign from Leads with the same work/ref APIs as Work -> Assign.
  const assignFromLead=(lead:Lead)=>perform('Lead assigned and references shared',async()=>{
   if(!approvedLeadIds.has(lead.lead_id))throw Error('Approve client quotation before assigning work');
   if(assignedLeadIds.has(lead.lead_id))throw Error('Lead already has an assigned work.');
   if(!workDraft.employee_id)throw Error('Choose an employee');
   if(!workDraft.due_date)throw Error('Select a due date or enter duration');
   if(referenceUploads.some(f=>f.size>8*1024*1024))throw Error('Each reference file must be 8 MB or smaller');
   if(referenceUrl.trim()&&!/^https:\/\/\S+$/i.test(referenceUrl.trim()))throw Error('Reference link must be HTTPS');
   if(referenceUploads.length){const config=await api<{configured:boolean}>('files?configuration=1');if(!config.configured)throw Error('Google Drive must be connected before attaching files');}
   // Work is created before uploads. Never retry this whole operation if a later stage fails.
   const created=await api<{work:Work}>('works',req('POST',{
    lead_id:lead.lead_id,employee_id:workDraft.employee_id,
    title:workDraft.title.trim()||lead.project_name||SERVICE[lead.service_type]||'Customer work',
    description:workDraft.description.trim()||[lead.requirement,lead.extra_features].filter(Boolean).join('\n'),
    due_date:workDraft.due_date
   }));
   const workId=created.work.work_id;
   const failures:string[]=[];
   try{await api('leads',req('PATCH',{lead_id:lead.lead_id,assigned_employee_id:workDraft.employee_id}));}
   catch(e){failures.push('lead status: '+(e instanceof Error?e.message:'failed'));}
   for(const f of referenceUploads){try{await uploadOne(workId,f);}catch(e){failures.push('file '+f.name+': '+(e instanceof Error?e.message:'failed'));}}
   if(referenceUrl.trim()){try{await api('work-links',req('POST',{work_id:workId,title:referenceTitle.trim()||'Customer reference link',url:referenceUrl.trim()}));}catch(e){failures.push('reference URL: '+(e instanceof Error?e.message:'failed'));}}
   setAssignLead('');setLeadDuration('');setReferenceUploads([]);setReferenceUrl('');setReferenceTitle('');
   setWorkDraft({lead_id:'',employee_id:'',title:'',description:'',due_date:''});
   if(failures.length)throw Error('Work '+workId+' CREATED, but '+failures.join('; ')+'. Re-open Work and fix references. DO NOT assign this lead again.');
  });
 const saveQuote=()=>perform('Quotation saved to Google Sheet',async()=>{if(!selectedPackage)throw Error('Select a package');await api('quotations',req('POST',{lead_id:quoteLead,client_name:quoteClient,company_name:quoteCompany,client_phone:quotePhone,client_address:quoteAddress,advance_paid_inr:quoteAdvance,payment_note:quotePaymentNote,service_type:selectedPackage.service_type,package_id:quotePackage,project_name:quoteProject,requirements:quoteRequirements,language:quoteLanguage,items:[{description:'Package',quantity:1,unit_price_inr:0,item_type:'base'},...included.map(f=>({description:f.feature_description,quantity:1,unit_price_inr:0,item_type:'included'})),...customItems],discount_type:discountType,discount_value:discountValue,tax_rate_percent:taxRate}));setCustomItems([]);});
 const saveExtraRate=(x:ExtraRow)=>perform('Extra feature rate saved in Google Sheet',async()=>{
  if(extraCatalog.ambiguous.has(x.feature_id))throw Error('Duplicate ExtraFeature found; resolve duplicate rows in Google Sheets first.');
  const original=String(Number(x.suggested_price_inr.replace(/[^0-9.-]/g,''))||0);
  const input=(priceEdits[x.feature_id]??original).trim();
  if(!/^\d+(?:\.\d{1,2})?$/.test(input)||!Number.isFinite(Number(input))||Number(input)<0)throw Error('Enter a valid non-negative rate with at most 2 decimal places.');
  await api('catalog',req('PATCH',{kind:'extra',id:x.feature_id,price:Number(input)}));
  setOpenExtraRate('');
  setPriceEdits(v=>{const n={...v};delete n[x.feature_id];return n;});
 });
 // SRINUMA PACKAGE RATE CARDS V1 - admin-confirmed rate, stored in the existing Packages sheet.
 const saveFinalPackageRate=(p:PriceRow)=>perform('Final package rate updated in Google Sheet',async()=>{
  const original=String(Number(p.base_price_inr.replace(/[^0-9.-]/g,''))||0);
  const input=(priceEdits[p.package_id]??original).trim();
  if(!/^\d+(?:\.\d{1,2})?$/.test(input)||!Number.isFinite(Number(input))||Number(input)<=0)throw Error('Enter a valid final package rate greater than zero (maximum 2 decimal places).');
  await api('catalog',req('PATCH',{kind:'package',id:p.package_id,price:Number(input)}));
  setOpenPackageRate('');
  setPriceEdits(previous=>{const next={...previous};delete next[p.package_id];return next;});
 });
 // SRINUMA SETTINGS CONTROL CENTER V1 - admin-only, permanent Google Sheet preferences.
 const saveSettings=()=>perform('CRM customization saved in Google Sheet',()=>api('settings',req('PATCH',{
  theme_accent:settings.theme_accent,card_size:settings.card_size,company_name:settings.company_name,workspace_title:settings.workspace_title,
  company_address:settings.company_address,company_phone:settings.company_phone,quotation_default_language:settings.quotation_default_language,
  default_paper_size:settings.default_paper_size,default_work_due_days:settings.default_work_due_days,
  dashboard_leads:settings.dashboard_leads,dashboard_employees:settings.dashboard_employees,dashboard_work:settings.dashboard_work,dashboard_quotations:settings.dashboard_quotations,
  document_footer:settings.document_footer,brand_logo_data:settings.brand_logo_data||''
 })));
 const savePackageFeature=(f:FeatureRow)=>perform('Included feature saved in PackageFeatures Google Sheet',async()=>{
  const description=(featureEdits[f.feature_id]??f.feature_description).trim();
  if(description.length<3||description.length>240)throw Error('Package feature must be 3–240 characters.');
  await api('catalog',req('PATCH',{kind:'feature',id:f.feature_id,description}));
  setEditingFeature('');
 });
 const openNewWork=()=>{
  const n=Number(settings.default_work_due_days||0);
  if(Number.isInteger(n)&&n>0&&n<=365){const d=new Date();d.setDate(d.getDate()+n);const iso=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');setWorkDraft(v=>({...v,due_date:v.due_date||iso}));}
  setWorkForm(true);
 };
 useEffect(()=>{if(['A4','A5','Letter'].includes(settings.default_paper_size||''))setPaperSize(settings.default_paper_size);},[settings.default_paper_size]);
 const openPayment=(kind:'Quotation'|'Invoice',record:Quote|Invoice)=>{setPaymentEditor({kind,id:kind==='Invoice'?'invoice_id' in record?record.invoice_id:'':'quotation_id' in record?record.quotation_id:''});setPaymentAmount(record.advance_paid_inr==null||record.advance_paid_inr===''?'0':String(record.advance_paid_inr));setPaymentNote(record.payment_note||'');setPaymentDate(new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Kolkata'}));};
 const savePayment=()=>perform('Received payment saved to Google Sheet',async()=>{if(!paymentEditor)return;const amountValue=Number(paymentAmount);if(!Number.isFinite(amountValue)||amountValue<0||!/^\d+(?:\.\d{1,2})?$/.test(paymentAmount.trim()))throw Error('Enter a valid non-negative received amount (max 2 decimals)');await api(paymentEditor.kind==='Invoice'?'invoices':'quotations',req('PATCH',{[paymentEditor.kind==='Invoice'?'invoice_id':'quotation_id']:paymentEditor.id,advance_paid_inr:amountValue,payment_note:paymentNote,receipt_date:paymentDate}));setPaymentEditor(null);});
 const documentUrl=(embedded:boolean)=>{if(!documentPreview)return '';const kind=documentPreview.kind==='Invoice'?'invoice':'quote';const rec=documentPreview.record;const id='invoice_id' in rec?rec.invoice_id:rec.quotation_id;return '/api/srinuma/documents?type='+kind+'&id='+encodeURIComponent(id)+'&paper='+encodeURIComponent(paperSize)+(embedded?'&mode=preview':'');};

 const filteredPayments=useMemo(()=>payments.filter(p=>(!reportFrom||p.paid_at>=reportFrom)&&(!reportTo||p.paid_at<=reportTo)),[payments,reportFrom,reportTo]);
 const visiblePayments=filteredPayments.filter(p=>paymentTypeFilter==='all'||(paymentTypeFilter==='invoice'&&p.entry_type==='income'&&Boolean(p.invoice_id))||(paymentTypeFilter==='income'&&p.entry_type==='income'&&!p.invoice_id)||(paymentTypeFilter==='employee'&&p.entry_type==='expense'&&(Boolean(p.employee_id)||['employee payment','salary','freelancer'].includes(p.category.toLowerCase())))||(paymentTypeFilter==='expense'&&p.entry_type==='expense'&&!p.employee_id&&!['employee payment','salary','freelancer'].includes(p.category.toLowerCase())));
 const invoiceReceiptRows=(id:string)=>payments.filter(p=>p.entry_type==='income'&&p.invoice_id===id).sort((a,b)=>a.paid_at.localeCompare(b.paid_at)||a.payment_id.localeCompare(b.payment_id));
 const incomeReceived=visiblePayments.filter(p=>p.entry_type==='income').reduce((n,p)=>n+(Number(p.amount_inr)||0),0);
 const expensesPaid=visiblePayments.filter(p=>p.entry_type==='expense').reduce((n,p)=>n+(Number(p.amount_inr)||0),0);
 const outstandingInvoices=invoices.reduce((n,invoice)=>n+Math.max(0,Number(invoice.grand_total_inr||0)-Number(invoice.advance_paid_inr||0)),0);
 const monthlyCash=useMemo(()=>{const m=new Map<string,{month:string;income:number;expense:number}>();for(const p of visiblePayments){const month=p.paid_at.slice(0,7);if(!/^\d{4}-\d{2}$/.test(month))continue;const row=m.get(month)||{month,income:0,expense:0};row[p.entry_type==='income'?'income':'expense']+=Number(p.amount_inr)||0;m.set(month,row);}return [...m.values()].sort((a,b)=>a.month.localeCompare(b.month));},[filteredPayments,paymentTypeFilter]);
 const maxChart=Math.max(1,...monthlyCash.flatMap(m=>[m.income,m.expense]));
 const workDays=(w:Work)=>{if(!w.started_at)return 'Not started';const start=Date.parse(w.started_at);const end=w.approved_at?Date.parse(w.approved_at):Date.now();if(!Number.isFinite(start)||!Number.isFinite(end))return 'Unknown';const delta=Math.max(0,end-start)/86400000;return delta<1?'< 1 day':Math.ceil(delta)+' days';};
 const overdueDays=(w:Work)=>{if(!w.due_date||isCompletedWork(w))return 0;const due=new Date(w.due_date+'T23:59:59').getTime();return Number.isFinite(due)?Math.max(0,Math.ceil((Date.now()-due)/86400000)):0;};
 const saveFinance=()=>perform('Payment / expense recorded in Google Sheet',async()=>{if(!financeDraft.paid_at)throw Error('Select the transaction date');if(!financeDraft.amount_inr||Number(financeDraft.amount_inr)<=0)throw Error('Enter a positive amount');await api('finance',req('POST',financeDraft));setFinanceDraft(v=>({...v,amount_inr:'',purpose:'',note:''}));});
 const financeReport=()=>{if(reportFrom&&reportTo&&reportFrom>reportTo){setError('From date must be on or before To date');return;}const params=new URLSearchParams();if(reportFrom)params.set('from',reportFrom);if(reportTo)params.set('to',reportTo);window.open('/api/srinuma/finance/report?'+params.toString(),'_blank','noopener,noreferrer');};
 const style={'--accent':settings.theme_accent||'#25c8ff','--card-padding':settings.card_size==='compact'?'14px':'21px'} as CSSProperties;
 const print=()=>{const s=document.getElementById('paper-print-size');s?.remove();const el=document.createElement('style');el.id='paper-print-size';el.textContent=`@page { size: ${paperSize};margin:12mm }`;document.head.append(el);setTimeout(()=>window.print(),160);};
 async function uploadOne(workId:string,file:File){
  if(file.size>8*1024*1024)throw Error(file.name+' exceeds 8 MB');
  const b64=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||'').split(',')[1]||'');r.onerror=()=>reject(Error('Could not read '+file.name));r.readAsDataURL(file);});
  if(!b64)throw Error('Could not encode '+file.name);
  return api('files',req('POST',{work_id:workId,filename:file.name,mime_type:file.type,base64:b64}));
 }
 async function uploadFiles(workId:string,chosen:File[]){
  if(!chosen.length)return;
  await perform('Files uploaded to private Google Drive',async()=>{for(const f of chosen)await uploadOne(workId,f);});
 }
 async function saveSharedLink(workId:string){
  if(!workLinkUrl.trim()) {setError('Paste an HTTPS link first.');return;}
  await perform('Work link saved in Google Sheet',async()=>{await api('work-links',req('POST',{work_id:workId,title:workLinkTitle.trim()||'Shared work link',url:workLinkUrl.trim()}));setWorkLinkFor('');setWorkLinkTitle('');setWorkLinkUrl('');});
 }
 const fileLink=(f:FileRec)=>f.mime_type==='text/uri-list'?`/api/srinuma/work-links?open=${encodeURIComponent(f.file_id)}`:`/api/srinuma/files?download=${encodeURIComponent(f.file_id)}`;
 if(!ready||!brandReady)return <main className="boot-screen">Loading CRM…</main>;
 return <div className="app" style={style}>
 {intro&&<div className="opening" aria-label="Brand opening animation"><div className="opening-rings"/><div className="opening-particles"/><div className="opening-stage"><div className="pieces"><i/><i/><i/><i/><i/><i/></div><img className="opening-symbol" src={settings.brand_logo_data||"/srinuma-symbol.png"} alt=""/><div className="opening-name">{(settings.workspace_title||'SRINUMA HUB').slice(0,14).split('').map((letter,i)=><span key={i} style={{'--i':i} as CSSProperties}>{letter}</span>)}</div><div className="opening-sub">{settings.company_name||'DIGITAL SOLUTIONS'}</div><div className="opening-line"/></div></div>}
 {!user?<main className="auth-screen"><section className="auth-card"><img className="login-logo" src={settings.brand_logo_data||"/srinuma-logo.png"} alt={settings.company_name||"CRM Logo"}/><div className="auth-tag">{settings.workspace_title||'CRM WORKSPACE'} • SECURE LOGIN</div><h1>Welcome Back</h1><p>One login for admin and employees</p>{!forgotPassword?<><form onSubmit={login}><label>Username</label><input autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} required/><label>Password</label><div className="pass-field"><input autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} type={showPassword?'text':'password'} required/><button type="button" aria-label={showPassword?'Hide password':'Show password'} onClick={()=>setShowPassword(x=>!x)}>{showPassword?'◉':'◌'}</button></div><button className="btn btn-primary auth-submit" disabled={loading||saving}>Login →</button></form><button type="button" className="auth-forgot-link" onClick={()=>{setForgotPassword(true);setError('');setRecoveryStatus('');}}>Forgot password?</button></>:<form onSubmit={recoverPassword}><h2>Reset Password</h2><p className="hint">A secure code will be sent to your registered email.</p><label>Username</label><input autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} disabled={otpSent||loading} required/>{otpSent&&<><label>6-digit OTP</label><input value={recoveryCode} onChange={e=>setRecoveryCode(e.target.value.replace(/\D/g,'').slice(0,6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required/><label>New password (minimum 12 characters)</label><div className="pass-field"><input type={showNewPassword?'text':'password'} value={recoveryPassword} onChange={e=>setRecoveryPassword(e.target.value)} autoComplete="new-password" minLength={12} maxLength={200} required/><button type="button" aria-label={showNewPassword?'Hide password':'Show password'} onClick={()=>setShowNewPassword(x=>!x)}>{showNewPassword?'◉':'◌'}</button></div></>}<button className="btn btn-primary auth-submit" disabled={loading||saving}>{otpSent?'Verify OTP & Reset Password':'Send OTP'}</button><button type="button" className="auth-forgot-link" onClick={closeRecovery}>← Back to login</button></form>}{recoveryStatus&&<p className="hint" role="status">{recoveryStatus}</p>}{error&&<p className="form-error" role="alert">{error}</p>}<p className="hint">Use your administrator-provided account credentials.</p></section></main>:
 <><header className="topbar"><div className="topbrand"><img src={settings.brand_logo_data||"/srinuma-logo.png"} alt={settings.company_name||"Company Logo"}/></div><div className="top-actions"><button type="button" className="userpill" style={{cursor:"pointer",border:"none"}} onClick={()=>{setPage('profile');setMore(false);}} title="Open My Profile" aria-label="Open My Profile"><b>{profile?.name||user.name}</b><small>{admin?'Administrator':'Employee'}</small></button><button className="btn icon-action" onClick={()=>void refresh(user)} disabled={loading||saving} title="Refresh from Google Sheet">↻ <span className="desktop-text">Refresh</span></button><div className="srinuma-notification-holder"><button type="button" className="btn icon-action" aria-label="Notifications" aria-expanded={showNotifications} onClick={()=>{setShowNotifications(x=>!x);void loadNotifications();}}>🔔 {notifications.filter(n=>!n.read).length>0&&<span className="srinuma-notification-count">{notifications.filter(n=>!n.read).length}</span>}</button>{showNotifications&&<div className="srinuma-notification-panel" role="region" aria-label="Notifications"><div className="srinuma-notification-title"><strong>Notifications</strong><div className="actions"><button className="btn" type="button" disabled={!notifications.length} onClick={()=>void clearNotifications()}>Clear All</button><button className="btn" type="button" onClick={()=>setShowNotifications(false)}>×</button></div></div>{noticeError&&<p className="form-error">{noticeError}</p>}{notifications.length===0&&<p className="hint">No recent activity</p>}{notifications.map(n=><button type="button" key={n.id} className={'srinuma-notice '+(n.read?'':'unread')} onClick={()=>{void markNotice(n.id);setPage(n.page);setShowNotifications(false);setMore(false);}}><strong>{n.title}</strong><small>{n.detail}</small><small>{new Date(n.at).toLocaleString('en-IN')}</small></button>)}</div>}</div></div></header>
 <main className="workspace"><div className="pagehead"><div><span className="eyebrow">{settings.company_name||'SRINUMA DIGITAL SOLUTIONS'}</span><h1>{page==='invoices'||page==='billing_completed'?'Billing':tabs.find(t=>t[0]===page)?.[1]}</h1><p>{admin?'Manage your business operations from one workspace.':'Only your assigned work is shown.'}</p></div><span className="sync-info">↻ {lastSync?'Synced '+lastSync:'Sync pending'}</span></div>
 {error&&<p className="form-error" role="alert">{error}</p>}
  {page==='profile'&&<section className="panel" style={{maxWidth:760,margin:'0 auto',width:'100%'}} aria-label="My Profile">
   <div style={{display:'flex',alignItems:'center',gap:18,flexWrap:'wrap',marginBottom:20}}>
    <div style={{width:100,height:100,aspectRatio:'1 / 1',borderRadius:'50%',overflow:'hidden',flexShrink:0,background:'var(--accent)',color:'#081420',display:'grid',placeItems:'center',fontSize:28,fontWeight:800}} aria-label="Square profile picture">{profile?.photo?<img src={profile.photo} alt="My square profile photo" style={{width:'100%',height:'100%',aspectRatio:'1 / 1',objectFit:'cover',display:'block'}}/>:(user.name.trim().split(/\s+/).slice(0,2).map(n=>n[0]?.toUpperCase()).join(''))}</div>
    <div><span className="eyebrow">SRINUMA HUB ACCOUNT</span><h2 style={{margin:'4px 0'}}>{profile?.name||user.name}</h2><span className="tag">{admin?'Administrator':'Employee'}</span></div>
   </div>
   {profileBusy&&!profile&&<p className="hint">Loading profile…</p>}
   {profileError&&<p className="form-error" role="alert">{profileError}</p>}
   {profileMessage&&<p role="status" style={{color:'var(--accent)'}}>{profileMessage}</p>}
   {profile&&<>
    <div className="actions" style={{marginBottom:18}}>
     <label className="btn file-label">📷 Add / Change 1:1 Photo<input type="file" accept="image/png,image/jpeg,image/webp,image/heic" disabled={profileBusy} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void chooseProfilePhoto(file);}}/></label>
     {profile.photo&&<button className="btn" type="button" disabled={profileBusy} onClick={()=>void setPhoto('')}>Remove Photo</button>}
    </div>
    <p className="hint">Photo automatically center-crops to 1:1 square and is compressed before saving in Google Sheets. Refresh to verify it stays saved.</p>
    <form onSubmit={saveProfile} style={{marginTop:20}}>
     <div className="field-grid">
      <Field label="Username"><input value={profile.username} readOnly aria-readonly="true"/></Field>
      <Field label="Role (Admin controlled)"><input value={admin?'Administrator':'Employee'} readOnly aria-readonly="true"/></Field>
      <Field label="Full Name"><input required maxLength={120} value={profileName} onChange={e=>setProfileName(e.target.value)}/></Field>
      <Field label={admin?'Contact Email':'Registered / Recovery Email'}><input type="email" required maxLength={254} value={profileEmail} onChange={e=>setProfileEmail(e.target.value)}/></Field>
      <Field label="Phone Number" wide><input type="tel" maxLength={25} value={profilePhone} placeholder="+91 9876543210" onChange={e=>setProfilePhone(e.target.value)}/></Field>
      {!admin&&profileEmail.trim().toLowerCase()!==profile.email.trim().toLowerCase()&&<Field label="Current Password (required to change email)" wide><input type="password" autoComplete="current-password" value={profileCurrentPassword} onChange={e=>setProfileCurrentPassword(e.target.value)}/></Field>}
     </div>
     {admin&&<p className="hint">Admin contact email is separate from the protected Forgot Password recovery address in .env.local.</p>}
     <p className="hint">Employee profile updates save to Employees Sheet. Admin contact details and profile photos save to Settings Sheet. Only Admin can manage roles, usernames and access.</p>
     <div className="actions"><button className="btn btn-primary" type="submit" disabled={profileBusy||profileName.trim().length<2||!profileEmail.includes('@')}>Save My Profile to Sheet</button><button className="btn" type="button" onClick={()=>void loadProfile()} disabled={profileBusy}>↻ Refresh Profile</button><button className="btn" type="button" onClick={()=>void logout()}>Log Out</button></div>
    </form>
   </>}
  </section>}
 {page==='dashboard'&&admin&&<><div className="metrics">{settings.dashboard_leads!=='false'&&<Metric label="Total Leads" value={leads.length} icon="◈"/>}{settings.dashboard_employees!=='false'&&<Metric label="Employees" value={employees.filter(x=>x.active).length} icon="♙"/>}{settings.dashboard_work!=='false'&&<Metric label="Open Work" value={activeWorks.length} icon="☷"/>}{settings.dashboard_quotations!=='false'&&<Metric label="Quotations" value={quotations.length} icon="▤"/>}<Metric label="Leads Assigned" value={assignedLeads.length} icon="✓"/><Metric label="Approved – Not Assigned" value={readyLeads.length} icon="☷"/><Metric label="Client Approval Pending" value={waitingApprovalLeads.length} icon="⌛"/><Metric label="Unassigned / Balance Leads" value={unassignedLeads.length} icon="◈"/></div><section className="panel"><h2>Quick Actions</h2><div className="actions"><button className="btn btn-primary" onClick={()=>{setPage('leads');setLeadForm(true);}}>＋ Add Lead</button><button className="btn" onClick={()=>{setPage('employees');setEmpForm(true);}}>＋ Employee</button><button className="btn" onClick={()=>{setPage('work');openNewWork();}}>＋ Assign Work</button><button className="btn" onClick={()=>openQuote()}>＋ Quotation</button></div><p className="hint">All new records are saved to the Srinuma Google Sheet. Refresh reloads them without logging out.</p></section>
 <section className="panel ops-panel"><div className="ops-title"><h2>Work Start & Deadlines</h2><button className="btn" onClick={()=>setPage('work')}>Manage Work</button></div><div className="ops-table-wrap"><table className="ops-table"><thead><tr><th>Work / Employee</th><th>Started</th><th>Time Taken</th><th>Due Date</th><th>Current Status</th></tr></thead><tbody>{activeWorks.map(w=><tr key={w.work_id}><td><b>{w.work_id} – {w.title}</b><small>{employees.find(e=>e.employee_id===w.employee_id)?.name||w.employee_id}</small></td><td>{w.started_at?new Date(w.started_at).toLocaleString('en-IN'):'Not started / unrecorded'}</td><td>{workDays(w)}</td><td>{w.due_date||'Not set'}{overdueDays(w)>0&&<strong className="ops-overdue"> • Overdue {overdueDays(w)} days</strong>}</td><td>{w.status}</td></tr>)}</tbody></table>{activeWorks.length===0&&<p>No active work. Completed work is in Work → Completed.</p>}</div></section>
 <section className="panel ops-panel"><div className="ops-title"><h2>Cash Flow Snapshot</h2><button className="btn" onClick={()=>setPage('payments')}>Open Payments & Chart</button></div><div className="ops-summary"><div><span>Recorded Income</span><b>{money(payments.filter(p=>p.entry_type==='income').reduce((n,p)=>n+Number(p.amount_inr||0),0))}</b></div><div><span>Paid Expenses</span><b>{money(payments.filter(p=>p.entry_type==='expense').reduce((n,p)=>n+Number(p.amount_inr||0),0))}</b></div><div><span>Invoice Balance Due</span><b>{money(outstandingInvoices)}</b></div></div><p className="hint">Cash-based figures use recorded Payments entries only. Invoice outstanding balances are separate.</p></section></>}
 {page==='leads'&&admin&&<>
 <div className="srinuma-summary-grid" role="group" aria-label="Lead status summary and filters">
  <SummaryTile label="Total Leads" value={leads.length} detail="Every enquiry" active={leadFilter==='all'} onClick={()=>leadCard('all')}/>
  <SummaryTile label="Client Approved" value={approvedLeads.length} detail="Approved quotations" active={leadFilter==='approved'} onClick={()=>leadCard('approved')}/>
  <SummaryTile label="Work Assigned" value={assignedLeads.length} detail="Linked work created" active={leadFilter==='assigned'} onClick={()=>leadCard('assigned')}/>
  <SummaryTile label="Approval Pending" value={waitingApprovalLeads.length} detail="Awaiting client decision" active={leadFilter==='pending'} onClick={()=>leadCard('pending')}/>
  <SummaryTile label="Ready to Assign" value={readyLeads.length} detail="Approved but unassigned" active={leadFilter==='ready'} onClick={()=>leadCard('ready')}/>
  <SummaryTile label="Balance Leads" value={unassignedLeads.length} detail="Open leads without work" active={leadFilter==='balance'} onClick={()=>leadCard('balance')}/>
 </div>
 <div className="srinuma-filter-feedback" role="status">Showing {shownLeads.length} of {leads.length} leads • {leadFilter==='all'?'All leads':leadFilter==='approved'?'Client Approved':leadFilter==='assigned'?'Work Assigned':leadFilter==='pending'?'Approval Pending':leadFilter==='ready'?'Ready to Assign':'Balance Leads'}{query.trim()?' • Search active':''}</div>
 <div className="toolbar"><span className="hint">Tap a summary card to filter enquiries. Approval must be recorded on the linked quotation before assigning work.</span><input placeholder="Search leads, company or project…" value={query} onChange={e=>setQuery(e.target.value)}/><button className="btn btn-primary" onClick={()=>setLeadForm(x=>!x)}>＋ New Enquiry</button></div>{leadForm&&<section className="panel inset-panel"><h2>New Customer Enquiry</h2><div className="field-grid"><Field label="Customer Name"><input value={leadDraft.customer_name} onChange={e=>setLeadDraft({...leadDraft,customer_name:e.target.value})}/></Field><Field label="Company"><input value={leadDraft.company_name} onChange={e=>setLeadDraft({...leadDraft,company_name:e.target.value})}/></Field><Field label="Phone"><input value={leadDraft.phone} onChange={e=>setLeadDraft({...leadDraft,phone:e.target.value})}/></Field><Field label="Address"><input value={leadDraft.address} onChange={e=>setLeadDraft({...leadDraft,address:e.target.value})}/></Field><Field label="Enquiry For"><select value={leadDraft.service_type} onChange={e=>setLeadDraft({...leadDraft,service_type:e.target.value})}>{Object.entries(SERVICE).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select></Field><Field label="Project Name"><input value={leadDraft.project_name} onChange={e=>setLeadDraft({...leadDraft,project_name:e.target.value})}/></Field><Field label="Customer Requirement" wide><textarea value={leadDraft.requirement} onChange={e=>setLeadDraft({...leadDraft,requirement:e.target.value})}/></Field><Field label="Extra Features" wide><textarea value={leadDraft.extra_features} onChange={e=>setLeadDraft({...leadDraft,extra_features:e.target.value})}/></Field></div><div className="actions"><button className="btn btn-primary" disabled={loading||saving} onClick={()=>void createLead()}>Save to Google Sheet</button><button className="btn" onClick={()=>setLeadForm(false)}>Cancel</button></div></section>}<div className="card-grid">{shownLeads.map(l=><article className="panel lead-card" key={l.lead_id}><div className="card-head"><div><span className="eyebrow">{l.lead_id}</span><h3>{l.company_name||l.customer_name}</h3><small>{l.customer_name} • {date(l.created_at)}</small></div><span className="tag glow">{assignedLeadIds.has(l.lead_id)?"Work Assigned":approvedLeadIds.has(l.lead_id)?"Client Approved":l.status==="Closed"?"Closed":"Awaiting Client Approval"}</span></div><div className="lead-type">Enquiry For <strong>{SERVICE[l.service_type]||l.service_type}</strong></div><div className="requirement"><b>Customer requested</b><p>{l.requirement}</p></div>{l.extra_features&&<div className="extras"><b>Extras:</b> {l.extra_features}</div>}<div className="actions"><a className={`btn ${l.phone?'':'disabled'}`} href={l.phone?`tel:${l.phone}`:undefined}>☎ Call</a><a className={`btn ${l.phone?'':'disabled'}`} target="_blank" rel="noopener noreferrer" href={l.phone?`https://wa.me/${l.phone.replace(/\D/g,'')}`:undefined}>WhatsApp</a><button className="btn" disabled={loading||saving} onClick={()=>void perform('Lead status updated',()=>api('leads',req('PATCH',{lead_id:l.lead_id,status:l.status==='New'?'Follow-up':l.status==='Follow-up'?'Converted':'New'})))}>Update</button><button className="btn btn-primary" onClick={()=>openQuote(l)}>Prepare Quote</button></div>{!approvedLeadIds.has(l.lead_id)&&!assignedLeadIds.has(l.lead_id)&&<p className="hint">Client approval pending. Prepare quotation and mark it Approved only after client confirms, then assign work.</p>}<div className="actions"><button className="btn" disabled={!approvedLeadIds.has(l.lead_id)||assignedLeadIds.has(l.lead_id)||l.status==="Closed"} title={!approvedLeadIds.has(l.lead_id)?"Approve linked client quotation first":""} onClick={()=>{const open=assignLead!==l.lead_id;setAssignLead(open?l.lead_id:'');setLeadDuration('');setReferenceUploads([]);setReferenceUrl('');setReferenceTitle('');setWorkDraft({lead_id:l.lead_id,employee_id:'',title:l.project_name||SERVICE[l.service_type]||'Customer work',description:[l.requirement,l.extra_features].filter(Boolean).join('\n'),due_date:''});}}>♙ Assign Employee</button>{l.assigned_employee_id&&<span className="tag">Assigned: {employees.find(e=>e.employee_id===l.assigned_employee_id)?.name||l.assigned_employee_id}</span>}</div>{assignLead===l.lead_id&&<section className="srinuma-lead-assign panel inset-panel" aria-label="Assign lead work with references">
 <h3>Assign Work — {l.project_name||l.customer_name}</h3>
 <div className="field-grid">
 <Field label="Assign Employee"><select value={workDraft.employee_id} onChange={e=>setWorkDraft(v=>({...v,employee_id:e.target.value}))}><option value="">Choose employee</option>{employees.filter(e=>e.active&&(!e.work_category||e.work_category==='all'||e.work_category===l.service_type)).map(e=><option value={e.employee_id} key={e.employee_id}>{e.name} ({e.employee_id})</option>)}</select></Field>
 <Field label="Work Title"><input value={workDraft.title} onChange={e=>setWorkDraft(v=>({...v,title:e.target.value}))}/></Field>
 <Field label="Duration (Days)"><input type="number" min="1" max="365" step="1" value={leadDuration} placeholder="e.g. 7" onChange={e=>{const raw=e.target.value;setLeadDuration(raw);const days=Number(raw);if(!raw||!Number.isInteger(days)||days<1||days>365)return;const d=new Date();d.setDate(d.getDate()+days);setWorkDraft(v=>({...v,due_date:[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}));}}/></Field>
 <Field label="Due Date"><input type="date" value={workDraft.due_date} onChange={e=>setWorkDraft(v=>({...v,due_date:e.target.value}))}/></Field>
 <Field label="Customer Requirements / Instructions" wide><textarea value={workDraft.description} onChange={e=>setWorkDraft(v=>({...v,description:e.target.value}))}/></Field>
 <Field label="Reference Files" wide><input type="file" multiple accept=".png,.jpg,.jpeg,.webp,.pdf,.svg,.zip,.psd,.ai" onChange={e=>setReferenceUploads(Array.from(e.target.files||[]))}/><small>Up to 8 MB per file. Google Drive must be connected.</small>{referenceUploads.length>0&&<small>{referenceUploads.map(f=>f.name).join(', ')}</small>}</Field>
 <Field label="Reference Link (HTTPS)" wide><input type="url" value={referenceUrl} placeholder="https://drive.google.com/..." onChange={e=>setReferenceUrl(e.target.value)}/><input value={referenceTitle} placeholder="Link label (optional)" onChange={e=>setReferenceTitle(e.target.value)}/></Field>
 </div>
 <div className="actions"><button className="btn btn-primary" disabled={loading||saving||!workDraft.employee_id||!workDraft.due_date} onClick={()=>void assignFromLead(l)}>Assign Work + Share References</button><button className="btn" disabled={loading||saving} onClick={()=>{setAssignLead('');setReferenceUploads([]);setReferenceUrl('');setReferenceTitle('');setLeadDuration('');}}>Cancel</button></div>
 </section>}</article>)}</div>{!shownLeads.length&&<Empty text="No leads match this filter. Select Total Leads to view every enquiry."/>}</>}
 {page==='employees'&&admin&&<><div className="toolbar"><p>Create employee login access. Customer contact data stays admin-only.</p><button className="btn btn-primary" onClick={()=>setEmpForm(x=>!x)}>＋ Add Employee</button></div>{empForm&&<section className="panel inset-panel"><h2>Create Employee</h2><div className="field-grid"><Field label="Name"><input value={empDraft.name} onChange={e=>setEmpDraft({...empDraft,name:e.target.value})}/></Field><Field label="Username"><input value={empDraft.username} onChange={e=>setEmpDraft({...empDraft,username:e.target.value})}/></Field><Field label="Email"><input type="email" required value={empDraft.email} onChange={e=>setEmpDraft({...empDraft,email:e.target.value})}/></Field><Field label="Phone"><input type="tel" value={empDraft.phone} onChange={e=>setEmpDraft({...empDraft,phone:e.target.value})}/></Field><Field label="Work Category"><select value={empDraft.work_category} onChange={e=>setEmpDraft({...empDraft,work_category:e.target.value})}><option value="all">All Projects</option>{Object.entries(SERVICE).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></Field><Field label="Employee Password (12+ chars)" wide><div className="pass-field"><input autoComplete="new-password" type={showNewPassword?'text':'password'} value={empDraft.password} onChange={e=>setEmpDraft({...empDraft,password:e.target.value})}/><button type="button" aria-label="Show or hide employee password" onClick={()=>setShowNewPassword(x=>!x)}>{showNewPassword?'◉':'◌'}</button></div></Field></div><p className="hint">You can view the password while creating it. After Save, only its salted hash is stored; the original password cannot be retrieved from the Sheet.</p><div className="actions"><button className="btn btn-primary" disabled={loading||saving} onClick={()=>void createEmp()}>Create Employee</button><button className="btn" onClick={()=>setEmpForm(false)}>Cancel</button></div></section>}<div className="card-grid">{employees.map(e=><article className="panel" key={e.employee_id}><span className="eyebrow">{e.employee_id}</span><h3>{e.name}</h3><p>@{e.username} • {e.work_category||'all'} • {e.active?'Active':'Disabled'}</p><p>{e.email||'Email not provided'} {e.phone&&' • '+e.phone}</p><p>Assigned works: {works.filter(w=>w.employee_id===e.employee_id).length}</p><div className="actions"><a className={'btn '+(!e.phone?'disabled':'')} aria-disabled={!e.phone} href={e.phone?'tel:'+e.phone.replace(/[^+\d]/g,''):undefined}>☎ Call</a><a className={'btn '+(!e.email?'disabled':'')} aria-disabled={!e.email} href={e.email?'mailto:'+e.email:undefined}>✉ Mail</a><button className="btn" type="button" onClick={()=>{setEditEmployee(e);setEditEmployeeDraft({name:e.name,email:e.email||'',phone:e.phone||'',work_category:e.work_category||'all'});}}>✎ Edit</button></div><button className="btn" disabled={loading||saving} onClick={()=>void perform('Employee status updated',()=>api('employees',req('PATCH',{employee_id:e.employee_id,active:!e.active})))}>{e.active?'Disable Access':'Enable Access'}</button></article>)}</div>{!employees.length&&<Empty text="No cloud employees. Previous demo employees are not copied automatically."/>}</>}
 {page==='employees'&&admin&&editEmployee&&<div className="doc-overlay" role="presentation" onClick={e=>{if(e.target===e.currentTarget)setEditEmployee(null);}}><section className="panel" role="dialog" aria-modal="true" aria-label="Edit Employee" style={{width:'min(540px,94vw)',maxHeight:'90vh',overflowY:'auto',margin:'auto'}}><h2>Edit Employee — {editEmployee.username}</h2><div className="field-grid"><Field label="Name"><input value={editEmployeeDraft.name} onChange={e=>setEditEmployeeDraft(v=>({...v,name:e.target.value}))}/></Field><Field label="Email"><input type="email" value={editEmployeeDraft.email} onChange={e=>setEditEmployeeDraft(v=>({...v,email:e.target.value}))}/></Field><Field label="Phone"><input type="tel" value={editEmployeeDraft.phone} onChange={e=>setEditEmployeeDraft(v=>({...v,phone:e.target.value}))}/></Field><Field label="Work Category"><select value={editEmployeeDraft.work_category} onChange={e=>setEditEmployeeDraft(v=>({...v,work_category:e.target.value}))}><option value="all">All Projects</option>{Object.entries(SERVICE).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></Field></div><div className="actions"><button className="btn btn-primary" disabled={loading||saving} onClick={()=>void perform('Employee profile updated',async()=>{await api('employees',req('PATCH',{employee_id:editEmployee.employee_id,...editEmployeeDraft}));setEditEmployee(null);})}>Save Changes</button><button className="btn" onClick={()=>setEditEmployee(null)}>Cancel</button></div></section></div>}
 {page==='work'&&<>
 {admin&&<>
 <div className="srinuma-summary-grid" role="group" aria-label="Work status summary and filters">
  <SummaryTile label="Total Work" value={works.length} detail="All created work" active={workView==='all'} onClick={()=>{setWorkView('all');setWorkForm(false);}}/>
  <SummaryTile label="Assigned / Active" value={activeWorks.length} detail="Still in progress or review" active={workView==='active'} onClick={()=>setWorkView('active')}/>
  <SummaryTile label="To Be Assigned" value={readyLeads.length} detail="Approved leads without work" active={false} onClick={()=>{setPage('leads');leadCard('ready');setWorkForm(false);}}/>
  <SummaryTile label="Completed Work" value={completedWorks.length} detail="Admin approved jobs" active={workView==='completed'} onClick={()=>{setWorkView('completed');setWorkForm(false);}}/>
 </div>
 <p className="srinuma-filter-feedback">“To Be Assigned” counts approved leads that do not have a work record yet. All Work counts saved work records.</p>
 </>}
 <div className="toolbar"><p>{admin?'Assign jobs, attach client reference files, and approve or request rework.':'Download assigned references, upload finished files, and submit for admin review.'}</p>{admin&&<button className="btn btn-primary" onClick={()=>{setWorkView('active');openNewWork();}}>＋ Assign Work</button>}</div>
 {!admin&&<section className="srinuma-archive-switch" aria-label="My work sections"><div className="srinuma-archive-buttons" role="tablist" aria-label="All, pending and completed work"><button type="button" role="tab" aria-selected={workView==='all'} className={workView==='all'?'active':''} onClick={()=>setWorkView('all')}>All Work <span>{works.length}</span></button><button type="button" role="tab" aria-selected={workView==='active'} className={workView==='active'?'active':''} onClick={()=>setWorkView('active')}>Pending <span>{activeWorks.length}</span></button><button type="button" role="tab" aria-selected={workView==='completed'} className={workView==='completed'?'active':''} onClick={()=>setWorkView('completed')}>Completed <span>{completedWorks.length}</span></button></div><p>{workView==='completed'?'Only admin-approved completed work.':workView==='all'?'All jobs assigned to you.':'Assigned, in progress, submitted and rework jobs.'}</p></section>}
 {admin&&<section className="srinuma-archive-switch" aria-label="Work sections"><div className="srinuma-archive-buttons" role="tablist" aria-label="All, active and completed work"><button type="button" role="tab" aria-selected={workView==='all'} className={workView==='all'?'active':''} onClick={()=>{setWorkView('all');setWorkForm(false);}}>All Work <span>{works.length}</span></button><button type="button" role="tab" aria-selected={workView==='active'} className={workView==='active'?'active':''} onClick={()=>setWorkView('active')}>☷ Active Work <span>{activeWorks.length}</span></button><button role="tab" aria-selected={workView==='completed'} className={workView==='completed'?'active':''} onClick={()=>{setWorkView('completed');setWorkForm(false);}}>✓ Completed <span>{completedWorks.length}</span></button></div><p>{workView==='all'?'All saved work records (active and completed).':workView==='active'?'Assigned, in-progress, submitted and rework jobs.':'Admin-approved jobs and finished files. Older Approved rows can be marked Completed in Google Sheets here.'}</p></section>}
 {admin&&workView==='active'&&workForm&&<section className="panel inset-panel"><h2>New Work Assignment</h2>
  <div className="field-grid">
   <Field label="Work Title"><input value={workDraft.title} onChange={e=>setWorkDraft({...workDraft,title:e.target.value})}/></Field>
   <Field label="Employee"><select value={workDraft.employee_id} onChange={e=>setWorkDraft({...workDraft,employee_id:e.target.value})}><option value="">Select employee</option>{employees.filter(e=>e.active).map(e=><option key={e.employee_id} value={e.employee_id}>{e.name} – {e.employee_id}</option>)}</select></Field>
   <Field label="Lead / Customer"><select value={workDraft.lead_id} onChange={e=>setWorkDraft({...workDraft,lead_id:e.target.value})}><option value="">General work</option>{readyLeads.map(l=><option value={l.lead_id} key={l.lead_id}>{l.company_name||l.customer_name} — {l.lead_id} (Approved)</option>)}</select></Field>
   {/* SRINUMA ANIME WORK UX V1: choose duration or select an exact date */}
   <Field label="Work Duration (days)"><input type="number" min="1" max="365" step="1" placeholder="e.g. 7 days" aria-label="Work duration in days" onChange={e=>{const raw=e.target.value;if(!raw)return;const days=Number(raw);if(!Number.isInteger(days)||days<1||days>365)return;const d=new Date();d.setDate(d.getDate()+days);const due=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');setWorkDraft(v=>({...v,due_date:due}));}}/><small>Enter 1–365 days to fill Due Date automatically. You can also choose a date directly.</small></Field>
   <Field label="Due Date"><input type="date" value={workDraft.due_date} onChange={e=>setWorkDraft({...workDraft,due_date:e.target.value})}/></Field>
   <Field label="Customer Requirements / Instructions" wide><textarea value={workDraft.description} onChange={e=>setWorkDraft({...workDraft,description:e.target.value})}/></Field>
   <Field label="Customer Logo / Reference Files" wide><input type="file" multiple accept=".png,.jpg,.jpeg,.webp,.pdf,.svg,.zip,.psd,.ai" onChange={e=>setReferenceUploads(Array.from(e.target.files||[]))}/><small>Files upload to private Google Drive on Assign. 8 MB max each.</small>{referenceUploads.length>0&&<small>Selected: {referenceUploads.map(f=>f.name).join(', ')}</small>}</Field>
   <Field label="OR Share Customer Reference URL" wide><input type="url" inputMode="url" placeholder="https://drive.google.com/..." value={referenceUrl} onChange={e=>setReferenceUrl(e.target.value)}/><input placeholder="Link label (e.g., Brand guidelines)" value={referenceTitle} onChange={e=>setReferenceTitle(e.target.value)}/><small>Optional. Use a HTTPS URL with access granted to the assigned employee. You may include BOTH files and a link.</small></Field>
  </div>
  <div className="actions"><button className="btn btn-primary" disabled={loading||saving} onClick={()=>void createWork()}>Assign + Send References</button><button className="btn" disabled={loading||saving} onClick={()=>{setWorkForm(false);setReferenceUploads([]);setReferenceUrl('');setReferenceTitle('');}}>Cancel</button></div>
 </section>}
 <div className="card-grid">{(workView==='all'?works:workView==='completed'?completedWorks:activeWorks).map(w=>{const refs=files.filter(f=>f.work_id===w.work_id&&!f.uploaded_by_employee_id);const outputs=files.filter(f=>f.work_id===w.work_id&&Boolean(f.uploaded_by_employee_id));const freshOutput=outputs.some(f=>w.status!=='Rework'||Date.parse(f.created_at)>Date.parse(w.updated_at));const lead=admin?leads.find(l=>l.lead_id===w.lead_id):undefined;const worker=admin?employees.find(e=>e.employee_id===w.employee_id)?.name||'Employee':user.name;const completedCard=Boolean(admin&&workView==='completed');const showWorkDetails=!completedCard||expandedCompleteWork===w.work_id;return <article className={completedCard?'panel srinuma-completed-work-card':'panel'} key={w.work_id}>
  <div className="card-head"><div><span className="eyebrow">{completedCard?'Completed Project':w.work_id}</span><h3>{completedCard?(lead?.customer_name||lead?.company_name||w.title):w.title}</h3><small>{completedCard?`Project: ${lead?.project_name||w.title} • Completed by ${worker}`:worker+' • Due '+(w.due_date||'not set')}</small></div><span className="tag glow">{completedCard?'✓ Completed':w.status}</span></div>
  {completedCard&&<button className="btn srinuma-completed-toggle" type="button" aria-expanded={showWorkDetails} onClick={()=>setExpandedCompleteWork(showWorkDetails?'':w.work_id)}>{showWorkDetails?'Hide Details':'View Requirements & Files ↓'}</button>}
  {showWorkDetails&&<>
  <p>{w.description}</p><div className="ops-work-meta"><span><b>Started:</b> {w.started_at?new Date(w.started_at).toLocaleString('en-IN'):'Not started'}</span><span><b>Days taken:</b> {workDays(w)}</span><span><b>Due:</b> {w.due_date||'Not set'}</span>{overdueDays(w)>0&&<strong className="ops-overdue">Overdue {overdueDays(w)} days</strong>}</div>{admin&&!isCompletedWork(w)&&<button className="btn" disabled={loading||saving} onClick={()=>{const next=window.prompt('Due date (YYYY-MM-DD), or empty to clear',w.due_date||'');if(next!==null)void perform('Work due date updated',()=>api('works',req('PATCH',{work_id:w.work_id,due_date:next.trim()})));}}>Edit Due Date</button>}{w.admin_feedback&&<div className="extras"><strong>{w.status==='Rework'?'Corrections required':'Admin review feedback'}:</strong> {w.admin_feedback}</div>}
  <h3 className="file-section-title">📎 Customer Reference Files / URLs ({refs.length})</h3>
  {refs.length?refs.map(f=><p className="mini" key={f.file_id}><a className="file-link" href={fileLink(f)} target={f.mime_type==='text/uri-list'?'_blank':undefined} rel={f.mime_type==='text/uri-list'?'noopener noreferrer':undefined}>{f.mime_type==='text/uri-list'?'↗ Open Link: ':'↓ Download: '}{f.original_filename}</a></p>):<p className="hint">No customer references attached yet.</p>}
  {admin&&!isCompletedWork(w)&&<><label className="btn file-label">＋ Attach Customer Files<input type="file" multiple accept=".png,.jpg,.jpeg,.webp,.pdf,.svg,.zip,.psd,.ai" disabled={loading||saving} onChange={e=>{const chosen=Array.from(e.target.files||[]);e.target.value='';void uploadFiles(w.work_id,chosen);}}/></label><button className="btn" type="button" onClick={()=>{setWorkLinkFor(workLinkFor===w.work_id?'':w.work_id);setWorkLinkTitle('Customer reference link');setWorkLinkUrl('');}}>＋ Share Reference URL</button></>}
  <h3 className="file-section-title">✅ Employee Finished Files / URLs ({outputs.length})</h3>
  {outputs.length?outputs.map(f=><p className="mini" key={f.file_id}><a className="file-link" href={fileLink(f)} target={f.mime_type==='text/uri-list'?'_blank':undefined} rel={f.mime_type==='text/uri-list'?'noopener noreferrer':undefined}>{f.mime_type==='text/uri-list'?'↗ Open Finished Link: ':'↓ Download: '}{f.original_filename}</a></p>):<p className="hint">No completed files or links uploaded yet.</p>}
  <div className="actions">
   {!admin&&<>{['Assigned','Rework','In Progress'].includes(w.status)&&<>{w.status==='Assigned'&&<button className="btn" disabled={loading||saving} onClick={()=>void perform('Employee work start time recorded',()=>api('works',req('PATCH',{work_id:w.work_id,status:'In Progress'})))}>▶ Start Work</button>}<label className="btn file-label">＋ Upload Finished Files<input type="file" multiple accept=".png,.jpg,.jpeg,.webp,.pdf,.svg,.zip,.psd,.ai" disabled={loading||saving} onChange={e=>{const chosen=Array.from(e.target.files||[]);e.target.value='';void uploadFiles(w.work_id,chosen);}}/></label><button className="btn" type="button" onClick={()=>{setWorkLinkFor(workLinkFor===w.work_id?'':w.work_id);setWorkLinkTitle('Completed design link');setWorkLinkUrl('');}}>＋ Submit Finished URL</button><button className="btn btn-primary" disabled={loading||saving||!freshOutput} title={freshOutput?'Send files or links to admin for approval':(w.status==='Rework'?'Upload a NEW corrected file or URL first':'Upload a finished file or URL first')} onClick={()=>void perform('Work submitted for admin review',()=>api('works',req('PATCH',{work_id:w.work_id,status:'Submitted'})))}>✓ Submit for Review</button></>}{w.status==='Submitted'&&<small>Waiting for admin review.</small>}{isCompletedWork(w)&&<small>Completed and approved by admin.</small>}</>}
   {admin&&w.status==='Submitted'&&<><button className="btn btn-success" disabled={loading||saving||outputs.length===0} onClick={()=>void perform('Completed work approved',()=>api('works',req('PATCH',{work_id:w.work_id,status:'Completed'})))}>✓ Approve & Complete</button><button className="btn btn-warning" disabled={loading||saving} onClick={()=>{const feedback=window.prompt('What corrections should the employee make?','');if(feedback!==null){if(!feedback.trim()){setError('Write the mistake and correction details before requesting rework.');return;}void perform('Rework requested with instructions',()=>api('works',req('PATCH',{work_id:w.work_id,status:'Rework',feedback:feedback.trim()})));}}}>↻ Rework + Feedback</button></>}
   {admin&&w.status==='Approved'&&workView==='completed'&&<button className="btn" disabled={loading||saving} onClick={()=>void perform('Legacy approved work archived as Completed in Google Sheet',()=>api('works',req('PATCH',{work_id:w.work_id,status:'Completed'})))}>Save Completed Status in Sheet</button>}
  </div>
  {workLinkFor===w.work_id&&!isCompletedWork(w)&&(admin||['Assigned','In Progress','Rework'].includes(w.status))&&<div className="srinuma-link-share"><label>Link label<input placeholder="e.g., Brand assets / Final website" value={workLinkTitle} maxLength={120} onChange={e=>setWorkLinkTitle(e.target.value)}/></label><label>HTTPS link<input type="url" inputMode="url" placeholder="https://drive.google.com/..." value={workLinkUrl} onChange={e=>setWorkLinkUrl(e.target.value)}/></label><p className="hint">Share only a link the recipient is allowed to open. File downloads continue working exactly as before.</p><div className="actions"><button className="btn btn-primary" disabled={loading||saving||!workLinkUrl.trim()} onClick={()=>void saveSharedLink(w.work_id)}>Save & Share URL</button><button className="btn" onClick={()=>setWorkLinkFor('')}>Cancel</button></div></div>}
  </>}
 </article>;})}</div>{(workView==='all'?works:workView==='completed'?completedWorks:activeWorks).length===0&&<Empty text={workView==='completed'?'No completed work yet.':!admin&&workView==='all'?'No assigned work yet.':'No active assigned work.'}/>}
 </>}
 {/* SRINUMA BILLING TABS V1 — navigation only; separate database tabs remain */}
 {/* SRINUMA COMPLETED WORK BILLING V1 — one Billing page with three tabs */}
 {(page==='quotations'||page==='invoices'||page==='billing_completed')&&admin&&<section className="srinuma-billing-switch srinuma-archive-switch" aria-label="Billing sections"><div className="srinuma-billing-switch-buttons srinuma-archive-buttons" role="tablist" aria-label="Quotations, unpaid invoices and completed billing"><button type="button" role="tab" aria-selected={page==='quotations'} className={page==='quotations'?'active':''} onClick={()=>{setPage('quotations');setPaymentEditor(null);}}>▤ Quotations <span>{activeQuotations.length}</span></button><button type="button" role="tab" aria-selected={page==='invoices'} className={page==='invoices'?'active':''} onClick={()=>{setPage('invoices');setPaymentEditor(null);}}>▥ Invoices <span>{activeInvoices.length}</span></button><button type="button" role="tab" aria-selected={page==='billing_completed'} className={page==='billing_completed'?'active':''} onClick={()=>{setPage('billing_completed');setPaymentEditor(null);}}>✓ Completed <span>{completedInvoices.length}</span></button></div><p>{page==='quotations'?'Unsettled quotations and quotations that still have unpaid invoices.':page==='invoices'?'Invoices with payment pending or balance remaining.':'Fully paid invoices and their linked quotations; PDFs and payment history are preserved.'}</p></section>}
 {page==='quotations'&&admin&&<><div className="toolbar"><p>Basic / Standard / Premium packages, included features and editable paid extras.</p></div><div className="quote-grid"><section className="panel"><h2>Quotation Builder</h2><div className="field-grid"><Field label="Select Lead" wide><select value={quoteLead} onChange={e=>{const l=leads.find(x=>x.lead_id===e.target.value);if(l)openQuote(l);else setQuoteLead('');}}><option value="">Manual quotation</option>{leads.map(l=><option key={l.lead_id} value={l.lead_id}>{l.company_name||l.customer_name} ({l.lead_id})</option>)}</select></Field><Field label="Customer Name"><input value={quoteClient} onChange={e=>setQuoteClient(e.target.value)}/></Field><Field label="Company"><input value={quoteCompany} onChange={e=>setQuoteCompany(e.target.value)}/></Field><Field label="Customer Phone"><input type="tel" value={quotePhone} onChange={e=>setQuotePhone(e.target.value)}/></Field><Field label="Customer Address" wide><textarea value={quoteAddress} onChange={e=>setQuoteAddress(e.target.value)}/></Field><Field label="Package" wide><select value={quotePackage} onChange={e=>{setQuotePackage(e.target.value);setCustomItems([]);}}><option value="">Select service + package</option>{packages.map(p=><option key={p.package_id} value={p.package_id}>{p.service_name} — {p.tier} — {money(p.base_price_inr)}{p.price_status==='DRAFT_SUGGESTED'?' (draft rate)':''}</option>)}</select></Field><Field label="Language"><select value={quoteLanguage} onChange={e=>setQuoteLanguage(e.target.value)}><option>English</option><option>Tamil</option><option>Both</option></select></Field><Field label="Project"><input value={quoteProject} onChange={e=>setQuoteProject(e.target.value)}/></Field><Field label="Requirement" wide><textarea value={quoteRequirements} onChange={e=>setQuoteRequirements(e.target.value)}/></Field></div>{selectedPackage&&<div className="feature-notes"><b>Included in {selectedPackage.tier} — {money(selectedPackage.base_price_inr)}</b><ul>{included.map(f=><li key={f.feature_id}>{f.feature_description}</li>)}</ul></div>}<h3 className="subheading">Extra Customer Features</h3>{selectedPackage&&extras.filter(x=>x.service_type===selectedPackage.service_type).map(x=><button key={x.feature_id} className="btn" style={{margin:'3px 5px 3px 0'}} onClick={()=>setCustomItems(a=>[...a,{description:x.feature_name,quantity:1,unit_price_inr:Number(x.suggested_price_inr.replace(/[^0-9.-]/g,''))||0,item_type:'extra'}])}>＋ {x.feature_name} {money(x.suggested_price_inr)}</button>)}{customItems.map((item,i)=><div className="item-line" key={i}><input aria-label="Feature description" value={item.description} onChange={e=>setCustomItems(a=>a.map((x,j)=>j===i?{...x,description:e.target.value}:x))}/><input aria-label="Feature price" type="number" min="0" value={item.unit_price_inr} onChange={e=>setCustomItems(a=>a.map((x,j)=>j===i?{...x,unit_price_inr:Number(e.target.value)}:x))}/><button className="btn" onClick={()=>setCustomItems(a=>a.filter((_,j)=>j!==i))}>×</button></div>)}<div className="actions"><button className="btn" onClick={()=>setCustomItems(a=>[...a,{description:'',quantity:1,unit_price_inr:0,item_type:'extra'}])}>＋ Custom Feature</button></div><div className="field-grid discount-grid"><Field label="Discount Type"><select value={discountType} onChange={e=>setDiscountType(e.target.value)}><option value="amount">Amount ₹</option><option value="percent">Percentage %</option></select></Field><Field label="Discount"><input type="number" min="0" value={discountValue} onChange={e=>setDiscountValue(Number(e.target.value)||0)}/></Field><Field label="Tax %"><input type="number" min="0" max="28" value={taxRate} onChange={e=>setTaxRate(Number(e.target.value)||0)}/></Field><Field label="Advance Already Received ₹"><input type="number" min="0" step="0.01" value={quoteAdvance} onChange={e=>setQuoteAdvance(Number(e.target.value)||0)}/></Field><Field label="Advance Payment Reference"><input value={quotePaymentNote} maxLength={500} placeholder="Optional UPI / bank reference" onChange={e=>setQuotePaymentNote(e.target.value)}/></Field></div><div className="actions"><button className="btn btn-primary" disabled={loading||saving||!selectedPackage} onClick={()=>void saveQuote()}>Save Quotation to Sheet</button></div></section><section className="paper-preview"><h2>Live Estimate</h2><div className="paper-mini"><img src="/srinuma-logo-print.png" alt="Srinuma Logo"/><h2>{quoteCompany||quoteClient||'Customer'}</h2><small>{selectedPackage?.service_name} • {selectedPackage?.tier} • {quoteLanguage}</small>{included.map(f=><div className="paper-row" key={f.feature_id}><span>✓ {f.feature_description}</span><b>Included</b></div>)}{customItems.map((i,j)=><div className="paper-row" key={j}><span>{i.description}</span><b>{money(Number(i.unit_price_inr)*Number(i.quantity))}</b></div>)}<div className="paper-row"><span>Base price</span><b>{money(selectedSub)}</b></div><div className="paper-row"><span>Discount</span><b>− {money(discount)}</b></div><div className="paper-row paper-total"><span>Estimated total</span><strong>{money(quoteTotal)}</strong></div><div className="paper-row"><span>Advance already received</span><b>{money(quoteAdvance)}</b></div><div className="paper-row paper-total"><span>Balance remaining</span><strong>{money(Math.max(0,quoteTotal-quoteAdvance))}</strong></div></div></section></div><h2 className="subheading">Saved Quotations</h2><div className="card-grid">{activeQuotations.map(q=><article className="panel saved-doc" key={q.quotation_id}><span className="eyebrow">{q.quotation_id}</span><h3>{q.company_name||q.client_name}</h3><p>{q.project_name} • {q.status}</p><b>{money(q.grand_total_inr)}</b><p>Advance: {q.advance_paid_inr==null||q.advance_paid_inr===''?'Not recorded':money(q.advance_paid_inr)} • Balance: {q.advance_paid_inr==null||q.advance_paid_inr===''?'Verify payment':money(Math.max(0,Number(q.grand_total_inr)-Number(q.advance_paid_inr)))}</p><div className="actions"><button className="btn" onClick={()=>setDocumentPreview({kind:'Quotation',record:q})}>Preview / PDF</button>{q.status!=='Approved'&&<button className="btn" disabled={loading||saving} onClick={()=>{if(window.confirm('Did the CLIENT approve this quotation? Mark Approved only after confirming with them.'))void perform('Client quotation approved',()=>api('quotations',req('PATCH',{quotation_id:q.quotation_id,status:'Approved'})));}}>Approve Quote</button>}{q.status==='Approved'&&<button className="btn btn-primary" disabled={loading||saving} onClick={()=>void perform('Invoice generated from approved quotation',async()=>{await api('invoices',req('POST',{quotation_id:q.quotation_id}));setPaymentEditor(null);setPage('invoices');})}>Create Invoice</button>}<button className="btn" disabled={loading||saving||q.status==='Cancelled'||invoices.some(inv=>inv.quotation_id===q.quotation_id)} onClick={()=>openPayment('Quotation',q)}>Record Advance</button></div>{paymentEditor?.kind==='Quotation'&&paymentEditor.id===q.quotation_id&&<div className="payment-editor"><strong>Record actual advance received</strong><label>Total received so far (₹)<input type="number" min="0" max={q.grand_total_inr} step="0.01" value={paymentAmount} onChange={e=>setPaymentAmount(e.target.value)}/></label><label>Payment reference / note (internal)<input value={paymentNote} maxLength={500} onChange={e=>setPaymentNote(e.target.value)} placeholder="Bank / UPI / cash reference"/></label><p>Balance after payment: {money(Math.max(0,Number(q.grand_total_inr)-Number(paymentAmount||0)))}</p><div className="actions"><button className="btn btn-primary" disabled={loading||saving} onClick={()=>void savePayment()}>Save Received Amount to Sheet</button><button className="btn" onClick={()=>setPaymentEditor(null)}>Cancel</button></div></div>}</article>)}</div></>}
 {page==='invoices'&&admin&&<><div className="toolbar"><p>Record actual payments in Google Sheets. PDF shows advance received and remaining balance.</p><button className="btn" onClick={()=>setPage('quotations')}>＋ Go to Quotations</button></div><div className="card-grid">{activeInvoices.map(inv=><article className="panel saved-doc" key={inv.invoice_id}><span className="eyebrow">{inv.invoice_id}</span><h3>{inv.company_name||inv.client_name}</h3><p>From {inv.quotation_id} • {inv.status} • {date(inv.issued_at)}</p><b>{money(inv.grand_total_inr)}</b><p>Amount received: {inv.advance_paid_inr==null||inv.advance_paid_inr===''?'Not recorded':money(inv.advance_paid_inr)} • Balance due: {inv.advance_paid_inr==null||inv.advance_paid_inr===''?'Verify payment':money(Math.max(0,Number(inv.grand_total_inr)-Number(inv.advance_paid_inr)))}{Number(inv.advance_paid_inr||0)>Number(inv.grand_total_inr)&&<> • Customer credit: {money(Number(inv.advance_paid_inr)-Number(inv.grand_total_inr))}</>}{inv.status==='Paid'&&<> • ✅ FULLY PAID</>}</p><div className="actions"><button className="btn" onClick={()=>setDocumentPreview({kind:'Invoice',record:inv})}>Professional PDF / Print</button><button className="btn btn-primary" disabled={loading||saving||inv.status==='Cancelled'} onClick={()=>openPayment('Invoice',inv)}>Record / Update Payment</button></div>{paymentEditor?.kind==='Invoice'&&paymentEditor.id===inv.invoice_id&&<div className="payment-editor"><strong>Record actual amount received</strong><p className="hint">Saved in Google Sheets so far: <b>{money(inv.advance_paid_inr||0)}</b>. Enter the NEW CUMULATIVE amount (advance + later payments). Only the increase is recorded as a new dated receipt. If you enter more than the invoice total, the extra remains customer credit.</p>{Number(paymentAmount)<Number(inv.advance_paid_inr||0)&&<p className="form-error">Entered amount is below the saved amount. Use current saved amount or higher; to correct a historic error use a separate refund/correction.</p>}<label>Total received so far (₹)<input type="number" min="0" step="0.01" value={paymentAmount} onChange={e=>setPaymentAmount(e.target.value)}/></label><label>Received on (actual date)<input type="date" value={paymentDate} onChange={e=>setPaymentDate(e.target.value)}/></label><label>Payment reference / note (internal)<input value={paymentNote} maxLength={500} onChange={e=>setPaymentNote(e.target.value)} placeholder="Bank / UPI / cash reference"/></label><p><strong>Balance after payment: {money(Math.max(0,Number(inv.grand_total_inr)-Number(paymentAmount||0)))}</strong>{Number(paymentAmount||0)>=Number(inv.grand_total_inr)&&' • FULLY PAID'}{Number(paymentAmount||0)>Number(inv.grand_total_inr)&&<> • Extra received (customer credit/refund due): {money(Number(paymentAmount||0)-Number(inv.grand_total_inr))}</>}</p><div className="actions"><button className="btn" disabled={Number(inv.advance_paid_inr||0)>=Number(inv.grand_total_inr)} onClick={()=>setPaymentAmount(String(inv.grand_total_inr))}>Fill full invoice total</button></div><div className="actions"><button className="btn btn-primary" disabled={loading||saving} onClick={()=>void savePayment()}>Save Received Amount to Sheet</button><button className="btn" onClick={()=>setPaymentEditor(null)}>Cancel</button></div></div>}</article>)}</div>{!activeInvoices.length&&<Empty text="No pending invoices. Fully paid invoices are in Billing → Completed."/>}</>}

 {page==='billing_completed'&&admin&&<>
 <div className="toolbar"><p>Fully paid invoices, linked quotations and payment records are archived here — never deleted from Google Sheets.</p><button className="btn" onClick={()=>setPage('invoices')}>← Pending Invoices</button></div>
 <div className="card-grid">{completedInvoices.map(inv=>{const quote=quotations.find(q=>q.quotation_id===inv.quotation_id);return <article className="panel saved-doc srinuma-completed-billing-card" key={inv.invoice_id}>
 <div className="card-head"><div><span className="eyebrow">{inv.invoice_id}</span><h3>{inv.company_name||inv.client_name}</h3><small>{quote?(SERVICE[quote.service_type]||quote.service_type)+' · '+quote.project_name:inv.quotation_id}</small></div><span className="tag glow">✓ FULLY PAID</span></div>
 <p>Invoice date: {date(inv.issued_at)} · {inv.status}</p><p><strong>Total: {money(inv.grand_total_inr)}</strong></p><p>Received: {money(inv.advance_paid_inr||0)} · Balance: {money(Math.max(0,Number(inv.grand_total_inr)-Number(inv.advance_paid_inr||0)))}{Number(inv.advance_paid_inr||0)>Number(inv.grand_total_inr)&&' · Customer credit: '+money(Number(inv.advance_paid_inr)-Number(inv.grand_total_inr))}</p>
 <div className="actions"><button className="btn btn-primary" onClick={()=>setDocumentPreview({kind:'Invoice',record:inv})}>Invoice PDF</button>{quote&&<button className="btn" onClick={()=>setDocumentPreview({kind:'Quotation',record:quote})}>Quotation PDF</button>}<button className="btn" onClick={()=>setPage('payments')}>Payment History</button></div>
 </article>;})}</div>{completedInvoices.length===0&&<Empty text="No fully paid invoices yet. Once the customer balance is settled, the invoice moves here automatically."/>}
 </>}

 {page==='payments'&&admin&&<>
 <div className="toolbar"><p>Actual receipts, employee payouts, expenses and date-wise cash flow. Records save in the Google Sheet Payments tab.</p><button className="btn" onClick={financeReport}>Print / Save PDF Report</button></div>
 <section className="panel ops-panel srinuma-payments-filter-panel"><label className="ops-payment-filter">Filter by payment type <select value={paymentTypeFilter} onChange={e=>setPaymentTypeFilter(e.target.value)}><option value="all">All Payments</option><option value="invoice">Customer Invoice Receipts</option><option value="income">Other Income</option><option value="employee">Employee Salary / Payouts</option><option value="expense">Business Expenses</option></select></label><div className="srinuma-payments-filter-summary">{paymentTypeFilter==='all'?'All payment types':paymentTypeFilter==='invoice'?'Customer Invoice Receipts':paymentTypeFilter==='income'?'Other Income':paymentTypeFilter==='employee'?'Employee Salary / Payouts':'Business Expenses'} · <b>{visiblePayments.length} transactions</b> · <b>{money(visiblePayments.reduce((total,p)=>total+(Number(p.amount_inr)||0),0))}</b><small>Based on recorded ledger entries within the chosen date range. Historic undated invoice advances are visible in customer cards, not counted again as new income. The PDF cash report continues to use all payment types for the selected dates.</small></div></section>
 {/* SRINUMA INVOICE STATUS PANEL V1: cumulative invoice balances, not extra income ledger rows */}
 {/* SRINUMA CUSTOMER PAYMENT CARDS V3: Customer/service overview, expandable receipt history */}
 <section className="panel ops-panel srinuma-customer-payment-section"><h2>Customer Invoice Payments & Date-wise History</h2><p className="hint">Click a customer card to view received amounts, the dated payment timeline, any balance still due, and customer credit. Old advances without a saved payment date are labelled “Date not recorded”.</p>
 {(paymentTypeFilter==='all'||paymentTypeFilter==='invoice')?<div className="srinuma-customer-payment-grid">
 {invoices.map(inv=>{
   const linkedQuote=quotations.find(q=>q.quotation_id===inv.quotation_id);
   const customer=inv.client_name||linkedQuote?.client_name||inv.company_name||'Customer not recorded';
   const service=linkedQuote?(SERVICE[linkedQuote.service_type]||linkedQuote.items.find(item=>item.item_type==='package')?.description||'Service not recorded'):'Service not recorded';
   const tier=linkedQuote?packages.find(p=>p.package_id===linkedQuote.package_id)?.tier:'';
   const grand=Number(inv.grand_total_inr)||0;
   const known=inv.advance_paid_inr!==undefined&&inv.advance_paid_inr!==null&&inv.advance_paid_inr!=='';
   const received=known?(Number(inv.advance_paid_inr)||0):0;
   const remaining=Math.max(0,grand-received);
   const credit=Math.max(0,received-grand);
   const entries=invoiceReceiptRows(inv.invoice_id);
   const logged=entries.reduce((total,p)=>total+(Number(p.amount_inr)||0),0);
   const historical=known?Math.max(0,Math.round((received-logged)*100)/100):0;
   const paidInFull=known&&grand>0&&received>=grand;
   return <details key={inv.invoice_id} className="srinuma-customer-payment-card">
     <summary className="srinuma-customer-payment-heading">
       <span className="srinuma-customer-payment-identity"><strong>{customer}</strong><span>{service}{tier?' · '+tier+' Package':''}</span>{linkedQuote?.project_name&&<span className="srinuma-payment-project">{linkedQuote.project_name}</span>}</span>
       <span className="srinuma-customer-payment-amounts"><b>{known?money(received):'Payment not recorded'}</b><small>Received · Total {money(grand)}</small><small>{known?remaining>0?'Balance '+money(remaining):'Balance ₹0.00':'Balance to verify'}</small></span>
       <span className={'srinuma-customer-payment-status '+(paidInFull?'paid':known&&received>0?'partial':'pending')}>{paidInFull?'✓ FULLY PAID':known&&received>0?'PARTIALLY PAID':'PAYMENT PENDING'}</span>
       <span className="srinuma-customer-payment-expand" aria-hidden="true">Details <span>⌄</span></span>
     </summary>
     <div className="srinuma-customer-payment-details">
       <div className="srinuma-payment-details-top"><span>Invoice reference: <b>{inv.invoice_id}</b></span><span>Invoice total: <b>{money(grand)}</b></span>{inv.company_name&&<span>Company: <b>{inv.company_name}</b></span>}{linkedQuote?.project_name&&<span>Project: <b>{linkedQuote.project_name}</b></span>}</div>
       <div className="srinuma-payment-mini-totals"><div>Received <b>{known?money(received):'Not recorded'}</b></div><div>Balance Due <b>{known?money(remaining):'Verify payment'}</b></div>{credit>0&&<div className="credit">Extra paid — customer credit/refund due <b>{money(credit)}</b></div>}</div>
       <h3>Payment History</h3>
       {historical>0&&<div className="srinuma-payment-history-entry"><span><b>Earlier received amount (advance / previous payment)</b><small>Date not recorded — historical invoice entry</small></span><strong>{money(historical)}</strong></div>}
       {entries.map((p,i)=>{const cumulative=historical+entries.slice(0,i+1).reduce((total,row)=>total+(Number(row.amount_inr)||0),0);return <div className="srinuma-payment-history-entry" key={p.payment_id}><span><b>{p.purpose||p.category||'Customer payment'}</b><small>{p.paid_at||'Date not recorded'} · {p.category||'Invoice receipt'}{p.note?' · '+p.note:''}</small><small>Balance after this receipt: {money(Math.max(0,grand-cumulative))}</small></span><strong>{money(p.amount_inr)}</strong></div>;})}
       {!entries.length&&historical===0&&<p className="hint">No recorded receipts for this invoice yet.</p>}
       {!known&&<p className="hint">The received total has not been recorded. Check the invoice before marking it paid.</p>}
     </div>
   </details>;
 })}
 {!invoices.length&&<p className="hint">No customer invoices recorded yet.</p>}
 </div>:<p className="hint">Customer invoice cards are shown under “All Payments” and “Customer Invoice Receipts”. The selected payment type is shown in the matching transactions and totals below.</p>}
 </section>
 <section className="panel ops-panel"><h2>Choose Report Dates</h2><div className="ops-filter"><label>From <input type="date" value={reportFrom} onChange={e=>setReportFrom(e.target.value)}/></label><label>To <input type="date" value={reportTo} onChange={e=>setReportTo(e.target.value)}/></label><button className="btn" onClick={()=>{const d=new Date();setReportFrom(new Date(d.getFullYear(),d.getMonth(),1).toLocaleDateString('en-CA'));setReportTo(d.toLocaleDateString('en-CA'));}}>This Month</button><button className="btn" onClick={()=>{setReportFrom('');setReportTo('');}}>All Dates</button></div>{reportFrom&&reportTo&&reportFrom>reportTo&&<p className="form-error">From date must be before To date.</p>}</section>
 <div className="ops-summary"><div><span>Income Received</span><b>{money(incomeReceived)}</b></div><div><span>Expenses Paid</span><b>{money(expensesPaid)}</b></div><div><span>Net Cash Flow</span><b>{money(incomeReceived-expensesPaid)}</b></div><div><span>Invoice Balance Due (all invoices)</span><b>{money(outstandingInvoices)}</b></div></div>
 <section className="panel ops-panel"><h2>Income vs Expenses — Monthly Chart</h2><div className="ops-chart-legend">▰ Income received &nbsp; ▰ Paid expenses</div>{monthlyCash.length===0&&<p className="hint">No recorded payments for this date range.</p>}{monthlyCash.map(m=><div className="ops-chart-row" key={m.month}><strong>{m.month}</strong><div className="ops-chart-bars"><div className="ops-bar income" style={{width:(m.income/maxChart*100)+'%'}} title={'Income '+money(m.income)}></div><div className="ops-bar expense" style={{width:(m.expense/maxChart*100)+'%'}} title={'Expense '+money(m.expense)}></div></div><small>{money(m.income)} / {money(m.expense)}</small></div>)}</section>
 <section className="panel ops-panel"><h2>Add Customer Payment / Employee Salary / Business Expense</h2><div className="field-grid">
 <Field label="Type"><select value={financeDraft.entry_type} onChange={e=>setFinanceDraft({...financeDraft,entry_type:e.target.value,category:e.target.value==='income'?'Customer Payment':'Employee Payment'})}><option value="income">Customer / Other Income</option><option value="expense">Employee / Business Expense</option></select></Field>
 <Field label="Payment Date"><input type="date" value={financeDraft.paid_at} onChange={e=>setFinanceDraft({...financeDraft,paid_at:e.target.value})}/></Field>
 <Field label="Amount (₹)"><input type="number" step="0.01" min="0.01" value={financeDraft.amount_inr} onChange={e=>setFinanceDraft({...financeDraft,amount_inr:e.target.value})}/></Field>
 <Field label="Category"><select value={financeDraft.category} onChange={e=>setFinanceDraft({...financeDraft,category:e.target.value})}>{['Customer Payment','Other Income','Employee Payment','Salary','Freelancer','Hosting / Domain','Software / Subscription','Marketing','Travel','Office / Equipment','Miscellaneous'].map(x=><option value={x} key={x}>{x}</option>)}</select></Field>
 <Field label="From / Paid To"><input value={financeDraft.counterparty} placeholder="Customer, employee or vendor name" onChange={e=>setFinanceDraft({...financeDraft,counterparty:e.target.value})}/></Field>
 <Field label="Employee (optional)"><select value={financeDraft.employee_id} onChange={e=>setFinanceDraft({...financeDraft,employee_id:e.target.value})}><option value="">Not employee-specific</option>{employees.map(e=><option value={e.employee_id} key={e.employee_id}>{e.name} ({e.employee_id})</option>)}</select></Field>
 <Field label="Work (optional)"><select value={financeDraft.work_id} onChange={e=>setFinanceDraft({...financeDraft,work_id:e.target.value})}><option value="">No linked work</option>{works.map(w=><option value={w.work_id} key={w.work_id}>{w.work_id} – {w.title}</option>)}</select></Field>
 <Field label="Invoice (optional)"><select value={financeDraft.invoice_id} onChange={e=>setFinanceDraft({...financeDraft,invoice_id:e.target.value})}><option value="">No linked invoice</option>{invoices.map(v=><option value={v.invoice_id} key={v.invoice_id}>{v.invoice_id} — {v.client_name}</option>)}</select></Field>
 <Field label="What was this payment for?" wide><textarea value={financeDraft.purpose} placeholder="Eg: Employee Mohankanth payment for WRK001, hosting renewal, customer advance" onChange={e=>setFinanceDraft({...financeDraft,purpose:e.target.value})}/></Field>
 <Field label="Notes (optional)" wide><input value={financeDraft.note} onChange={e=>setFinanceDraft({...financeDraft,note:e.target.value})}/></Field>
 </div><div className="actions"><button className="btn btn-primary" disabled={loading||saving} onClick={()=>void saveFinance()}>＋ Save Payment / Expense</button></div><p className="hint">Cash report counts only entries recorded here. Existing invoice advances are NOT auto-imported. For customer invoice receipts, use Billing → Invoices → Record / Update Payment. The new amount is saved to Payments automatically; do not add the same receipt manually.</p></section>
 <section className="panel ops-panel"><h2>Transactions ({visiblePayments.length}) — Selected Payment Type</h2><div className="ops-table-wrap"><table className="ops-table"><thead><tr><th>Date / ID</th><th>Type</th><th>Paid By / To</th><th>Reason</th><th>Work / Invoice</th><th>Amount</th></tr></thead><tbody>{[...visiblePayments].sort((a,b)=>b.paid_at.localeCompare(a.paid_at)||b.payment_id.localeCompare(a.payment_id)).map(p=><tr key={p.payment_id}><td>{p.paid_at}<small>{p.payment_id}</small></td><td>{p.entry_type}</td><td>{p.counterparty||'—'}</td><td>{p.category}<small>{p.purpose}</small></td><td>{[p.employee_id,p.work_id,p.invoice_id].filter(Boolean).join(' · ')||'—'}</td><td>{money(p.amount_inr)}</td></tr>)}</tbody></table>{!visiblePayments.length&&<p className="hint">No transactions for this type and date range.</p>}</div></section>
 </>}
  {/* SRINUMA SETTINGS CONTROL CENTER V1 */}
 {page==='settings'&&admin&&<section className="panel"><h2>⚙ CRM Customization Center</h2>
 <p className="hint">Customize your entire CRM workspace from one place. Admin-only changes save permanently in the Settings Google Sheet. Existing customers, work files, payments and issued quotation amounts stay untouched. Brand changes affect this entire workspace; they do not separate customers of different companies.</p>
 <div className="srinuma-settings-home" role="navigation" aria-label="CRM settings categories">
 <a href="#settings-brand">◈ Brand &amp; Logo <small>Identity and theme</small></a>
 <a href="#settings-documents" onClick={()=>{const el=document.getElementById("settings-documents");if(el instanceof HTMLDetailsElement)el.open=true;}}>▤ Documents <small>PDF defaults and footer</small></a>
 <a href="#settings-work" onClick={()=>{const el=document.getElementById("settings-work");if(el instanceof HTMLDetailsElement)el.open=true;}}>☷ Work Defaults <small>Due dates</small></a>
 <a href="#settings-dashboard" onClick={()=>{const el=document.getElementById("settings-dashboard");if(el instanceof HTMLDetailsElement)el.open=true;}}>◫ Dashboard <small>Card visibility</small></a>
 <a href="#settings-packages">▦ Package Features <small>Cards and descriptions</small></a>
 <a href="#settings-rates">₹ Service Rates <small>Basic / Standard / Premium</small></a>
 <a href="#settings-extra-rates">＋ Extra Feature Rates <small>Card-based pricing</small></a>
 <button type="button" onClick={()=>setPage('employees')}>♙ Team &amp; Roles <small>Admin access controls</small></button>
 <button type="button" onClick={()=>setPage('leads')}>✓ Leads &amp; Approvals <small>Review client leads</small></button>
 </div>
 <div className="srinuma-custom-settings">
 <details id="settings-brand" open className="srinuma-custom-group"><summary>🎨 Appearance & Branding <span>Customize</span></summary><div className="field-grid">
 <Field label="Workspace Name"><input maxLength={70} value={settings.workspace_title||''} onChange={e=>setSettings({...settings,workspace_title:e.target.value})} placeholder="SRINUMA HUB"/></Field>
 <Field label="Company / PDF Business Name"><input maxLength={100} value={settings.company_name||''} onChange={e=>setSettings({...settings,company_name:e.target.value})} placeholder="SRINUMA DIGITAL SOLUTIONS"/></Field>
 <Field label="CRM Accent Color"><input type="color" value={settings.theme_accent||'#25c8ff'} onChange={e=>setSettings({...settings,theme_accent:e.target.value})}/></Field>
 <Field label="Cards & Screen Spacing"><select value={settings.card_size||'comfortable'} onChange={e=>setSettings({...settings,card_size:e.target.value})}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></Field>
 </div>
 <div className="srinuma-brand-logo-editor">
  <div className="srinuma-logo-preview">{settings.brand_logo_data?<img src={settings.brand_logo_data} alt="Selected company brand logo preview"/>:<img src="/srinuma-logo.png" alt="Default SRINUMA logo"/>}</div>
  <div className="srinuma-brand-logo-actions"><strong>Brand Logo</strong><p className="hint">Choose PNG, JPG or WebP. Original proportions are preserved. The optimized image is stored in the Settings Sheet after you click Save All. Login, header, sidebar and future PDFs use the saved logo.</p>
   <div className="actions"><label className="btn file-label">＋ Upload Brand Logo<input type="file" accept="image/png,image/jpeg,image/webp" disabled={brandLogoBusy||saving} onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f)void chooseBrandLogo(f);}}/></label>
    {settings.brand_logo_data&&<button className="btn" type="button" disabled={saving||brandLogoBusy} onClick={()=>setSettings(v=>({...v,brand_logo_data:''}))}>Use Default Logo</button>}</div>
    {brandLogoBusy&&<p role="status">Optimizing image…</p>}
  </div>
 </div></details>
 <details id="settings-documents" className="srinuma-custom-group"><summary>📄 Quotation / Invoice Defaults <span>Edit</span></summary><div className="field-grid">
 <Field label="Default PDF Paper"><select value={settings.default_paper_size||'A4'} onChange={e=>setSettings({...settings,default_paper_size:e.target.value})}><option>A4</option><option>A5</option><option>Letter</option></select></Field>
 <Field label="Default Quotation Language"><select value={settings.quotation_default_language||'English'} onChange={e=>setSettings({...settings,quotation_default_language:e.target.value})}><option>English</option><option>Tamil</option><option>Both</option></select></Field>
 <Field label="Company Phone"><input value={settings.company_phone||''} onChange={e=>setSettings({...settings,company_phone:e.target.value})} maxLength={90}/></Field>
 <Field label="Company Address" wide><textarea value={settings.company_address||''} onChange={e=>setSettings({...settings,company_address:e.target.value})} maxLength={600}/></Field>
 <Field label="Quotation / Invoice Footer" wide><textarea value={settings.document_footer||''} onChange={e=>setSettings({...settings,document_footer:e.target.value})} maxLength={220} placeholder="Thank you for choosing SRINUMA DIGITAL SOLUTIONS"/></Field>
 </div><p className="hint">Paper, contact and footer preferences apply to PDF previews. Existing invoice totals and received amounts do not change.</p></details>
 <details id="settings-work" className="srinuma-custom-group"><summary>☷ Work Assignment Defaults <span>Edit</span></summary><div className="field-grid">
 <Field label="Default Due Days (0 = manual)"><input type="number" min="0" max="365" step="1" value={settings.default_work_due_days??'0'} onChange={e=>setSettings({...settings,default_work_due_days:e.target.value})}/></Field>
 </div><p className="hint">New Work assignment form suggests a due date this many days after assignment. Admin can always edit the due date. Existing work deadlines do not change.</p></details>
 <details id="settings-dashboard" className="srinuma-custom-group"><summary>◫ Dashboard Cards <span>Show / Hide</span></summary><div className="srinuma-custom-toggles">
 {([['dashboard_leads','Total Leads'],['dashboard_employees','Employees'],['dashboard_work','Open Work'],['dashboard_quotations','Quotations']] as const).map(([key,label])=><label key={key}><input type="checkbox" checked={settings[key]!=='false'} onChange={e=>setSettings(v=>({...v,[key]:e.target.checked?'true':'false'}))}/><span>{label}</span></label>)}
 </div><p className="hint">Show/hide Dashboard summary cards only. Sidebar, employee permissions, and access to actual records are not changed.</p></details>
 </div>
 <div className="actions srinuma-custom-save"><button type="button" className="btn btn-primary" disabled={loading||saving||brandLogoBusy} onClick={()=>void saveSettings()}>Save All CRM Customizations</button><button type="button" className="btn" disabled={loading} onClick={()=>void refresh(user)}>Discard Changes / Reload</button></div>
 <p className="hint">Package rates, included feature text, and extra-feature pricing can also be customized below. System permissions, private customer data and database tables are deliberately not editable from Settings.</p>
 {/* SRINUMA PACKAGE RATE CARDS V1 - click a small card to edit one final price */}
 <div className="srinuma-rate-section" id="settings-rates"><h3 className="subheading">Package Rates (Basic / Standard / Premium)</h3><p className="hint">Tap a package card to change its final rate. Saving updates the Packages Google Sheet and rates for new quotations only. Previously saved quotations and invoices keep their agreed amounts.</p>
 {(['website','crm','invention'] as const).map(service=>{
  const entries=packages.filter(p=>p.service_type===service).sort((a,b)=>['Basic','Standard','Premium'].indexOf(a.tier)-['Basic','Standard','Premium'].indexOf(b.tier));
  return entries.length?<section className="srinuma-rate-service" key={service} aria-label={(SERVICE[service]||service)+' package rates'}><h4>{SERVICE[service]||service}</h4>
   <div className="srinuma-rate-grid">{entries.map(p=>{
    const editing=openPackageRate===p.package_id;
    const original=String(Number(p.base_price_inr.replace(/[^0-9.-]/g,''))||0);
    return <article className={'srinuma-rate-card'+(editing?' is-editing':'')} key={p.package_id}>
     <button type="button" className="srinuma-rate-card-head" aria-expanded={editing} aria-controls={'rate-editor-'+p.package_id} onClick={()=>{setOpenPackageRate(editing?'':p.package_id);setPriceEdits(prev=>({...prev,[p.package_id]:original}));}}>
      <span className="srinuma-rate-tier">{p.tier} <span aria-hidden="true">{editing?'⌃':'✎'}</span></span>
      <strong>{money(p.base_price_inr)}</strong>
      <small>{p.price_status==='DRAFT_SUGGESTED'?'Suggested — not final':'Final rate saved'}</small>
     </button>
     {editing&&<div id={'rate-editor-'+p.package_id} className="srinuma-rate-editor">
      <label htmlFor={'rate-input-'+p.package_id}>Final rate (₹)</label>
      <input id={'rate-input-'+p.package_id} type="number" min="1" step="0.01" inputMode="decimal" value={priceEdits[p.package_id]??original} onChange={e=>setPriceEdits(prev=>({...prev,[p.package_id]:e.target.value}))}/>
      <div className="srinuma-rate-actions"><button type="button" className="btn btn-primary" disabled={loading||saving} onClick={()=>void saveFinalPackageRate(p)}>Save Final Rate</button><button type="button" className="btn" disabled={loading||saving} onClick={()=>{setOpenPackageRate('');setPriceEdits(prev=>{const next={...prev};delete next[p.package_id];return next;});}}>Cancel</button></div>
     </div>}
    </article>;
   })}</div>
  </section>:null;
 })}
 {!packages.length&&<p className="hint">No active packages found in Google Sheets. Check the Packages tab.</p>}
 </div>{/* SRINUMA SETTINGS CONTROL CENTER V1: package feature management */}
 <section className="srinuma-features-editor" id="settings-packages"><h3 className="subheading">Package Included Features — Edit Descriptions</h3>
 <p className="hint">Every package has its own card. Tap a card to edit the features shown on NEW quotations. Existing customer quotation snapshots stay unchanged.</p>
 <div className="srinuma-feature-card-grid">{packages.map(p=>{
  const packFeatures=features.filter(f=>f.package_id===p.package_id&&f.included.toLowerCase()!=='false').sort((x,y)=>Number(x.sort_order)-Number(y.sort_order));
  return <details key={p.package_id} className="srinuma-feature-package-card"><summary><span className="srinuma-feature-service">{p.service_name}</span><strong>{p.tier}</strong><small>{packFeatures.length} included features · Tap to edit</small><span className="srinuma-feature-edit-label">Edit details ↗</span></summary>
    <div className="srinuma-feature-rows">{packFeatures.map(f=><article className="srinuma-feature-item-card" key={f.feature_id}>
    {editingFeature===f.feature_id?<><label htmlFor={'feature-'+f.feature_id}>Included Feature</label><textarea id={'feature-'+f.feature_id} aria-label={'Feature description '+f.feature_id} maxLength={240} rows={2} value={featureEdits[f.feature_id]??f.feature_description} onChange={e=>setFeatureEdits(x=>({...x,[f.feature_id]:e.target.value}))}/><div className="actions"><button type="button" className="btn btn-primary" disabled={loading||saving} onClick={()=>void savePackageFeature(f)}>Save Feature</button><button type="button" className="btn" disabled={loading||saving} onClick={()=>setEditingFeature('')}>Cancel</button></div></>:<><p>{f.feature_description}</p><button type="button" className="btn" disabled={loading||saving} onClick={()=>{setEditingFeature(f.feature_id);setFeatureEdits(x=>({...x,[f.feature_id]:f.feature_description}));}}>✎ Edit</button></>}
    </article>)}</div>
  </details>;
 })}</div>
 </section>
 <section className="srinuma-extra-rate-section" id="settings-extra-rates" aria-label="Extra Feature Rates">
 <h3 className="subheading">Extra Feature Rates</h3>
 <p className="hint">One feature per card. Tap a card to edit its price. The change applies to new quotations only; existing quotations and invoices retain their saved amounts.</p>
 {extraCatalog.duplicates>0&&<p className="srinuma-extra-duplicate-warning" role="alert">⚠ {extraCatalog.duplicates} duplicate / incomplete ExtraFeatures record(s) detected in Google Sheets. Duplicate cards are hidden here; source records are NOT deleted. Run the read-only duplicate audit and correct affected rows in the Sheet before editing those features.</p>}
 {Array.from(new Set(extraCatalog.items.map(x=>x.service_type))).map(service=>{
  const entries=extraCatalog.items.filter(x=>x.service_type===service);
  return <section className="srinuma-extra-service" key={service} aria-label={(SERVICE[service]||service)+' extra features'}>
   <h4>{SERVICE[service]||service}</h4>
   <div className="srinuma-extra-grid">{entries.map(x=>{
    const editing=openExtraRate===x.feature_id;
    const original=String(Number(x.suggested_price_inr.replace(/[^0-9.-]/g,''))||0);
    const duplicate=extraCatalog.ambiguous.has(x.feature_id);
    return <article className={'srinuma-extra-card'+(editing?' is-editing':'')} key={x.feature_id}>
     <button type="button" className="srinuma-extra-head" disabled={duplicate} aria-expanded={editing} aria-controls={'extra-editor-'+x.feature_id} onClick={()=>{setOpenExtraRate(editing?'':x.feature_id);setPriceEdits(old=>({...old,[x.feature_id]:original}));}}>
      <span className="srinuma-extra-service-name">{SERVICE[x.service_type]||x.service_type}</span>
      <strong>{x.feature_name}</strong>
      <span className="srinuma-extra-price">{money(x.suggested_price_inr)}</span>
      <small>{duplicate?'⚠ Duplicate definition — resolve in Sheet':x.price_status==='DRAFT_SUGGESTED'?'Suggested price · Tap to edit':'Saved rate · Tap to edit'}</small>
     </button>
     {editing&&!duplicate&&<div id={'extra-editor-'+x.feature_id} className="srinuma-extra-editor">
      <label htmlFor={'extra-input-'+x.feature_id}>Extra feature rate (₹)</label>
      <input type="number" id={'extra-input-'+x.feature_id} min="0" step="0.01" inputMode="decimal" value={priceEdits[x.feature_id]??original} onChange={e=>setPriceEdits(v=>({...v,[x.feature_id]:e.target.value}))}/>
      <div className="actions">
       <button className="btn btn-primary" type="button" disabled={loading||saving} onClick={()=>void saveExtraRate(x)}>Save Rate</button>
       <button className="btn" type="button" disabled={loading||saving} onClick={()=>{setOpenExtraRate('');setPriceEdits(v=>{const n={...v};delete n[x.feature_id];return n;});}}>Cancel</button>
      </div>
     </div>}
    </article>;
   })}</div>
  </section>;
 })}
 {!extraCatalog.items.length&&<p className="hint">No extra features found. Check the ExtraFeatures Google Sheet.</p>}
 </section>
 </section>}
 </main><nav className="bottom-nav" aria-label="SRINUMA CRM Navigation"><div className="sidebar-brand"><img src={settings.brand_logo_data||"/srinuma-logo.png"} alt={settings.company_name||"Company Logo"}/><span>{settings.workspace_title||'SRINUMA HUB'} <small>CRM WORKSPACE</small></span></div><div className="nav-items desktop-nav">{(admin?tabs:tabs.filter(t=>t[0]==='work'||t[0]==='profile')).map(([id,label,icon])=><button key={id} className={page===id||(id==='quotations'&&(page==='invoices'||page==='billing_completed'))?'active':''} onClick={()=>{setPage(id);setMore(false);}}><span className="nav-icon">{icon}</span><span>{admin?label:id==='profile'?'My Profile':'My Work'}</span></button>)}</div><div className="mobile-nav">{admin?<>{tabs.slice(0,3).map(([id,label,icon])=><button key={id} className={page===id?'active':''} onClick={()=>{setPage(id);setMore(false);}}><span className="nav-icon">{icon}</span><span>{id==='employees'?'Emp':label}</span></button>)}<button className={more||['work','quotations','invoices','billing_completed','payments','settings','profile'].includes(page)?'active':''} onClick={()=>setMore(x=>!x)} aria-expanded={more}><span className="nav-icon">☰</span><span>More</span></button></>:<button className="active" onClick={()=>setPage('work')}><span className="nav-icon">☷</span><span>My Work</span></button>}{!admin&&<button className={page==='profile'?'active':''} onClick={()=>{setPage('profile');setMore(false);}}><span className="nav-icon">◉</span><span>Profile</span></button>}</div>{admin&&more&&<><button className="more-dismiss" aria-label="Close More menu" onClick={()=>setMore(false)}/><div className="mobile-more-panel"><div className="more-panel-header"><strong>More Pages</strong><button onClick={()=>setMore(false)}>×</button></div><div className="more-link-grid">{tabs.slice(3).map(([id,label,icon])=><button key={id} onClick={()=>{setPage(id);setMore(false);}}><span className="nav-icon">{icon}</span><span>{label}</span></button>)}</div></div></>}</nav></>}
 {saveNotice&&<div className={'srinuma-save-popup srinuma-save-'+saveNotice.kind} role={saveNotice.kind==='error'?'alert':'status'} aria-live={saveNotice.kind==='error'?'assertive':'polite'}>
   <div className="srinuma-save-popup-icon" aria-hidden="true">{saveNotice.kind==='saving'?<span className="srinuma-save-spinner"/>:saveNotice.kind==='success'?'✓':'!'}</div>
   <div className="srinuma-save-popup-content"><strong>{saveNotice.title}</strong>{saveNotice.detail&&<small>{saveNotice.detail}</small>}</div>
   {saveNotice.kind!=='saving'&&<button className="srinuma-save-dismiss" type="button" aria-label="Close notification" onClick={()=>setSaveNotice(null)}>×</button>}
  </div>}
 {documentPreview&&<div className="doc-overlay" onClick={e=>{if(e.target===e.currentTarget)setDocumentPreview(null);}}><div className="doc-window professional-doc-modal"><div className="doc-toolbar"><strong>{documentPreview.kind} • {'invoice_id' in documentPreview.record?documentPreview.record.invoice_id:documentPreview.record.quotation_id}</strong><div className="actions"><label htmlFor="srinuma-paper-choice">PDF Paper</label><select id="srinuma-paper-choice" value={paperSize} onChange={e=>setPaperSize(e.target.value)}><option>A4</option><option>A5</option><option>Letter</option></select><a className="btn btn-primary" href={documentUrl(false)} target="_blank" rel="noopener noreferrer">Open PDF / Print</a><button className="btn" onClick={()=>setDocumentPreview(null)}>Close</button></div></div><iframe title="Professional quotation or invoice preview" key={documentUrl(true)} src={documentUrl(true)} className="professional-doc-frame"/></div></div>}
 </div>;
}
function Field({label,children,wide}:{label:string;children:React.ReactNode;wide?:boolean}){return <div className={`field ${wide?'wide':''}`}><label>{label}</label>{children}</div>;}
function SummaryTile({label,value,detail,active,onClick}:{label:string;value:number;detail:string;active:boolean;onClick:()=>void}){
 return <button type="button" className={'srinuma-summary-card'+(active?' is-selected':'')} aria-pressed={active} aria-label={`${label}: ${value}. Show related records`} onClick={onClick}><span className="srinuma-summary-label">{label}</span><strong>{value}</strong><small>{detail}</small><span className="srinuma-summary-link">View records →</span></button>;
}
function Metric({label,value,icon}:{label:string;value:number;icon:string}){return <section className="metric panel"><div className="metric-top"><span>{label}</span><span>{icon}</span></div><strong>{value}</strong></section>;}
function Empty({text}:{text:string}){return <div className="empty"><p>{text}</p></div>;}
