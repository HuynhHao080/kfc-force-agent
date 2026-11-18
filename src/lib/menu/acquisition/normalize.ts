import { menuDatasetSchema } from "@/lib/validation/menu-data";
import type { AcquisitionFailure, AcquisitionManifest, AcquisitionIssue } from "@/lib/validation/menu-acquisition";
import type { MenuDatasetV1, MenuDataPrice, MenuDataAvailability } from "@/lib/types/menu-data";
import { acquisitionFailure, isAcceptedSnapshot, type SnapshotReadResult } from "./snapshot-reader";
import { identityScope, localEntityId } from "./identity";

interface Unresolved { entityId:string; field:string; reason:string }
interface FieldEvidence { entityId:string; field:string; pointer:string }
interface PriceObservation { amount:number; currency:"VND" }
interface OfferObservation {
  price?: {current:PriceObservation|null;strikethrough:PriceObservation|null}|null;
  availability?: {status:"available"|"unavailable";observedAt:string}|null;
}
export interface StagedSnapshot {
  status:"staged"; reviewStatus:"pending"; identityScope:string; dataset:MenuDatasetV1;
  unresolved:Unresolved[];
  evidence: {
    manifest:AcquisitionManifest;
    fields:FieldEvidence[];
    categories:{entityId:string;category:string;pointer:string}[];
    referencePrices:{entityId:string;price:PriceObservation;pointer:string}[];
    compositionText:{entityId:string;text:string;pointer:string}[];
  };
}
export type StagingResult = StagedSnapshot | AcquisitionFailure;
const collections=["products","combos","comboItems","variants","options","optionValues"] as const;

