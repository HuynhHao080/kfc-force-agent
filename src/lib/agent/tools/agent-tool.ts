import { z } from "zod";

export interface ToolExecutionContext {
  userId: string;
  sessionId: string;
  requestId?: string;
  /**
   * Explicit confirmation flag. Only ever set from a validated boolean
   * supplied by the transport layer (or the policy engine after it has
   * already decided REQUIRE_CONFIRMATION and the user confirmed).
   */
  confirmed?: boolean;
}

export interface ToolError {
  code: string;
  message: string;
}

export interface ToolResult<T> {
  success: boolean;
  operation: string;
  data?: T;
  error?: ToolError;
}

export abstract class AgentTool<TInput, TOutput> {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly inputSchema: z.ZodType<TInput>;
  abstract readonly outputSchema: z.ZodType<TOutput>;

  async execute(
    input: TInput,
    context: ToolExecutionContext,
    requiresConfirmation: boolean = false,
  ): Promise<ToolResult<TOutput>> {
    // Validate input
    const validationResult = this.inputSchema.safeParse(input);
    if (!validationResult.success) {
      return {
        success: false,
        operation: this.name,
        error: {
          code: "INVALID_INPUT",
          message: `Invalid input: ${validationResult.error.issues.map((i) => i.message).join(", ")}`,
        },
      };
    }

    // If confirmation required and not confirmed, return confirmation error
    if (requiresConfirmation && !context.confirmed) {
      return {
        success: false,
        operation: this.name,
        error: {
          code: "CONFIRMATION_REQUIRED",
          message: "Vui lòng xác nhận trước khi thực hiện thao tác này.",
        },
      };
    }

    try {
      const output = await this.executeInternal(validationResult.data, context);
      const validatedOutput = this.outputSchema.parse(output);

      return {
        success: true,
        operation: this.name,
        data: validatedOutput,
      };
    } catch (error) {
      return {
        success: false,
        operation: this.name,
        error: {
          code: "TOOL_EXECUTION_FAILED",
          message: error instanceof Error ? error.message : "Tool execution failed",
        },
      };
    }
  }

  protected abstract executeInternal(
    input: TInput,
    context: ToolExecutionContext,
  ): Promise<TOutput>;
}

/**
 * Structural type for a tool whose input/output types have been erased.
 * Prefer this over `any` when a heterogeneous collection of tools is needed.
 */
export type AnyAgentTool = AgentTool<unknown, unknown>;

