import { z } from "zod";

// Offline interchange only. No repository imports, I/O, clock reads or defaults.
const id = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/);
const text = z.string().min(1).max(1000).refine((v) => v.trim().length > 0, "Must not be blank");
const timestamp = z.iso.datetime();
const amount = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const sourceUrl = z.url({ protocol: /^https$/ }).refine((v) => {
  if (!URL.canParse(v)) return false;
  const url = new URL(v);
  return !url.username && !url.password;
}, "Evidence URL must not contain credentials");

export const menuPriceSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("known"), amount, currency: z.literal("VND"), provenanceId: id,
  }),
  z.strictObject({
    status: z.literal("unknown"), amount: z.null(), currency: z.literal("VND"),
    provenanceId: z.null(), reason: text,
  }),
]);

export const menuAvailabilitySchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.enum(["available", "unavailable"]), scope: text,
    provenanceId: id, observedAt: timestamp.nullable(),
  }),
  z.strictObject({
    status: z.literal("unknown"), scope: text, provenanceId: z.null(),
    observedAt: z.null(), reason: text,
  }),
]);

export const menuProvenanceSchema = z.strictObject({
  id,
  sourceKind: z.enum(["seed_demo", "manual", "kfc_official"]),
  sourceUrl: sourceUrl.nullable(),
  sourceRef: text,
  rawSha256: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  observedAt: timestamp.nullable(),
  sourceUpdatedAt: timestamp.nullable(),
  verificationStatus: z.enum(["unverified", "verified"]),
  verifiedAt: timestamp.nullable(),
  verifiedBy: text.nullable(),
  reason: text.nullable(),
}).superRefine((source, ctx) => {
  const issue = (field: string, message: string) => ctx.addIssue({ code: "custom", path: [field], message });
  if (source.sourceKind === "seed_demo") {
    if (source.verificationStatus !== "unverified") issue("verificationStatus", "Demo seed cannot be verified");
    if (source.sourceUrl !== null) issue("sourceUrl", "Demo seed has no official source URL");
    if (source.observedAt !== null) issue("observedAt", "Seed declarations are not live observations");
  }
  if (source.sourceKind === "kfc_official" && source.sourceUrl === null)
    issue("sourceUrl", "Official source declaration requires a URL");
  if (source.verificationStatus === "verified") {
    for (const field of ["sourceUrl", "rawSha256", "observedAt", "verifiedAt", "verifiedBy"] as const) {
      if (source[field] === null) issue(field, "Verified evidence requires this field");
    }
    if (source.reason !== null) issue("reason", "Verified evidence must not retain an unverified reason");
  } else {
    if (source.reason === null) issue("reason", "Unverified evidence requires a reason");
    if (source.verifiedAt !== null) issue("verifiedAt", "Unverified source cannot claim verification time");
    if (source.verifiedBy !== null) issue("verifiedBy", "Unverified source cannot claim a reviewer");
  }
});

const entity = { id, provenanceId: id, createdAt: timestamp, updatedAt: timestamp };
const offer = { ...entity, name: text, price: menuPriceSchema, availability: menuAvailabilitySchema };
export const menuProductSchema = z.strictObject(offer);
export const menuComboSchema = z.strictObject({
  ...offer,
  compositionStatus: z.enum(["known", "unknown"]),
  compositionReason: text.nullable(),
});
export const menuComboItemSchema = z.strictObject({
  ...entity, comboId: id, productId: id, variantId: id.nullable(),
  quantity: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
});
export const menuVariantSchema = z.strictObject({
  ...offer, productId: id,
  attributes: z.record(id, text).refine((v) => Object.keys(v).length > 0, "Variant requires explicit attributes"),
});
export const menuOptionSchema = z.strictObject({
  ...entity, productId: id, variantId: id.nullable(), name: text,
  minSelections: z.number().int().min(0).max(100),
  maxSelections: z.number().int().min(1).max(100),
});
export const menuOptionValueSchema = z.strictObject({
  ...entity, optionId: id, name: text,
  priceDelta: menuPriceSchema, availability: menuAvailabilitySchema,
});

const catalogCollections = ["products", "combos", "comboItems", "variants", "options", "optionValues"] as const;
type IssuePath = (string | number)[];

