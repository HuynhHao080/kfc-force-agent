import { createHash } from "node:crypto";
import type { AcquisitionManifest } from "@/lib/validation/menu-acquisition";

const digest = (value:unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0,32);

/** No names, alt text, fuzzy matches or guessed official SKU IDs. */
export function identityScope(manifest:AcquisitionManifest):string {
  const fields=[manifest.scope.store,manifest.scope.region,manifest.scope.channel,manifest.scope.currency];
  const unresolved=fields.some((f)=>f.status !== "verified" && f.status !== "not_applicable");
  return digest([
    manifest.source.type,manifest.source.namespace,manifest.source.url,
    fields.map((f)=>[f.status,f.value]),
    // Unknown/unverified scope never silently links separate captures.
    unresolved ? manifest.snapshotId : null,
  ]);
}
export function localEntityId(scope:string, collection:string, observationKey:string):string {
  return `local_${digest([scope,collection,observationKey])}`;
}
