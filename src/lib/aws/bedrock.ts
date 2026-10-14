"use strict";

import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { ConversationTurn } from "@/lib/types/agent";

// Bedrock client configuration
const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "ap-southeast-1",
});

export interface BedrockConfig {
  modelId: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
}

export interface BedrockResponse {
  content: string;
  role: "assistant";
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

export interface BedrockError {
  message: string;
  type: "validation_error" | "bedrock_error" | "model_error";
}

export class BedrockService {
  private config: BedrockConfig;
  private isMock: boolean;

  constructor(config: BedrockConfig) {
    this.config = config;
    this.isMock =
      !process.env.BEDROCK_MODEL_ID &&
      !process.env.AWS_ACCESS_KEY_ID &&
      !process.env.AWS_SECRET_ACCESS_KEY;
  }

  async generateResponse(
    systemPrompt: string,
    userPrompt: string,
    conversationHistory?: ConversationTurn[],
  ): Promise<
    { success: true; response: BedrockResponse } | { success: false; error: BedrockError }
  > {
    if (this.isMock) {
      return this.generateMockResponse(userPrompt);
    }

    try {
      // Prior turns plus the current user message, in a single ordered list.
      const messages = [
        ...(conversationHistory ?? []).map((turn) => ({
          role: turn.role === "assistant" ? "assistant" : "user",
          content: turn.content,
        })),
        { role: "user", content: userPrompt },
      ];

      const command = new InvokeModelCommand({
        modelId: this.config.modelId,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          anthropic_version: "bedrock-2023-05-31",
          system: systemPrompt,
          messages,
          max_tokens: this.config.maxTokens || 1000,
          temperature: this.config.temperature || 0.1,
          top_p: this.config.topP || 0.9,
        }),
      });

      const response = await bedrockClient.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      // Parse Bedrock response
      const bedrockResponse: BedrockResponse = {
        content: responseBody.content?.[0]?.text ?? "",
        role: "assistant",
        usage: {
          inputTokens: responseBody.usage?.input_tokens,
          outputTokens: responseBody.usage?.output_tokens,
        },
      };

      return { success: true, response: bedrockResponse };
    } catch (error) {
      console.error("Bedrock API error:", error);
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "Bedrock API call failed",
          type: "bedrock_error",
        },
      };
    }
  }

  private generateMockResponse(userPrompt: string): { success: true; response: BedrockResponse } {
    // Mock response that mimics Bedrock output format
    return {
      success: true,
      response: {
        content: `Mock Bedrock response to: "${userPrompt}". This would be a real Bedrock response with structured output.`,
        role: "assistant",
      },
    };
  }
}

export const bedrockService = new BedrockService({
  modelId: process.env.BEDROCK_MODEL_ID || "mock-model",
  maxTokens: 1000,
  temperature: 0.1,
  topP: 0.9,
});
