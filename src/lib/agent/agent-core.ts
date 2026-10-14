import { ChatService } from "@/lib/services/chat-service";
import { SessionService } from "@/lib/services/session-service";
import { UserService } from "@/lib/services/user-service";
import { MenuService } from "@/lib/services/menu-service";
import { CartService } from "@/lib/services/cart-service";
import { OrderService } from "@/lib/services/order-service";
import { createRepositories } from "@/lib/db/repositories/repositories";
import { MenuTool } from "@/lib/agent/tools/menu-tool";
import { CartTool } from "@/lib/agent/tools/cart-tool";
import { BedrockService } from "@/lib/aws/bedrock";
import {
  validateAgentResponse,
  AgentResponse,
  AgentRequest,
  ActionExecutionResult,
  ActionType,
  ConversationTurn,
  ProposedAction,
} from "@/lib/types/agent";
import { MockLLMProvider } from "@/lib/agent/providers/mock-llm-provider";
import { BedrockLLMProvider } from "@/lib/agent/providers/bedrock-llm-provider";
import { LLMProvider } from "@/lib/agent/providers/llm-provider";
import { ToolExecutionContext, ToolResult } from "@/lib/agent/tools/agent-tool";
import { toolRegistry } from "@/lib/agent/tools/tool-registry";
import { getToolMapping, PolicyEngine } from "@/lib/policy/policy-engine";
import { systemPrompt } from "@/lib/agent/prompts/system-prompt";

export interface AgentCoreResult {
  reply: string;
  sessionId: string;
  actions: ProposedAction[];
  requiresConfirmation: boolean;
  execution: ActionExecutionResult[];
}

export class ServiceContainer {
  sessionService: SessionService;
  userService: UserService;
  menuService: MenuService;
  cartService: CartService;
  orderService: OrderService;
  chatService: ChatService;
  menuTool: MenuTool;
  cartTool: CartTool;
  bedrockService: BedrockService;
  llmProvider: LLMProvider;
  policyEngine: PolicyEngine;

  constructor() {
    // One repository set for the whole application.
    const repositories = createRepositories();

    this.sessionService = new SessionService(repositories.sessionRepository);
    this.userService = new UserService(repositories.userRepository);
    this.menuService = new MenuService(repositories.menuRepository);
    this.cartService = new CartService(repositories.cartRepository);
    this.orderService = new OrderService(repositories.orderRepository);
    this.chatService = new ChatService(this.sessionService);

    this.menuTool = new MenuTool(this.menuService);
    this.cartTool = new CartTool(this.cartService, this.menuService);

    this.bedrockService = new BedrockService({
      modelId: process.env.BEDROCK_MODEL_ID || "mock-model",
    });
    this.llmProvider = createLLMProvider(this.bedrockService);
    this.policyEngine = new PolicyEngine(this.cartService, this.menuService);

    // Register core tools exactly once, sharing the container's services.
    toolRegistry.register(this.menuTool);
    toolRegistry.register(this.cartTool);
  }
}

function createLLMProvider(bedrockService: BedrockService): LLMProvider {
  const aiProvider = (process.env.AI_PROVIDER || "mock").toLowerCase();
  if (aiProvider === "bedrock") {
    return new BedrockLLMProvider(bedrockService);
  }
  return new MockLLMProvider();
}

export const services = new ServiceContainer();


/**
 * AgentCore entry point.
 *
 * Flow: HTTP → AgentCore → LLMProvider → ProposedAction → PolicyEngine
 *       → Tool Registry → Tool → Service → Repository → Response
 *
 * The LLM never touches the database. A proposed action is only ever
 * executed when the PolicyEngine returns ALLOW.
 */
export async function agentCore(request: AgentRequest): Promise<AgentCoreResult> {
  const sessionId = request.sessionId || `session_${Date.now()}`;

  try {
    const conversation = await loadConversation(sessionId);
    const userPrompt = buildUserPrompt(request.message, conversation);

    const llmResponse = await services.llmProvider.generateResponse(
      systemPrompt,
      userPrompt,
      conversation,
    );

    if (!llmResponse.success) {
      console.error("LLM provider failure:", llmResponse.error);
      return {
        reply: "Xin lỗi, hệ thống AI đang gặp sự cố. Vui lòng thử lại sau.",
        sessionId,
        actions: [],
        requiresConfirmation: false,
        execution: [],
      };
    }

    let agentResponse: AgentResponse;
    try {
      agentResponse = validateAgentResponse(llmResponse.response);
    } catch (validationError) {
      console.error("Failed to validate LLM response:", validationError);
      return {
        reply:
          "Xin lỗi, mình chưa hiểu rõ yêu cầu này. Bạn có thể nói lại giúp mình không? " +
          "Ví dụ: “Cho mình xem thực đơn” hoặc “Thêm 2 combo gà cay vào giỏ hàng”.",
        sessionId,
        actions: [],
        requiresConfirmation: false,
        execution: [],
      };
    }

    const execution = await executeProposedActions(agentResponse.actions, {
      userId: request.userId,
      sessionId,
      confirmed: request.confirm === true,
    });

    return {
      reply: composeReply(agentResponse, execution),
      sessionId,
      actions: agentResponse.actions,
      requiresConfirmation:
        agentResponse.requiresConfirmation ||
        execution.some((entry) => entry.decision === "REQUIRE_CONFIRMATION"),
      execution,
    };
  } catch (error) {
    console.error("AgentCore error:", error);
    return {
      reply: "Đã xảy ra lỗi khi xử lý yêu cầu của bạn. Vui lòng thử lại.",
      sessionId,
      actions: [],
      requiresConfirmation: false,
      execution: [],
    };
  }
}

/**
 * Runs every proposed action through the PolicyEngine and executes only the
 * ones that are explicitly allowed. A blocked or confirmation-pending action
 * never reaches a tool.
 */
