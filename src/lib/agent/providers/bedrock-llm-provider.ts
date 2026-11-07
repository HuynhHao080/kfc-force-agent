import { BaseLLMProvider, LLMResult, LLMError } from "./llm-provider";
import { ConversationTurn } from "@/lib/types/agent";
import { BedrockService } from "@/lib/aws/bedrock";

export class BedrockLLMProvider extends BaseLLMProvider {
  private bedrockService: BedrockService;

  constructor(bedrockService: BedrockService) {
    super();
    this.bedrockService = bedrockService;
  }

  async generateResponse(
    systemPrompt: string,
    userPrompt: string,
    conversationHistory?: ConversationTurn[],
  ): Promise<LLMResult> {
    try {
      // Use Bedrock service to generate response
      const bedrockResponse = await this.bedrockService.generateResponse(
        systemPrompt,
        userPrompt,
        conversationHistory,
      );

      if (!bedrockResponse.success) {
        return {
          success: false,
          error: toLLMError(bedrockResponse.error),
        };
      }

      // Parse and validate the Bedrock response
      const parsedResponse = this.parseBedrockResponse(
        bedrockResponse.response.content,
      );
      const validatedResponse = this.validateAgentResponse(parsedResponse);

      // Valid JSON still does not prove an order/payment or any other outcome.
      // Without a supported tool proposal, show only a fixed clarification.
      if (
        !validatedResponse.actions.some((action) => action.type !== "UNKNOWN")
      ) {
        return {
          success: true,
          response: this.validateAgentResponse(this.clarification()),
        };
      }
      return { success: true, response: validatedResponse };
    } catch (error) {
      return {
        success: false,
        error: {
          message:
            error instanceof Error
              ? error.message
              : "Bedrock LLM provider error",
          type: "bedrock_error",
        },
      };
    }
  }

  private parseBedrockResponse(content: string): unknown {
    try {
      return this.parseJSONResponse(content);
    } catch {
      // If not JSON, try to extract a JSON object from surrounding text.
      // [\s\S] is used instead of the /s flag so the pattern stays valid
      // for the project's ES2017 TypeScript target.
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return this.parseJSONResponse(jsonMatch[0]);
        } catch {
          // fall through to the safe non-mutating fallback below
        }
      }

      // Unstructured text is not evidence of a completed transaction.
      return this.clarification();
    }
  }

  private clarification() {
    return {
      message:
        "Mình chưa hiểu rõ yêu cầu. Bạn hãy nêu tên món và số lượng nhé.",
      intent: "UNKNOWN",
      confidence: 0.1,
      actions: [],
      requiresConfirmation: false,
    };
  }
}

function toLLMError(error: { message: string; type: string }): LLMError {
  return { message: error.message, type: error.type };
}
