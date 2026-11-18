import type { z } from "zod";
import type { nluContextSchema, nluEntitySchema, nluIntentSchema, nluResultSchema } from "@/lib/validation/nlu";

export type NluResult = z.infer<typeof nluResultSchema>;
export type NluIntent = z.infer<typeof nluIntentSchema>;
export type NluEntity = z.infer<typeof nluEntitySchema>;
export type NluTrustedContext = z.infer<typeof nluContextSchema>;
export type NluAdapterResult =
  | { ok: true; value: NluResult; contextScope: Pick<NluTrustedContext, "menuVersion" | "classification" | "storeId" | "channel"> }
  | { ok: false; error: { kind: "parse_error" | "validation_error" | "context_error"; issues: string[] }; fallback: Extract<NluResult, { status: "error" }> };
