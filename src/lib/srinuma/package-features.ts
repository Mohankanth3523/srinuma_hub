/** Resolve advertised package inclusions with tier inheritance.  A higher tier
 * replaces lower page-count and design-revision caps, rather than showing
 * contradictory limits.  Only Sheet-supplied features are presented. */
type Row = Record<string,string>;
const rank:Record<string,number>={basic:0,standard:1,premium:2};
const active=(x:string|undefined)=>String(x??'true').trim().toLowerCase()!=='false';
const limit=(s:string)=>{
 const match=s.trim().match(/^up to\s+(\d+)\s+(?:responsive\s+)?pages$/i);
 if(match)return {type:'pages',value:Number(match[1])};
 const revision=s.trim().match(/^(\d+)\s+(?:design\s+)?revisions?$/i);
 if(revision)return {type:'revisions',value:Number(revision[1])};
 return null;
};
export function includedFeatures(packageId:string,packages:Row[],features:Row[]):string[]{
 const selected=packages.find(p=>p.package_id===packageId&&active(p.active));if(!selected)return [];
 const tier=rank[String(selected.tier||'').toLowerCase()];
 const parents=packages.filter(p=>p.service_type===selected.service_type&&active(p.active)&&rank[String(p.tier||'').toLowerCase()]!==undefined&&rank[String(p.tier||'').toLowerCase()]<=tier).sort((a,b)=>rank[a.tier.toLowerCase()]-rank[b.tier.toLowerCase()]);
 const names:string[]=[];
 for(const pkg of parents){
  const pkgFeatures=features.filter(f=>f.package_id===pkg.package_id&&active(f.included)).sort((a,b)=>(Number(a.sort_order)||0)-(Number(b.sort_order)||0));
  for(const f of pkgFeatures){const n=String(f.feature_description||'').trim();if(n&&!/^(basic|standard) features$/i.test(n))names.push(n);}
 }
 // When the tier supplies a higher page/revision limit, omit older limits.
 const highest:Record<string,number>={};for(const n of names){const l=limit(n);if(l)highest[l.type]=Math.max(highest[l.type]??0,l.value);}
 const seen=new Set<string>();return names.filter(n=>{const l=limit(n);if(l&&l.value<highest[l.type])return false;const k=n.toLocaleLowerCase('en-IN');if(seen.has(k))return false;seen.add(k);return true;});
}