/** Pure conversion of accepted observations. It never publishes or saves data. */
export function normalizeSnapshot(intake:SnapshotReadResult):StagingResult {
  if (intake.status !== "accepted") return structuredClone(intake);
  if (!isAcceptedSnapshot(intake)) return acquisitionFailure("UNTRUSTED_INTAKE","Normalize only an original immutable reader result");
  const {manifest,snapshot}=intake;
  const scope=identityScope(manifest), id=(kind:string,key:string)=>localEntityId(scope,kind,key);
  const sourceId=`snapshot.${manifest.snapshotId}`;
  const unresolved:Unresolved[]=[], fields:FieldEvidence[]=[];
  const categories:StagedSnapshot["evidence"]["categories"]=[], referencePrices:StagedSnapshot["evidence"]["referencePrices"]=[], compositionText:StagedSnapshot["evidence"]["compositionText"]=[];
  for (const collection of collections) {
    const seen=new Set<string>();
    for (const row of snapshot[collection]) {
      if (seen.has(row.key)) return acquisitionFailure("DUPLICATE_KEY","Duplicate observation key","quarantined",collection);
      seen.add(row.key);
    }
  }
  for (const collection of ["products","combos","variants","optionValues"] as const) {
    for (const row of snapshot[collection]) {
      if (row.availability && Date.parse(row.availability.observedAt)>Date.parse(manifest.capturedAt))
        return acquisitionFailure("OBSERVATION_TIME","Observation follows capture","quarantined",collection);
    }
  }
  const base=(collection:string,key:string,index:number)=>{
    const entityId=id(collection,key);
    fields.push({entityId,field:"record",pointer:`/${collection}/${index}`});
    return {id:entityId,provenanceId:sourceId,createdAt:manifest.capturedAt,updatedAt:manifest.capturedAt};
  };
  const facts=(row:OfferObservation,entityId:string,pointer:string,priceField="price")=>{
    let price:MenuDataPrice;
    if (row.price?.current) {
      price={status:"known",...row.price.current,provenanceId:sourceId};
      fields.push({entityId,field:priceField,pointer:`${pointer}/price/current`});
    } else {
      price={status:"unknown",amount:null,currency:"VND",provenanceId:null,reason:"Current price not observed in snapshot"};
      unresolved.push({entityId,field:priceField,reason:price.reason});
    }
    if (row.price?.strikethrough) referencePrices.push({entityId,price:{...row.price.strikethrough},pointer:`${pointer}/price/strikethrough`});
    let availability:MenuDataAvailability;
    if (row.availability) {
      // A demo declaration is never a timestamped live stock observation.
      availability={...row.availability,scope:manifest.scope.description,provenanceId:sourceId,
        observedAt:manifest.source.type === "demo_fixture" ? null : row.availability.observedAt};
      fields.push({entityId,field:"availability",pointer:`${pointer}/availability`});
    } else {
      availability={status:"unknown",scope:manifest.scope.description,provenanceId:null,observedAt:null,reason:"Availability not observed in snapshot"};
      unresolved.push({entityId,field:"availability",reason:availability.reason});
    }
    return {price,availability};
  };
  // Missing references still map deterministically and are rejected by S1.2.
  const dataset:MenuDatasetV1={
    schemaVersion:1,datasetId:`offline.${scope}`,datasetVersion:manifest.snapshotId,
    classification:manifest.source.type === "demo_fixture" ? "seed_demo" : "unverified",
    updatedAt:manifest.capturedAt,
    provenance:[{
      id:sourceId,sourceKind:manifest.source.type === "demo_fixture" ? "seed_demo" : "manual",
      sourceUrl:manifest.source.url,sourceRef:`snapshot:${manifest.snapshotId}/${manifest.payloadPath}`,
      rawSha256:manifest.contentHash,observedAt:manifest.source.type === "demo_fixture" ? null : manifest.capturedAt,
      sourceUpdatedAt:manifest.source.sourceUpdatedAt ?? null,
      verificationStatus:"unverified",verifiedAt:null,verifiedBy:null,
      reason:"Offline staging only; source evidence and rights assertions retained in acquisition manifest; no KFC verification",
    }],
    products:snapshot.products.map((row,i)=>{
      const entity=base("products",row.key,i);
      if (row.category) categories.push({entityId:entity.id,category:row.category,pointer:`/products/${i}/category`});
      return {...entity,name:row.name,...facts(row,entity.id,`/products/${i}`)};
    }),
    combos:snapshot.combos.map((row,i)=>{
      const entity=base("combos",row.key,i);
      if (row.composition.rawText) compositionText.push({entityId:entity.id,text:row.composition.rawText,pointer:`/combos/${i}/composition/rawText`});
      if (row.composition.status === "unresolved") unresolved.push({entityId:entity.id,field:"composition",reason:row.composition.reason ?? "Composition unresolved in snapshot"});
      return {...entity,name:row.name,...facts(row,entity.id,`/combos/${i}`),
        compositionStatus:row.composition.status === "known" ? "known" as const : "unknown" as const,
        compositionReason:row.composition.reason};
    }),
    comboItems:snapshot.comboItems.map((row,i)=>({...base("comboItems",row.key,i),comboId:id("combos",row.comboKey),productId:id("products",row.productKey),variantId:row.variantKey === null ? null : id("variants",row.variantKey),quantity:row.quantity})),
    variants:snapshot.variants.map((row,i)=>{
      const entity=base("variants",row.key,i);
      return {...entity,productId:id("products",row.productKey),name:row.name,attributes:{...row.attributes},...facts(row,entity.id,`/variants/${i}`)};
    }),
    options:snapshot.options.map((row,i)=>({...base("options",row.key,i),productId:id("products",row.productKey),variantId:row.variantKey === null ? null : id("variants",row.variantKey),name:row.name,minSelections:row.minSelections,maxSelections:row.maxSelections})),
    optionValues:snapshot.optionValues.map((row,i)=>{
      const entity=base("optionValues",row.key,i), observed=facts(row,entity.id,`/optionValues/${i}`,"priceDelta");
      return {...entity,optionId:id("options",row.optionKey),name:row.name,priceDelta:observed.price,availability:observed.availability};
    }),
  };
  const checked=menuDatasetSchema.safeParse(dataset);
  if (!checked.success) return {status:"quarantined",issues:checked.error.issues.map((issue):AcquisitionIssue=>({code:"CONTRACT_INVALID",path:issue.path.join("."),message:issue.message}))};
  for (const collection of collections) checked.data[collection].sort((a,b)=>a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const order=(a:unknown,b:unknown)=>JSON.stringify(a)<JSON.stringify(b) ? -1 : JSON.stringify(a)>JSON.stringify(b) ? 1 : 0;
  return {status:"staged",reviewStatus:"pending",identityScope:scope,dataset:checked.data,
    unresolved:unresolved.sort(order),evidence:{manifest:structuredClone(manifest),fields:fields.sort(order),categories:categories.sort(order),referencePrices:referencePrices.sort(order),compositionText:compositionText.sort(order)}};
}
