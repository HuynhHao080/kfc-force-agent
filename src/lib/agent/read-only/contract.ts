import { z } from "zod";

const id = z.string().trim().min(1).max(160);
export const readIntentsSchema = z.array(z.enum(["recommendation", "menu", "item", "cart"])).min(1).max(4);
const clearConstraintsSchema = z.array(z.enum(["budget", "partySize", "spicy", "unverified"])).max(4).optional();
export const constraintsSchema = z.object({
  budget: z.object({ amount: z.number().int().nonnegative().max(100_000_000), currency: z.literal("VND"), operator: z.enum(["lt", "lte", "eq"]), scope: z.enum(["total", "per_person", "per_item", "unspecified"]), approximate: z.boolean() }).strict().nullable(),
  partySize: z.number().int().min(1).max(100).nullable(),
  spicy: z.boolean().nullable(),
  unverified: z.array(z.string().min(1).max(240)).max(20),
}).strict();
const empty = z.object({}).strict();
const request = z.discriminatedUnion("type", [
  z.object({ id, type: z.literal("LIST_MENU"), parameters: empty }).strict(),
  z.object({ id, type: z.literal("VIEW_CART"), parameters: empty }).strict(),
  z.object({ id, type: z.literal("SEARCH_MENU"), parameters: z.object({ query: z.string().trim().min(1).max(240) }).strict() }).strict(),
  z.object({ id, type: z.literal("GET_MENU_ITEM"), parameters: z.object({ itemId: id }).strict() }).strict(),
]);
export const clarificationSchema = z.object({
  kind: z.literal("clarification"),
  slot: z.enum(["budget_scope", "budget", "party_size", "product", "reference", "attribute", "meaning"]),
  constraints: constraintsSchema.optional(),
  intents: readIntentsSchema.optional(),
  clearConstraints: clearConstraintsSchema,
}).strict();
const unsupported = z.object({
  kind: z.literal("unsupported"),
  reason: z.enum(["cart_mutation", "order_submission", "capability"]),
}).strict();
const conversation = z.object({ kind: z.literal("conversation"), act: z.enum(["greeting", "thanks", "help"]) }).strict();
export const readPlanSchema = z.object({
  kind: z.literal("read"),
  intents: readIntentsSchema,
  requests: z.array(request).min(1).max(4).refine((rows) => new Set(rows.map((r) => r.id)).size === rows.length, "Duplicate read ID"),
  constraints: constraintsSchema,
  clearConstraints: clearConstraintsSchema,
}).strict();
export const understandingSchema = z.discriminatedUnion("kind", [readPlanSchema, clarificationSchema, unsupported, conversation]);
export const answerSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("recommendation"), items: z.array(z.object({ itemId: id, quantity: z.number().int().min(1).max(100) }).strict()).min(1).max(20) }).strict(),
  z.object({ kind: z.literal("menu"), itemIds: z.array(id).min(1).max(40) }).strict(),
  z.object({ kind: z.literal("cart") }).strict(),
  z.object({ kind: z.literal("no_match") }).strict(),
  clarificationSchema, unsupported,
]);
export type ReadPlan = z.infer<typeof readPlanSchema>;
export type Answer = z.infer<typeof answerSchema>;

// Export schemas to the provider prompt. No golden cases or held-out examples.
export const understandingJsonSchema = z.toJSONSchema(understandingSchema);
export const answerJsonSchema = z.toJSONSchema(answerSchema);

export interface ReadOnlyTrace {
  provider: "bedrock";
  modelId?: string;
  region?: string;
  mode: "read_only";
  calls: number;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  error?: string;
  failure?: {
    stage: "understanding" | "answer";
    code: "invalid_json" | "output_limit";
    outputFormat: "json_object" | "markdown_fence" | "other";
    outputBytes: number;
  };
}
