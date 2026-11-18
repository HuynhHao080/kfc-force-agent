import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { z } from "zod";
import type { ConversationTurn } from "@/lib/types/agent";
import { reserveInvocation } from "./invocation-budget";
export interface BedrockConfig {
  modelId: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  thinking?: { type: string };
}
export interface BedrockResponse {
  modelId?: string;
  region?: string;
  content: string;
  role: "assistant";
  usage?: { inputTokens?: number; outputTokens?: number };
}
export interface BedrockError {
  message: string;
  type: "validation_error" | "bedrock_error" | "model_error";
}
const modelReplySchema = z.object({
  content: z
    .array(z.object({ type: z.string(), text: z.string().optional() }))
    .min(1),
  usage: z
    .object({
      input_tokens: z.number().nonnegative(),
      output_tokens: z.number().nonnegative(),
    })
    .optional(),
});
/** One Anthropic content block as returned by the Messages API (text or tool_use). */
export type ModelContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: string; [key: string]: unknown };
export interface ToolMessage {
  role: "user" | "assistant";
  content: string | Record<string, unknown>[];
}
export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}
export interface ToolTurnResponse {
  content: ModelContentBlock[];
  stopReason: string;
  usage?: { inputTokens?: number; outputTokens?: number };
}
const toolReplySchema = z.object({
  content: z.array(z.object({ type: z.string() }).passthrough()),
  stop_reason: z.string().nullable().optional(),
  usage: z.object({ input_tokens: z.number().nonnegative(), output_tokens: z.number().nonnegative() }).optional(),
});
/** Tool loops carry search results, so they get a larger, still bounded, input ceiling. */
const TOOL_INPUT_CEILING_BYTES = 48000;

