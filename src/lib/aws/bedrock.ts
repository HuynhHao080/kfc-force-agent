import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { z } from "zod";
import type { ConversationTurn } from "@/lib/types/agent";
import { reserveBedrockInvocation } from "./invocation-budget";
export interface BedrockConfig {
  modelId: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
}
export interface BedrockResponse {
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
    if ((this.config.temperature !== undefined && this.config.topP !== undefined) ||
        !Number.isInteger(this.config.maxTokens ?? 512) ||
        (this.config.maxTokens ?? 512) < 1 || (this.config.maxTokens ?? 512) > 2048 ||
        !Number.isFinite(this.config.temperature ?? this.config.topP ?? 0.1) ||
        (this.config.temperature ?? this.config.topP ?? 0.1) < 0 ||
        (this.config.temperature ?? this.config.topP ?? 0.1) > 1) {
      return { success: false, error: { type: "validation_error", message: "Use one sampling parameter, with a value from 0 to 1, and maxTokens from 1 to 2048." } };
    }
    try {
      this.client ??= new BedrockRuntimeClient({
        region: process.env.AWS_REGION || "ap-southeast-1",
        maxAttempts: 1,
      });
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
      const body = JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        system: systemPrompt,
        messages,
        max_tokens: this.config.maxTokens ?? 512,
        ...(this.config.topP !== undefined ? { top_p: this.config.topP } : { temperature: this.config.temperature ?? 0.1 }),
      });
      if (Buffer.byteLength(body, "utf8") > 32000)
        return { success: false, error: { type: "validation_error", message: "The model request exceeds the 32000-byte input ceiling." } };
      if (!this.injectedTransport) reserveBedrockInvocation();
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
}
