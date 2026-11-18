import { z } from "zod";
import { chatRequestSchema } from "@/lib/validation/chat";
import { resolvePersistenceDriver } from "@/lib/db/repositories/repositories";

/**
 * Amazon Bedrock AgentCore Runtime adapter (HTTP protocol contract).
 *
 * The runtime receives the JSON body of InvokeAgentRuntime on POST /invocations.
 * It runs exactly the same pipeline as the web chat route
 * (ChatService -> agentCore -> LLM -> PolicyEngine -> tools), so the agent's
 * behaviour on AgentCore and in local development cannot drift apart.
 *
 * Identity: `userId` is supplied by the trusted caller (the chat Lambda behind
 * API Gateway, after it has authenticated the customer). The runtime must be
 * configured for IAM (SigV4) inbound auth so that only that caller can invoke
 * it; the runtime never authenticates customers itself.
 */
export const invocationSchema = z
  .object({
    userId: z.string().min(1).max(128),
    message: z.string(),
    platform: z.enum(["web", "mobile"]).default("web"),
    confirm: z.boolean().optional(),
    confirmationId: z.string().optional(),
    selectedProduct: z.unknown().optional(),
  })
  .strict();

export type InvocationPayload = z.input<typeof invocationSchema>;

export interface InvocationResult {
  status: number;
  body: Record<string, unknown>;
}

const error = (status: number, code: string, message: string): InvocationResult => ({
  status,
  body: { status: "error", error: code, message },
});

/**
 * Validates and runs one customer turn. Never throws: every failure becomes a
 * controlled JSON error without stack traces, prompts or provider details.
 */
export async function handleInvocation(raw: unknown): Promise<InvocationResult> {
  const envelope = invocationSchema.safeParse(raw);
  if (!envelope.success)
    return error(400, "validation_error", "Yêu cầu không hợp lệ.");
  const request = chatRequestSchema.safeParse({
    ...envelope.data,
    // Same per-customer session key as the web route (src/app/api/chat/route.ts).
    sessionId: `chat_${envelope.data.userId}`,
  });
  if (!request.success)
    return error(400, "validation_error", request.error.issues[0]?.message ?? "Yêu cầu không hợp lệ.");
  try {
    // Imported lazily so /ping answers even while the service container is
    // still loading the catalog on a cold start.
    const { services } = await import("@/lib/agent/agent-core");
    const response = await services.chatService.processChat(request.data);
    return { status: 200, body: { status: "success", ...response } };
  } catch (failure) {
    // Log the error class only: never the message text, prompt or credentials.
    console.error("agentcore_invocation_failed", failure instanceof Error ? failure.name : "unknown");
    return error(500, "internal_error", "Trợ lý tạm thời không xử lý được yêu cầu. Vui lòng thử lại.");
  }
}

/**
 * Deployment guard. AgentCore runs each session in its own microVM whose disk
 * does not outlive the session, so local JSON persistence would silently lose
 * carts and conversations (and split them between sessions). On AgentCore the
 * only accepted driver is DynamoDB.
 */
export function assertRuntimePersistence(env: Record<string, string | undefined> = process.env): void {
  if (env.AGENTCORE_DEPLOYED !== "1") return;
  if (resolvePersistenceDriver(env) !== "dynamodb")
    throw new Error("AGENTCORE_DEPLOYED=1 requires PERSISTENCE_DRIVER=dynamodb.");
}