/** Anthropic Messages body over Bedrock InvokeModel. No implicit mock fallback. */
export class BedrockService {
  private readonly injectedTransport: boolean;
  constructor(
    private config: BedrockConfig,
    private client?: BedrockRuntimeClient,
  ) {
    this.injectedTransport = !!client;
  }
  async generateResponse(
    systemPrompt: string,
    userPrompt: string,
    conversationHistory?: ConversationTurn[],
  ): Promise<
    | { success: true; response: BedrockResponse }
    | { success: false; error: BedrockError }
  > {
    if (!this.config.modelId.trim() || this.config.modelId === "mock-model") {
      return {
        success: false,
        error: {
          type: "validation_error",
          message:
            "BEDROCK_MODEL_ID must be explicitly configured for the Bedrock provider.",
        },
      };
    }
    const isHaiku55 = /claude-haiku-5-5/.test(this.config.modelId);
    const maxTokens = this.config.maxTokens ?? 512;
    if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 2048) {
      return { success: false, error: { type: "validation_error", message: "maxTokens must be an integer from 1 to 2048." } };
    }
    if (isHaiku55) {
      if (this.config.temperature !== undefined || this.config.topP !== undefined) {
        return { success: false, error: { type: "validation_error", message: "Haiku 5.5 does not accept sampling parameters. Use thinking.type=disabled instead." } };
      }
      if (this.config.thinking !== undefined && this.config.thinking.type !== "disabled") {
        return { success: false, error: { type: "validation_error", message: "This adapter supports Haiku 5.5 with thinking.type=disabled." } };
      }
    } else {
      if ((this.config.temperature !== undefined && this.config.topP !== undefined) ||
          !Number.isFinite(this.config.temperature ?? this.config.topP ?? 0.1) ||
          (this.config.temperature ?? this.config.topP ?? 0.1) < 0 ||
          (this.config.temperature ?? this.config.topP ?? 0.1) > 1) {
        return { success: false, error: { type: "validation_error", message: "Use one sampling parameter, with a value from 0 to 1." } };
      }
    }
    try {
      if (!this.client) {
        const region = process.env.AWS_REGION;
        if (!region || !region.trim()) {
          return {
            success: false,
            error: {
              type: "validation_error",
              message:
                "AWS_REGION must be explicitly configured for the Bedrock provider.",
            },
          };
        }
        this.client = new BedrockRuntimeClient({
          region,
          maxAttempts: 1,
        });
      }
      const messages = [
        ...(conversationHistory ?? [])
          .filter((turn) => turn.role !== "system" && turn.content.trim())
          .slice(-10)
          .map((turn) => ({
            role: turn.role,
            content: [{ type: "text", text: turn.content }],
          })),
        { role: "user", content: [{ type: "text", text: userPrompt }] },
      ];
      const bodyObj: Record<string, unknown> = {
        anthropic_version: "bedrock-2023-05-31",
        system: systemPrompt,
        messages,
        max_tokens: maxTokens,
      };
      if (isHaiku55) {
        bodyObj.thinking = { type: "disabled" };
      } else if (this.config.topP !== undefined) {
        bodyObj.top_p = this.config.topP;
      } else {
        bodyObj.temperature = this.config.temperature ?? 0.1;
      }
      const body = Buffer.from(JSON.stringify(bodyObj), "utf8");
      if (body.byteLength > 32000)
        return { success: false, error: { type: "validation_error", message: "The model request exceeds the 32000-byte input ceiling." } };
      // Budget store follows the persistence driver (file locally, DynamoDB on AgentCore).
      if (!this.injectedTransport) await reserveInvocation();
      const command = new InvokeModelCommand({
        modelId: this.config.modelId,
        contentType: "application/json",
        accept: "application/json",
        body,
      });
      const response = await this.client.send(command, {
        abortSignal: AbortSignal.timeout(15000),
      });
      const parsed = modelReplySchema.safeParse(
        JSON.parse(new TextDecoder().decode(response.body)),
      );
      if (!parsed.success)
        return {
          success: false,
          error: {
            type: "model_error",
            message: "Bedrock returned an invalid model response.",
          },
        };
      const content = parsed.data.content
        .filter((block) => block.type === "text")
        .map((block) => block.text ?? "")
        .join("\n");
      if (!content.trim())
        return {
          success: false,
          error: {
            type: "model_error",
            message: "Bedrock returned no text content.",
          },
        };
      return {
        success: true,
        response: {
          modelId: this.config.modelId,
          region: process.env.AWS_REGION?.trim(),
          content,
          role: "assistant",
          usage: parsed.data.usage
            ? {
                inputTokens: parsed.data.usage.input_tokens,
                outputTokens: parsed.data.usage.output_tokens,
              }
            : undefined,
        },
      };
    } catch (error) {
      // Return a controlled error. Never turn a failed real invocation into a
      // mock success, and never retry inference automatically.
      return {
        success: false,
        error: {
          message:
            error instanceof Error
              ? error.message
              : "Bedrock invocation failed",
          type: "bedrock_error",
        },
      };
    }
  }

  /**
   * One step of an Anthropic tool-use loop over Bedrock InvokeModel. Same
   * guardrails as generateResponse: explicit model and region, bounded
   * max_tokens, sampling rules per model, input ceiling, persisted request
   * budget (one reservation per call), 15 s timeout, no retry, no mock fallback.
   * The caller executes tools; this method never does.
   */
  async invokeWithTools(
    systemPrompt: string,
    messages: ToolMessage[],
    tools: ToolDefinition[],
  ): Promise<{ success: true; response: ToolTurnResponse } | { success: false; error: BedrockError }> {
    if (!this.config.modelId.trim() || this.config.modelId === "mock-model")
      return { success: false, error: { type: "validation_error", message: "BEDROCK_MODEL_ID must be explicitly configured for the Bedrock provider." } };
    const isHaiku55 = /claude-haiku-5-5/.test(this.config.modelId);
    const maxTokens = this.config.maxTokens ?? 1024;
    if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 2048)
      return { success: false, error: { type: "validation_error", message: "maxTokens must be an integer from 1 to 2048." } };
    if (isHaiku55 && (this.config.temperature !== undefined || this.config.topP !== undefined))
      return { success: false, error: { type: "validation_error", message: "Haiku 5.5 does not accept sampling parameters. Use thinking.type=disabled instead." } };
    try {
      if (!this.client) {
        const region = process.env.AWS_REGION;
        if (!region || !region.trim())
          return { success: false, error: { type: "validation_error", message: "AWS_REGION must be explicitly configured for the Bedrock provider." } };
        this.client = new BedrockRuntimeClient({ region, maxAttempts: 1 });
      }
      const bodyObj: Record<string, unknown> = {
        anthropic_version: "bedrock-2023-05-31",
        system: systemPrompt,
        messages,
        tools,
        max_tokens: maxTokens,
      };
      if (isHaiku55) bodyObj.thinking = { type: "disabled" };
      else if (this.config.topP !== undefined) bodyObj.top_p = this.config.topP;
      else bodyObj.temperature = this.config.temperature ?? 0.1;
      const body = Buffer.from(JSON.stringify(bodyObj), "utf8");
      if (body.byteLength > TOOL_INPUT_CEILING_BYTES)
        return { success: false, error: { type: "validation_error", message: `The model request exceeds the ${TOOL_INPUT_CEILING_BYTES}-byte tool-loop input ceiling.` } };
      if (!this.injectedTransport) await reserveInvocation();
      const response = await this.client.send(
        new InvokeModelCommand({ modelId: this.config.modelId, contentType: "application/json", accept: "application/json", body }),
        { abortSignal: AbortSignal.timeout(15000) },
      );
      const parsed = toolReplySchema.safeParse(JSON.parse(new TextDecoder().decode(response.body)));
      if (!parsed.success)
        return { success: false, error: { type: "model_error", message: "Bedrock returned an invalid model response." } };
      return {
        success: true,
        response: {
          content: parsed.data.content as ModelContentBlock[],
          stopReason: parsed.data.stop_reason ?? "end_turn",
          usage: parsed.data.usage ? { inputTokens: parsed.data.usage.input_tokens, outputTokens: parsed.data.usage.output_tokens } : undefined,
        },
      };
    } catch (error) {
      return { success: false, error: { message: error instanceof Error ? error.message : "Bedrock invocation failed", type: "bedrock_error" } };
    }
  }
}
