import type { MenuDataPrice } from "@/lib/types/menu-data";
import type { StagedSnapshot, StagingResult } from "./normalize";

interface Change { kind:string; entityId:string; before:unknown; after:unknown }
export interface StagingDiff { status:"compared"|"scope_mismatch"|"skipped"; changes:Change[] }
function canonical(value:unknown):string {
  if (Array.isArray(value)) return `[${value.map(canonical).sort().join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries=Object.entries(value).sort(([a],[b])=>a<b ? -1 : a>b ? 1 : 0);
    return "{"+entries.map(([k,v])=>JSON.stringify(k)+":"+canonical(v)).join(",")+"}";
  }
  return JSON.stringify(value);
}
const price=(p:MenuDataPrice)=>({status:p.status,amount:p.amount,currency:p.currency});

/** Comparison only: missing observations never mutate the last reviewed catalog. */
export function diffStaging(previous:StagedSnapshot,next:StagingResult):StagingDiff {
  if (next.status !== "staged") return {status:"skipped",changes:[]};
  if (previous.identityScope !== next.identityScope) return {status:"scope_mismatch",changes:[]};
  const changes:Change[]=[];
  const compare=(kind:string,entityId:string,before:unknown,after:unknown)=>{
    if (canonical(before)!==canonical(after)) changes.push({kind,entityId,before,after});
  };
  for (const collection of ["products","combos","variants"] as const) {
    const before=new Map(previous.dataset[collection].map((r)=>[r.id,r]));
    const after=new Map(next.dataset[collection].map((r)=>[r.id,r]));
    for (const [id,row] of before) {
      const current=after.get(id);
      if (!current) changes.push({kind:"missing_from_snapshot",entityId:id,before:{collection,name:row.name},after:null});
      else {
        compare("price_changed",id,price(row.price),price(current.price));
        compare("name_changed",id,row.name,current.name);
        compare("availability_changed",id,row.availability.status,current.availability.status);
        if ("attributes" in row && "attributes" in current) compare("variant_changed",id,row.attributes,current.attributes);
      }
    }
    for (const [id,row] of after) if (!before.has(id)) changes.push({kind:"added",entityId:id,before:null,after:{collection,name:row.name}});
  }
  const composition=(s:StagedSnapshot,id:string)=>({
    status:s.dataset.combos.find((c)=>c.id===id)?.compositionStatus,
    items:s.dataset.comboItems.filter((c)=>c.comboId===id).map((c)=>({productId:c.productId,variantId:c.variantId,quantity:c.quantity})),
  });
  for (const combo of next.dataset.combos) if (previous.dataset.combos.some((c)=>c.id===combo.id))
    compare("composition_changed",combo.id,composition(previous,combo.id),composition(next,combo.id));
  const selections=(s:StagedSnapshot,id:string)=>s.dataset.options.filter((o)=>o.productId===id).map((o)=>({
    id:o.id,name:o.name,variantId:o.variantId,min:o.minSelections,max:o.maxSelections,
    values:s.dataset.optionValues.filter((v)=>v.optionId===o.id).map((v)=>({id:v.id,name:v.name,price:price(v.priceDelta),availability:v.availability.status})),
  }));
  for (const product of next.dataset.products) if (previous.dataset.products.some((p)=>p.id===product.id))
    compare("options_changed",product.id,selections(previous,product.id),selections(next,product.id));
  const referencePrice=(s:StagedSnapshot,id:string)=>s.evidence.referencePrices.filter((p)=>p.entityId===id).map((p)=>p.price);
  const referenceIds=new Set([...previous.evidence.referencePrices,...next.evidence.referencePrices].map((p)=>p.entityId));
  for (const id of referenceIds) compare("reference_price_changed",id,referencePrice(previous,id),referencePrice(next,id));
  for (const change of changes) {
    // Output arrays are already sorted by normalizer; comparator also ignores raw order.
    change.before=structuredClone(change.before); change.after=structuredClone(change.after);
  }
  changes.sort((a,b)=>canonical([a.kind,a.entityId])<canonical([b.kind,b.entityId]) ? -1 : canonical([a.kind,a.entityId])>canonical([b.kind,b.entityId]) ? 1 : 0);
  return {status:"compared",changes};
}