/** Full-dataset validation is required for reference/evidence integrity. */
export const menuDatasetSchema = z.strictObject({
  schemaVersion: z.literal(1),
  datasetId: id,
  datasetVersion: text,
  classification: z.enum(["seed_demo", "unverified", "kfc_verified"]),
  updatedAt: timestamp,
  provenance: z.array(menuProvenanceSchema).min(1),
  products: z.array(menuProductSchema).min(1),
  combos: z.array(menuComboSchema),
  comboItems: z.array(menuComboItemSchema),
  variants: z.array(menuVariantSchema),
  options: z.array(menuOptionSchema),
  optionValues: z.array(menuOptionValueSchema),
}).superRefine((data, ctx) => {
  const issue = (path: IssuePath, message: string) => ctx.addIssue({ code: "custom", path, message });
  const after = (a: string, b: string) => Date.parse(a) > Date.parse(b);
  const sources = new Map(data.provenance.map((s) => [s.id, s]));
  const products = new Map(data.products.map((p) => [p.id, p]));
  const combos = new Map(data.combos.map((c) => [c.id, c]));
  const variants = new Map(data.variants.map((v) => [v.id, v]));
  const options = new Map(data.options.map((o) => [o.id, o]));

  for (const collection of ["provenance", ...catalogCollections] as const) {
    const seen = new Set<string>();
    data[collection].forEach((row, i) => {
      if (seen.has(row.id)) issue([collection, i, "id"], "Duplicate ID in collection");
      seen.add(row.id);
    });
  }
  data.combos.forEach((combo, i) => {
    if (products.has(combo.id)) issue(["combos", i, "id"], "Product and combo IDs cannot overlap");
  });
  const sourceFor = (sourceId: string, path: IssuePath) => {
    const source = sources.get(sourceId);
    if (!source) issue(path, "Unknown provenance ID");
    return source;
  };
  const variantFor = (variantId: string | null, productId: string, path: IssuePath) => {
    if (variantId === null) return;
    const variant = variants.get(variantId);
    if (!variant) issue(path, "Unknown variant ID");
    else if (variant.productId !== productId) issue(path, "Variant belongs to another product");
  };

  data.provenance.forEach((source, i) => {
    const path = ["provenance", i];
    for (const field of ["sourceUpdatedAt", "observedAt", "verifiedAt"] as const) {
      const value = source[field];
      if (value !== null && after(value, data.updatedAt)) issue([...path, field], "Evidence time follows dataset update");
    }
    if (source.sourceUpdatedAt && source.observedAt && after(source.sourceUpdatedAt, source.observedAt))
      issue([...path, "sourceUpdatedAt"], "Source update follows observation");
    if (source.observedAt && source.verifiedAt && after(source.observedAt, source.verifiedAt))
      issue([...path, "verifiedAt"], "Verification precedes observation");
  });
  if (data.classification === "seed_demo" && data.provenance.some((s) => s.sourceKind !== "seed_demo"))
    issue(["classification"], "Demo dataset must contain only demo provenance");
  if (data.classification === "kfc_verified" && data.provenance.some((s) => s.sourceKind !== "kfc_official" || s.verificationStatus !== "verified"))
    issue(["classification"], "Verified KFC dataset requires only verified official sources");

  for (const collection of catalogCollections) {
    data[collection].forEach((row, i) => {
      sourceFor(row.provenanceId, [collection, i, "provenanceId"]);
      if (after(row.createdAt, row.updatedAt)) issue([collection, i, "createdAt"], "Creation follows update");
      if (after(row.updatedAt, data.updatedAt)) issue([collection, i, "updatedAt"], "Entity update follows dataset update");
    });
  }
  for (const collection of ["products", "combos", "variants", "optionValues"] as const) {
    data[collection].forEach((row, i) => {
      const field = "price" in row ? "price" : "priceDelta";
      const price = "price" in row ? row.price : row.priceDelta;
      if (price.status === "known") sourceFor(price.provenanceId, [collection, i, field, "provenanceId"]);
      const availability = row.availability;
      if (availability.status === "unknown") return;
      const source = sourceFor(availability.provenanceId, [collection, i, "availability", "provenanceId"]);
      const path = [collection, i, "availability", "observedAt"];
      if (source && source.sourceKind !== "seed_demo" && (availability.observedAt === null || source.observedAt === null))
        issue(path, "Non-demo availability requires observation and observed evidence");
      if (source?.sourceKind === "seed_demo" && availability.observedAt !== null)
        issue(path, "Demo availability is a declaration, not an observation");
      if (availability.observedAt && (after(availability.observedAt, row.updatedAt) ||
        (source?.observedAt && after(availability.observedAt, source.observedAt))))
        issue(path, "Availability observation follows entity update or evidence observation");
    });
  }

  data.variants.forEach((variant, i) => {
    if (!products.has(variant.productId)) issue(["variants", i, "productId"], "Unknown product ID");
  });
  data.options.forEach((option, i) => {
    if (!products.has(option.productId)) issue(["options", i, "productId"], "Unknown product ID");
    variantFor(option.variantId, option.productId, ["options", i, "variantId"]);
    if (option.minSelections > option.maxSelections) issue(["options", i, "minSelections"], "Minimum exceeds maximum");
    const count = data.optionValues.filter((v) => v.optionId === option.id).length;
    if (option.maxSelections > count) issue(["options", i, "maxSelections"], "Insufficient declared option values");
  });
  data.optionValues.forEach((value, i) => {
    if (!options.has(value.optionId)) issue(["optionValues", i, "optionId"], "Unknown option ID");
  });
  const componentKeys = new Set<string>();
  data.comboItems.forEach((component, i) => {
    if (!combos.has(component.comboId)) issue(["comboItems", i, "comboId"], "Unknown combo ID");
    if (!products.has(component.productId)) issue(["comboItems", i, "productId"], "Unknown product ID; nested combos unsupported");
    variantFor(component.variantId, component.productId, ["comboItems", i, "variantId"]);
    const key = JSON.stringify([component.comboId, component.productId, component.variantId]);
    if (componentKeys.has(key)) issue(["comboItems", i, "productId"], "Duplicate component/variant in combo");
    componentKeys.add(key);
  });
  data.combos.forEach((combo, i) => {
    const count = data.comboItems.filter((c) => c.comboId === combo.id).length;
    if (combo.compositionStatus === "known") {
      if (count === 0) issue(["combos", i, "compositionStatus"], "Known composition requires components");
      if (combo.compositionReason !== null) issue(["combos", i, "compositionReason"], "Known composition must not retain unknown reason");
    } else {
      if (count !== 0) issue(["combos", i, "compositionStatus"], "Unknown composition cannot assert components");
      if (combo.compositionReason === null) issue(["combos", i, "compositionReason"], "Unknown composition requires reason");
    }
  });
});
