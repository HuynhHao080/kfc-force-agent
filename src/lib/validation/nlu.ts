import { z } from "zod";

// Offline semantic interchange. No defaults, tools, storage, inference or I/O.
const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/);
const text = z.string().trim().min(1).max(2000);
const base = { id, text };
export const nluEntitySchema = z.discriminatedUnion("kind", [
  z.strictObject({ ...base, kind: z.literal("product"), productId: id.nullable() }),
  z.strictObject({ ...base, kind: z.literal("reference"), referentId: id.nullable() }),
  z.strictObject({ ...base, kind: z.literal("option"), targetId: id, optionId: id.nullable(), valueId: id.nullable() }),
  z.strictObject({ ...base, kind: z.literal("quantity"), mode: z.enum(["delta", "absolute"]), value: z.number().int().min(-100).max(100).refine(v => v !== 0) }),
  z.strictObject({ ...base, kind: z.literal("volume"), targetId: id, value: z.number().positive().max(100000), unit: z.literal("ml") }),
  z.strictObject({ ...base, kind: z.literal("budget"), amount: z.number().int().nonnegative().max(100000000), currency: z.literal("VND"), scope: z.enum(["total", "per_person", "per_item"]).nullable() }),
  z.strictObject({ ...base, kind: z.literal("party_size"), value: z.number().int().min(1).max(1000) }),
  z.strictObject({ ...base, kind: z.literal("preference"), targetId: id.nullable(), attribute: z.enum(["spice", "ingredient", "category", "beverage", "dietary"]), operator: z.enum(["eq", "neq"]), value: text }),
]);
const intentBase = { id, polarity: z.enum(["affirmed", "negated"]) };
export const nluIntentSchema = z.discriminatedUnion("kind", [
  z.strictObject({ ...intentBase, kind: z.literal("search_product"), targetIds: z.array(id).max(20) }),
  ...(["request_recommendation", "get_product_details", "ask_price", "ask_combo_contents", "ask_options", "ask_availability"] as const).map(kind => z.strictObject({ ...intentBase, kind: z.literal(kind), targetIds: z.array(id).max(20) })),
  ...(["add_item", "set_quantity", "adjust_quantity"] as const).map(kind => z.strictObject({ ...intentBase, kind: z.literal(kind), targetId: id.nullable(), quantityId: id.nullable() })),
  z.strictObject({ ...intentBase, kind: z.literal("remove_line"), targetId: id.nullable() }),
  ...(["view_cart", "clear_cart", "express_assent", "greeting", "cancel_proposal", "answer_clarification", "correct_request"] as const).map(kind => z.strictObject({ ...intentBase, kind: z.literal(kind) })),
  z.strictObject({ ...intentBase, kind: z.literal("unsupported_request"), reason: text }),
]);
const semantic = {
  intents: z.array(nluIntentSchema).max(20),
  entities: z.array(nluEntitySchema).max(100),
  constraintGroups: z.array(z.strictObject({ operator: z.enum(["all", "any"]), entityIds: z.array(id).min(1).max(30) })).max(20).optional(),
};
export const nluResultSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("understood"), ...semantic }),
  z.strictObject({ status: z.literal("needs_clarification"), ...semantic, missingSlots: z.array(z.enum(["product", "quantity", "reference", "option", "budget_scope", "meaning"])).min(1).max(6), reason: text }),
  z.strictObject({ status: z.literal("unsupported"), ...semantic, reason: text }),
  z.strictObject({ status: z.literal("error"), code: z.enum(["provider_error", "parse_error", "validation_error", "context_error"]), message: text }),
]).superRefine((result, ctx) => {
  if (result.status === "error") return;
  const fail = (message: string) => ctx.addIssue({ code: "custom", message });
  const entities = new Map(result.entities.map(e => [e.id, e]));
  const ids = [...result.intents, ...result.entities].map(e => e.id);
  if (new Set(ids).size !== ids.length) fail("Intent/entity IDs must be unique");
  if (result.status === "understood" && !result.intents.length) fail("Understood needs at least one intent");
  const target = (ref: string | null) => {
    const entity = ref === null ? undefined : entities.get(ref);
    return entity?.kind === "product" || entity?.kind === "reference" ? entity : undefined;
  };
  for (const intent of result.intents) {
    const refs = "targetIds" in intent ? intent.targetIds : "targetId" in intent ? [intent.targetId] : [];
    if (result.status === "understood" && "targetIds" in intent && !["search_product", "request_recommendation"].includes(intent.kind) && !intent.targetIds.length) fail("Product question needs a target");
    for (const ref of refs) if (ref !== null && !target(ref)) fail(`Invalid product reference: ${ref}`);
    if (result.status === "understood" && intent.polarity === "affirmed" && "targetId" in intent && !target(intent.targetId)) fail("Mutation target missing");
    if ("quantityId" in intent) {
      const q = intent.quantityId === null ? undefined : entities.get(intent.quantityId);
      if (intent.quantityId !== null && q?.kind !== "quantity") fail("Invalid quantity reference");
      if (result.status === "understood" && intent.polarity === "affirmed" && !q) fail("Quantity missing");
      if (q?.kind === "quantity") {
        const mode = intent.kind === "set_quantity" ? "absolute" : "delta";
        if (q.mode !== mode || (intent.kind !== "adjust_quantity" && q.value < 1)) fail("Quantity operation mismatch");
      }
    }
  }
  for (const entity of result.entities) {
    if ("targetId" in entity && entity.targetId !== null && !target(entity.targetId)) fail("Invalid entity target");
    const unresolved = (entity.kind === "product" && entity.productId === null) || (entity.kind === "reference" && entity.referentId === null) || (entity.kind === "option" && (entity.optionId === null || entity.valueId === null)) || (entity.kind === "budget" && entity.scope === null);
    if (unresolved && result.status === "understood") fail("Unresolved entity requires clarification or unsupported status");
    if (entity.kind === "quantity" && entity.mode === "absolute" && entity.value < 1) fail("Absolute quantity must be positive");
  }
  for (const group of result.constraintGroups ?? []) for (const ref of group.entityIds) {
    if (!["preference", "budget", "party_size"].includes(entities.get(ref)?.kind ?? "")) fail("Invalid constraint reference");
  }
});

