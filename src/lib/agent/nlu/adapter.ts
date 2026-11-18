import { nluContextSchema, nluResultSchema } from "@/lib/validation/nlu";
import type { NluAdapterResult } from "@/lib/types/nlu";

export const MAX_NLU_OUTPUT_BYTES = 65536;

/** Pure offline adapter. Caller supplies an LLM output, never an utterance lookup. */
export function parseNluOutput(raw: string, trustedContext: unknown): NluAdapterResult {
  const fail = (kind: "parse_error" | "validation_error" | "context_error", issues: string[]): NluAdapterResult => ({
    ok: false, error: { kind, issues }, fallback: { status: "error", code: kind, message: "NLU output rejected; no action authorized." },
  });
  const context = nluContextSchema.safeParse(trustedContext);
  if (!context.success) return fail("context_error", context.error.issues.map(i => i.message));
  if (typeof raw !== "string" || new TextEncoder().encode(raw).length > MAX_NLU_OUTPUT_BYTES) return fail("parse_error", ["Output missing or exceeds byte limit"]);
  let json: unknown;
  try { json = JSON.parse(raw); } catch { return fail("parse_error", ["Output must be exactly one JSON document"]); }
  const parsed = nluResultSchema.safeParse(json);
  if (!parsed.success) return fail("validation_error", parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`));
  const result = parsed.data;
  if (result.status !== "error") {
    const issues: string[] = [];
    const products = new Map(context.data.products.map(p => [p.id, p]));
    const entities = new Map(result.entities.map(e => [e.id, e]));
    const productFor = (targetId: string) => {
      const target = entities.get(targetId);
      const productId = target?.kind === "product" ? target.productId : target?.kind === "reference" ? context.data.references.find(r => r.id === target.referentId)?.productId : null;
      return productId ? products.get(productId) : undefined;
    };
    for (const entity of result.entities) {
      if (entity.kind === "product" && entity.productId !== null && !products.has(entity.productId)) issues.push(`Unknown product ID: ${entity.productId}`);
      if (entity.kind === "reference" && entity.referentId !== null && !context.data.references.some(r => r.id === entity.referentId)) issues.push(`Unknown context referent: ${entity.referentId}`);
      if (entity.kind === "option") {
        const product = productFor(entity.targetId);
        const option = product?.options.find(o => o.id === entity.optionId);
        if (entity.optionId !== null && !option) issues.push("Option not owned by resolved product in supplied scope");
        if (entity.valueId !== null && !option?.values.includes(entity.valueId)) issues.push("Option value not owned by option");
      }
    }
    if (issues.length) return fail("context_error", issues);
  }
  const { menuVersion, classification, storeId, channel } = context.data;
  return { ok: true, value: result, contextScope: { menuVersion, classification, storeId, channel } };
}
