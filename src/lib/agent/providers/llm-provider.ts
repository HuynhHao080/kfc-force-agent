import { AgentResponse, AgentResponseSchema, ConversationTurn } from "@/lib/types/agent";

export interface LLMError {
  message: string;
  type: string;
}

export type LLMResult =
  | { success: true; response: AgentResponse }
  | { success: false; error: LLMError };

export interface LLMProvider {
  generateResponse(
    systemPrompt: string,
    userPrompt: string,
    conversationHistory?: ConversationTurn[],
  ): Promise<LLMResult>;
}

export abstract class BaseLLMProvider implements LLMProvider {
  abstract generateResponse(
    systemPrompt: string,
    userPrompt: string,
    conversationHistory?: ConversationTurn[],
  ): Promise<LLMResult>;

  protected parseJSONResponse(content: string): unknown {
    try {
      return JSON.parse(content);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "unknown parse error";
      throw new Error(`Failed to parse JSON response from LLM: ${detail}`);
    }
  }

  /**
   * Zod validation of the LLM output. Anything that does not match the
   * AgentResponse schema is rejected here, so a malformed model reply can
   * never reach the tool layer.
   */
  protected validateAgentResponse(response: unknown): AgentResponse {
    const result = AgentResponseSchema.safeParse(response);
    if (!result.success) {
      throw new Error(
        `Invalid agent response: ${result.error.issues
          .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
          .join(", ")}`,
      );
    }
    return result.data;
  }
}

