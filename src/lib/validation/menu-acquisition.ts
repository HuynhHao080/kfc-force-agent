import { z } from "zod";

const text = z.string().min(1).max(1000).refine((v) => v.trim().length > 0, "Blank text");
const key = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/);
const time = z.iso.datetime();
const httpsUrl = z.url({ protocol: /^https$/ }).refine((v) => {
  if (!URL.canParse(v)) return false;
  const url = new URL(v);
  return !url.username && !url.password;
}, "Invalid URL or URL credentials");

// These statuses record supplied evidence, not proof of external authenticity.
const assessment = z.strictObject({
  status: z.enum(["unknown", "not_applicable", "verified", "unverified"]),
  reference: text.nullable(), reason: text.nullable(),
}).superRefine((v, ctx) => {
  if (v.status === "verified" && v.reference === null)
    ctx.addIssue({ code: "custom", path: ["reference"], message: "Evidence reference required" });
  if (v.status !== "verified" && v.reason === null)
    ctx.addIssue({ code: "custom", path: ["reason"], message: "Reason required" });
});
const scopeValue = z.strictObject({
  status: z.enum(["unknown", "not_applicable", "verified", "unverified"]),
  value: text.nullable(), reference: text.nullable(), reason: text.nullable(),
}).superRefine((v, ctx) => {
  const known = v.status === "verified" || v.status === "unverified";
  if (known !== (v.value !== null))
    ctx.addIssue({code:"custom", path:["value"], message:"Value must agree with status"});
  if (v.status === "verified" && v.reference === null)
    ctx.addIssue({code:"custom", path:["reference"], message:"Verified scope requires evidence"});
  if (v.status !== "verified" && v.reason === null)
    ctx.addIssue({code:"custom", path:["reason"], message:"Unresolved or inapplicable scope requires reason"});
});

export const menuAcquisitionManifestSchema = z.strictObject({
  schemaVersion: z.literal(1), snapshotId: key,
  // Path security is enforced by the reader, including both manifest and payload.
  payloadPath: text,
  source: z.strictObject({
    type: z.enum(["demo_fixture", "manual_capture", "provided_export"]),
    namespace: key, url: httpsUrl.nullable(), evidence: assessment,
    sourceUpdatedAt: time.nullable().optional(),
  }),
  capturedAt: time, contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  contentType: z.enum(["application/json", "text/html"]),
  captureMethod: z.enum(["local_fixture", "manual_capture", "provided_export"]),
  httpStatus: z.number().int().min(100).max(599).nullable(),
  scope: z.strictObject({
    store: scopeValue, region: scopeValue, channel: scopeValue,
    currency: scopeValue, description: text,
  }),
  rights: z.strictObject({
    status: z.enum(["unknown", "not_applicable", "verified", "unverified", "denied"]),
    reference: text.nullable(), reason: text.nullable(),
  }).superRefine((v, ctx) => {
    if (v.status === "verified" && v.reference === null)
      ctx.addIssue({code:"custom", path:["reference"], message:"Reuse evidence required"});
    if (v.status !== "verified" && v.reason === null)
      ctx.addIssue({code:"custom", path:["reason"], message:"Rights reason required"});
  }),
  review: z.strictObject({
    status: z.enum(["pending", "approved", "rejected"]), reviewer: text.nullable(),
    reviewedAt: time.nullable(), reference: text.nullable(), reason: text.nullable(),
  }).superRefine((v, ctx) => {
    for (const field of ["reviewer", "reviewedAt", "reference"] as const) {
      if ((v.status === "pending") !== (v[field] === null))
        ctx.addIssue({code:"custom",path:[field],message:"Review fields must agree with status"});
    }
    if (v.status === "rejected" && v.reason === null)
      ctx.addIssue({code:"custom",path:["reason"],message:"Rejection requires a reason"});
  }),
}).superRefine((v, ctx) => {
  const issue = (path: (string | number)[], message: string) => ctx.addIssue({code:"custom",path,message});
  if (v.source.type === "demo_fixture") {
    if (v.source.url !== null) issue(["source","url"], "Demo fixtures cannot claim an external source URL");
    if (v.captureMethod !== "local_fixture") issue(["captureMethod"], "Demo fixture requires local capture");
  } else {
    if (v.captureMethod === "local_fixture") issue(["captureMethod"], "Non-demo source cannot use fixture capture");
    if (v.source.type === "manual_capture" && v.source.url === null) issue(["source","url"], "Web capture requires a URL");
    if (v.source.evidence.status === "not_applicable") issue(["source","evidence"], "Non-demo provenance is applicable");
  }
  if (v.source.sourceUpdatedAt && Date.parse(v.source.sourceUpdatedAt) > Date.parse(v.capturedAt))
    issue(["source","sourceUpdatedAt"], "Source update follows capture");
  if (v.review.reviewedAt && Date.parse(v.review.reviewedAt) < Date.parse(v.capturedAt))
    issue(["review","reviewedAt"], "Review precedes capture");
  if (v.scope.currency.value !== null && v.scope.currency.value !== "VND")
    issue(["scope","currency"], "Only VND supported by S1.2");
});

const rawAmount = z.strictObject({amount:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), currency:z.literal("VND")});
const rawPrice = z.strictObject({current:rawAmount.nullable(), strikethrough:rawAmount.nullable()});
const rawAvailability = z.strictObject({status:z.enum(["available","unavailable"]), observedAt:time});
const rawEntity = {key};
const rawOffer = {
  ...rawEntity, name:text, price:rawPrice.nullable().optional(), availability:rawAvailability.nullable().optional(),
};
/** A curated observation export, not arbitrary web HTML or inferred LLM output. */
export const menuObservationSnapshotSchema = z.strictObject({
  formatVersion:z.literal(1),
  products:z.array(z.strictObject({...rawOffer,category:text.nullable().optional()})).max(5000),
  combos:z.array(z.strictObject({...rawOffer,composition:z.strictObject({
    status:z.enum(["known","unresolved"]),reason:text.nullable(),rawText:text.nullable(),
  })})).max(5000),
  comboItems:z.array(z.strictObject({...rawEntity,comboKey:key,productKey:key,variantKey:key.nullable(),quantity:z.number().int().positive().max(Number.MAX_SAFE_INTEGER)})).max(10000),
  variants:z.array(z.strictObject({...rawOffer,productKey:key,attributes:z.record(key,text)})).max(5000),
  options:z.array(z.strictObject({...rawEntity,productKey:key,variantKey:key.nullable(),name:text,minSelections:z.number().int().min(0).max(100),maxSelections:z.number().int().min(1).max(100)})).max(5000),
  optionValues:z.array(z.strictObject({...rawOffer,optionKey:key})).max(10000),
});

export type AcquisitionManifest = z.infer<typeof menuAcquisitionManifestSchema>;
export type ObservationSnapshot = z.infer<typeof menuObservationSnapshotSchema>;
export interface AcquisitionIssue { code: string; path: string; message: string }
export interface AcquisitionFailure { status:"rejected" | "quarantined"; issues:AcquisitionIssue[] }