export const nluContextSchema = z.strictObject({
  classification: z.enum(["seed_demo", "unverified"]),
  menuVersion: id,
  storeId: id.nullable(),
  channel: id.nullable(),
  products: z.array(z.strictObject({ id, name: text, options: z.array(z.strictObject({ id, values: z.array(id).max(100) })).max(50) })).max(1000),
  cart: z.strictObject({ revision: id, lines: z.array(z.strictObject({ id, productId: id, quantity: z.number().int().min(1).max(100), optionValueIds: z.array(id) })).max(100) }),
  references: z.array(z.strictObject({ id, productId: id })).max(100),
}).superRefine((context, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: "custom", message });
  const products = new Map(context.products.map(p => [p.id, p]));
  for (const collection of [context.products, context.cart.lines, context.references]) if (new Set(collection.map(v => v.id)).size !== collection.length) fail("Duplicate context ID");
  for (const product of context.products) {
    if (new Set(product.options.map(o => o.id)).size !== product.options.length) fail("Duplicate option ID");
    for (const option of product.options) if (new Set(option.values).size !== option.values.length) fail("Duplicate option value");
  }
  for (const entry of [...context.cart.lines, ...context.references]) if (!products.has(entry.productId)) fail("Context references unknown product");
  for (const line of context.cart.lines) {
    const values = products.get(line.productId)?.options.flatMap(o => o.values) ?? [];
    if (line.optionValueIds.some(v => !values.includes(v))) fail("Unknown cart option value");
  }
});