export async function executeProposedActions(
  actions: ProposedAction[],
  context: ToolExecutionContext,
): Promise<ActionExecutionResult[]> {
  const results: ActionExecutionResult[] = [];

  for (const action of actions) {
    // Policy first: nothing executes before it is evaluated.
    const policy = await services.policyEngine.evaluateAction(action, {
      userId: context.userId,
      sessionId: context.sessionId,
      requestId: context.requestId,
      confirmed: context.confirmed === true,
    });

    if (policy.decision !== "ALLOW") {
      results.push({
        actionId: action.id,
        actionType: action.type,
        decision: policy.decision,
        executed: false,
        reason: policy.reason,
      });
      continue;
    }

    results.push(await executeAction(action, context));
  }

  return results;
}

/**
 * Executes a single policy-approved action via the tool registry.
 * The tool is looked up explicitly; an unknown tool never executes anything.
 */
async function executeAction(
  action: ProposedAction,
  context: ToolExecutionContext,
): Promise<ActionExecutionResult> {
  const mapping = getToolMapping(action.type);
  if (!mapping) {
    return {
      actionId: action.id,
      actionType: action.type,
      decision: "BLOCK",
      executed: false,
      reason: `Loại hành động không được hỗ trợ: ${action.type}`,
    };
  }

  const tool = toolRegistry.get(mapping.tool);
  if (!tool) {
    return {
      actionId: action.id,
      actionType: action.type,
      decision: "BLOCK",
      executed: false,
      reason: `Công cụ không được đăng ký: ${mapping.tool}`,
    };
  }

  // Build the tool input from the tool mapping + action parameters.
  // `operation` is deterministic; it is never taken from the LLM.
  const toolInput = buildToolInput(action, mapping.operation);

  let result: ToolResult<unknown>;
  try {
    result = await tool.execute(toolInput, context, false);
  } catch (error) {
    return {
      actionId: action.id,
      actionType: action.type,
      decision: "BLOCK",
      executed: false,
      reason: error instanceof Error ? error.message : "Lỗi thực thi công cụ",
    };
  }

  if (!result.success) {
    return {
      actionId: action.id,
      actionType: action.type,
      decision: "BLOCK",
      executed: false,
      reason: result.error?.message ?? "Lỗi thực thi công cụ",
      data: result.error,
    };
  }

  return {
    actionId: action.id,
    actionType: action.type,
    decision: "ALLOW",
    executed: true,
    reason: "Đã thực hiện thành công.",
    data: result.data,
  };
}

function buildToolInput(
  action: ProposedAction,
  operation: string | null,
): Record<string, unknown> {
  const parameters = action.parameters ?? {};
  if (operation === null) {
    // Menu tool: the operation is derived from the action type, not the LLM.
    return { ...parameters, operation: menuOperationFor(action.type) };
  }
  // Cart tool: operation plus only the fields the cart tool consumes.
  return {
    operation,
    itemId: parameters.itemId ?? parameters.menuItemId,
    quantity: parameters.quantity,
    options: parameters.options,
  };
}

function menuOperationFor(actionType: ActionType): string {
  switch (actionType) {
    case "GET_MENU_ITEM":
      return "get_item";
    case "LIST_MENU":
      return "list_items";
    default:
      return "search";
  }
}

/** Composes the customer-facing reply from the model message + outcomes. */
function composeReply(
  agentResponse: AgentResponse,
  execution: ActionExecutionResult[],
): string {
  const lines: string[] = [agentResponse.message];

  for (const entry of execution) {
    if (entry.executed) {
      const message = readMessage(entry.data);
      if (message) lines.push(message);
      continue;
    }
    if (entry.decision === "REQUIRE_CONFIRMATION") {
      lines.push("Bạn xác nhận giúp mình nhé? (trả lời “Xác nhận”)");
      continue;
    }
    // BLOCK: always explain, never claim the action happened.
    lines.push(`Mình chưa thể thực hiện: ${entry.reason}`);
  }

  return lines.join("\n");
}

function readMessage(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const message = (data as { message?: unknown }).message;
  return typeof message === "string" && message.length > 0 ? message : undefined;
}

/** Reads recent conversation turns stored on the session. */
async function loadConversation(sessionId: string): Promise<ConversationTurn[]> {
  try {
    const context = await services.sessionService.getConversationContext(sessionId);
    const turns = context?.context?.turns;
    if (!Array.isArray(turns)) return [];
    return turns.filter(
      (turn): turn is ConversationTurn =>
        !!turn &&
        typeof turn === "object" &&
        typeof (turn as ConversationTurn).content === "string" &&
        ["user", "assistant", "system"].includes((turn as ConversationTurn).role),
    );
  } catch {
    return [];
  }
}

/** Persists the recent turns so the next request has conversation context. */
export async function persistConversation(
  sessionId: string,
  turns: ConversationTurn[],
): Promise<void> {
  try {
    await services.sessionService.saveConversationContext({
      sessionId,
      context: { turns: turns.slice(-10) },
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to persist conversation context:", error);
  }
}

function buildUserPrompt(message: string, context: ConversationTurn[]): string {
  let prompt = "Cuộc hội thoại gần đây:\n";

  for (const turn of context) {
    const role = turn.role === "user" ? "Khách hàng" : "Trợ lý";
    prompt += `${role}: ${turn.content}\n`;
  }

  prompt += `\nKhách hàng: ${message}\n`;
  prompt += `\nHãy phân tích ý định của khách hàng và đề xuất các hành động có cấu trúc.\n`;
  prompt += `\nQUAN TRỌNG: Chỉ xuất ra JSON có cấu trúc. Không có giải thích hoặc văn bản tự do.`;

  return prompt;
}

