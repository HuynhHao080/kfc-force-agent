import { z } from "zod";

/**
 * Every action the agent is allowed to propose.
 * This is the single allowlist shared by the PolicyEngine, the
 * action->tool mapping and the LLM output schema.
 */
export const ACTION_TYPES = [
  "SEARCH_MENU",
  "GET_MENU_ITEM",
  "LIST_MENU",
  "VIEW_CART",
  "ADD_TO_CART",
  "UPDATE_CART",
  "REMOVE_FROM_CART",
  "CLEAR_CART",
  "UNKNOWN",
] as const;

export type ActionType = (typeof ACTION_TYPES)[number];

/** Outcome of evaluating a proposed action. */
export type PolicyDecision = "ALLOW" | "MODIFY" | "REQUIRE_CONFIRMATION" | "BLOCK";

// ProposedAction schema
export const ProposedActionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(ACTION_TYPES),
  parameters: z.record(z.string(), z.unknown()).default({}),
  requiresConfirmation: z.boolean().default(false),
});

export type ProposedAction = z.infer<typeof ProposedActionSchema>;

// AgentResponse schema
export const AgentResponseSchema = z.object({
  message: z.string(),
  intent: z.string(),
  confidence: z.number().min(0).max(1).optional(),
  actions: z.array(ProposedActionSchema).min(1),
  requiresConfirmation: z.boolean().default(false),
});

export type AgentResponse = z.infer<typeof AgentResponseSchema>;

/** A single conversation turn as stored by the session repository. */
export interface ConversationTurn {
  role: "user" | "assistant" | "system";
  content: string;
}

// AgentRequest schema
export interface AgentRequest {
  platform: string;
  userId: string;
  sessionId: string;
  message: string;
  /**
   * Explicit confirmation state. `true` means the customer explicitly
   * confirmed the previously proposed mutation. Never inferred from
   * free-form text or identifiers.
   */
  confirm?: boolean;
  conversationHistory?: ConversationTurn[];
}

/** Result of running one proposed action through policy + tool execution. */
export interface ActionExecutionResult {
  actionId: string;
  actionType: ActionType;
  decision: PolicyDecision;
  executed: boolean;
  reason: string;
  data?: unknown;
}

// Validation helper functions
export function validateAgentResponse(data: unknown): AgentResponse {
  return AgentResponseSchema.parse(data);
}

export function validateProposedAction(data: unknown): ProposedAction {
  return ProposedActionSchema.parse(data);
}

export function isValidAgentResponse(data: unknown): data is AgentResponse {
  return AgentResponseSchema.safeParse(data).success;
}
