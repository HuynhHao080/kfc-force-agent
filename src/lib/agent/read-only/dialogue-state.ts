import { z } from "zod";
import { clarificationSchema, constraintsSchema, readIntentsSchema } from "./contract";

const dialogueSchema = z.object({
  version: z.literal(1),
  revision: z.number().int().nonnegative().max(1_000_000),
  interpretation: z.literal("llm_request_interpretation"),
  pendingSlot: clarificationSchema.shape.slot.nullable(),
  clarificationCount: z.number().int().nonnegative().max(1_000_000),
  constraints: constraintsSchema,
  intents: readIntentsSchema.or(z.tuple([])),
}).strict();

export type ReadOnlyDialogueState = z.infer<typeof dialogueSchema>;
export type ClarificationSlot = z.infer<typeof clarificationSchema>["slot"];

export function loadDialogueState(value: unknown): ReadOnlyDialogueState {
  const parsed = dialogueSchema.safeParse(value);
  return parsed.success ? parsed.data : {
    version: 1,
    revision: 0,
    interpretation: "llm_request_interpretation",
    pendingSlot: null,
    clarificationCount: 0,
    constraints: { budget: null, partySize: null, spicy: null, unverified: [] },
    intents: [],
  };
}

/** Only explicit structured values resolve a slot; no text/keyword matching. */
export function slotHasValue(slot: ClarificationSlot, c: ReadOnlyDialogueState["constraints"]): boolean {
  if (slot === "budget_scope") return c.budget !== null && c.budget.scope !== "unspecified";
  if (slot === "budget") return c.budget !== null;
  if (slot === "party_size") return c.partySize !== null;
  // This state does not yet carry resolved product/option references.
  return false;
}

/** Null/empty fields mean no new information; only semantic clears remove state. */
export function mergeRequestedConstraints(
  previous: ReadOnlyDialogueState["constraints"],
  incoming: ReadOnlyDialogueState["constraints"],
  clear: (keyof ReadOnlyDialogueState["constraints"])[] = [],
): ReadOnlyDialogueState["constraints"] {
  return constraintsSchema.parse({
    budget: incoming.budget ?? (clear.includes("budget") ? null : previous.budget),
    partySize: incoming.partySize ?? (clear.includes("partySize") ? null : previous.partySize),
    spicy: incoming.spicy ?? (clear.includes("spicy") ? null : previous.spicy),
    unverified: [...new Set([...(clear.includes("unverified") ? [] : previous.unverified), ...incoming.unverified])],
  });
}
