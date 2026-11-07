import {
  activeConfirmation,
  CONFIRMATION_TTL_MS,
  type PendingConfirmation,
} from "./confirmation";
import { createHash, randomUUID } from "node:crypto";
import { FeedbackService } from "@/lib/services/feedback-service";
import { AdminService } from "@/lib/services/admin-service";
import { AccountService } from "@/lib/services/account-service";
import { AddressService } from "@/lib/services/address-service";
import { ShopService } from "@/lib/services/shop-service";
import { CheckoutService } from "@/lib/services/checkout-service";
import { PromotionService } from "@/lib/services/promotion-service";
import { ReorderService } from "@/lib/services/reorder-service";
import { ChatService } from "@/lib/services/chat-service";
import { SessionService } from "@/lib/services/session-service";
import { UserService } from "@/lib/services/user-service";
import { normalizeVietnamese, MenuService } from "@/lib/services/menu-service";
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
  ProposedActionSchema,
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
  pendingConfirmation?: PendingConfirmation | null;
}

export class ServiceContainer {
  feedbackService: FeedbackService;
  shopService: ShopService;
  accountService: AccountService;
  addressService: AddressService;
  adminService: AdminService;
  sessionService: SessionService;
  userService: UserService;
  menuService: MenuService;
  cartService: CartService;
  orderService: OrderService;
  checkoutService: CheckoutService;
  promotionService: PromotionService;
  reorderService: ReorderService;
  chatService: ChatService;
  menuTool: MenuTool;
  cartTool: CartTool;
  bedrockService: BedrockService;
  llmProvider: LLMProvider;
  policyEngine: PolicyEngine;

  constructor() {
    // One repository set for the whole application.
    const repositories = createRepositories();

    this.feedbackService = new FeedbackService(repositories.orderRepository);
    this.adminService = new AdminService(
      repositories.orderRepository,
      repositories.menuRepository,
    );
    this.accountService = new AccountService(repositories.accountRepository);
    this.addressService = new AddressService(repositories.userRepository);
    this.sessionService = new SessionService(repositories.sessionRepository);
    this.userService = new UserService(repositories.userRepository);
    this.menuService = new MenuService(repositories.menuRepository);
    this.cartService = new CartService(
      repositories.cartRepository,
      this.menuService,
    );
    this.orderService = new OrderService(repositories.orderRepository);
    this.reorderService = new ReorderService(
      repositories.orderRepository,
      repositories.cartRepository,
      this.cartService,
      this.menuService,
    );
    this.shopService = new ShopService(repositories.menuRepository);
    this.promotionService = new PromotionService(repositories.menuRepository);
    this.checkoutService = new CheckoutService(
      repositories.orderRepository,
      this.cartService,
      this.menuService,
      this.promotionService,
      this.shopService,
    );
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
  if (aiProvider !== "mock")
    throw new Error(`Unknown AI_PROVIDER: ${aiProvider}`);
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
export async function agentCore(
  request: AgentRequest,
): Promise<AgentCoreResult> {
  const sessionId = request.sessionId || `session_${Date.now()}`;

  try {
    // A confirmation executes the stored proposal, without asking the model
    // to reconstruct a mutation from conversation text.
    const saved =
      await services.sessionService.getConversationContext(sessionId);
    if (request.confirm === true) {
      const confirmation = activeConfirmation(saved?.context);
      const pending = saved?.context.pendingActions;
      if (!confirmation || !Array.isArray(pending) || pending.length === 0) {
        return {
          reply: "Không có thao tác đang chờ xác nhận.",
          sessionId,
          actions: [],
          requiresConfirmation: false,
          execution: [],
        };
      }
      if (request.confirmationId !== confirmation.id) {
        return {
          reply:
            "Đề xuất đã thay đổi ở tab khác. Hãy xem lại nội dung mới và xác nhận lần nữa.",
          sessionId,
          actions: [],
          requiresConfirmation: true,
          pendingConfirmation: confirmation,
          execution: [],
        };
      }
      const view = await services.cartService.getCartView(request.userId);
      const actions = pending.map((action) =>
        ProposedActionSchema.parse(action),
      );
      const menuSignature = await proposalMenuSignature(actions);
      if (
        (view?.signature ?? null) !== saved?.context.pendingCartSignature ||
        menuSignature !== saved?.context.pendingMenuSignature
      ) {
        await services.sessionService.saveConversationContext({
          sessionId,
          context: {
            ...saved?.context,
            pendingActions: [],
            pendingConfirmation: null,
          },
          updatedAt: new Date().toISOString(),
        });
        return {
          reply:
            "Giỏ hàng hoặc giá đã thay đổi. Vui lòng gửi lại yêu cầu để xem đề xuất mới.",
          sessionId,
          actions: [],
          requiresConfirmation: false,
          execution: [],
        };
      }
      // Consume before execution so a sequential duplicate cannot replay it.
      await services.sessionService.saveConversationContext({
        sessionId,
        context: {
          ...saved?.context,
          pendingActions: [],
          pendingConfirmation: null,
        },
        updatedAt: new Date().toISOString(),
      });
      const execution = await executeProposedActions(actions, {
        userId: request.userId,
        sessionId,
        confirmed: true,
      });
      return {
        reply: composeReply(
          {
            message: "Kết quả xác nhận:",
            intent: "CONFIRMATION",
            actions,
            requiresConfirmation: false,
          },
          execution,
        ),
        sessionId,
        actions,
        requiresConfirmation: false,
        execution,
      };
    }
    // Typing assent never grants execution permission, and should not remove
    // the button the customer still needs to use for this exact proposal.
    const displayed = activeConfirmation(saved?.context);
    if (
      displayed &&
      ["xac nhan", "dong y", "ok", "okay", "yes", "dung roi", "chuan"].includes(
        normalizeVietnamese(request.message),
      )
    ) {
      return {
        reply:
          "Mình chưa thực hiện thay đổi. Hãy kiểm tra đề xuất bên dưới và nhấn “Xác nhận thao tác” nhé.",
        sessionId,
        actions: [],
        requiresConfirmation: true,
        pendingConfirmation: displayed,
        execution: [],
      };
    }
    // A new request replaces any previous proposal.
    await services.sessionService.saveConversationContext({
      sessionId,
      context: {
        ...saved?.context,
        pendingActions: [],
        pendingConfirmation: null,
      },
      updatedAt: new Date().toISOString(),
    });
    const conversation = await loadConversation(sessionId);
    const userPrompt = buildUserPrompt(request.message);

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
      confirmed: false,
    });

    const pendingActions = agentResponse.actions.filter((action) =>
      execution.some(
        (entry) =>
          entry.actionId === action.id &&
          entry.decision === "REQUIRE_CONFIRMATION",
      ),
    );
    const view = pendingActions.length
      ? await services.cartService.getCartView(request.userId)
      : null;
    const pendingMenuSignature = pendingActions.length
      ? await proposalMenuSignature(pendingActions)
      : null;
    const pendingConfirmation: PendingConfirmation | null =
      pendingActions.length
        ? {
            id: randomUUID(),
            expiresAt: new Date(Date.now() + CONFIRMATION_TTL_MS).toISOString(),
            summary: await describeActions(pendingActions, request.userId),
          }
        : null;
    await services.sessionService.saveConversationContext({
      sessionId,
      context: {
        ...saved?.context,
        pendingActions,
        pendingConfirmation,
        pendingCartSignature: view?.signature ?? null,
        pendingMenuSignature,
      },
      updatedAt: new Date().toISOString(),
    });

    return {
      reply: composeReply(agentResponse, execution),
      pendingConfirmation,
      sessionId,
      actions: agentResponse.actions,
      requiresConfirmation: execution.some(
        (entry) => entry.decision === "REQUIRE_CONFIRMATION",
      ),
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
    // Resolve natural-language product references once, then store the exact
    // ID in the proposal so confirmation does not repeat an ambiguous search.
    if (
      action.type === "ADD_TO_CART" &&
      !action.parameters.itemId &&
      !action.parameters.menuItemId &&
      typeof action.parameters.query === "string"
    ) {
      const matches = await services.policyEngine.findMenuMatches(
        action.parameters.query,
      );
      if (matches.length === 1) action.parameters.itemId = matches[0].id;
    }
    if (
      (action.type === "REMOVE_FROM_CART" || action.type === "UPDATE_CART") &&
      !action.parameters.itemId &&
      typeof action.parameters.query === "string"
    ) {
      const view = await services.cartService.getCartView(context.userId);
      const tokens = normalizeVietnamese(action.parameters.query)
        .split(" ")
        .filter(Boolean);
      const matches =
        view?.items.filter(
          (item) =>
            tokens.length > 0 &&
            tokens.every((token) =>
              normalizeVietnamese(item.nameSnapshot).includes(token),
            ),
        ) ?? [];
      if (matches.length === 1) action.parameters.itemId = matches[0].id;
    }
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
  const types = agentResponse.actions.map((action) => action.type);
  const businessMessage = types.some((type) => getToolMapping(type)?.mutating)
    ? "Mình đã kiểm tra yêu cầu thay đổi giỏ hàng."
    : types.some((type) =>
          ["SEARCH_MENU", "LIST_MENU", "GET_MENU_ITEM"].includes(type),
        )
      ? "Thông tin món từ thực đơn hiện tại:"
      : types.includes("VIEW_CART")
        ? "Giỏ hàng hiện tại của bạn:"
        : agentResponse.message;
  // Model prose is not proof of a mutation or an authoritative menu price.
  const lines: string[] = [businessMessage];

  for (const entry of execution) {
    if (entry.executed) {
      const message = formatToolResult(entry.data);
      if (message) lines.push(message);
      continue;
    }
    if (entry.decision === "REQUIRE_CONFIRMATION") {
      lines.push("Nhấn “Xác nhận thao tác” để tiếp tục.");
      continue;
    }
    // BLOCK: always explain, never claim the action happened.
    lines.push(`Mình chưa thể thực hiện: ${entry.reason}`);
  }

  return lines.join("\n");
}

function formatToolResult(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const result = data as {
    message?: string;
    item?: { name?: string; price?: number } | null;
    items?: Array<{
      name?: string;
      price?: number;
      nameSnapshot?: string;
      quantity?: number;
      subtotal?: number;
    }>;
    cart?: { total: number } | null;
  };
  const money = (value: number) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(value);
  const lines = result.message ? [result.message] : [];
  if (result.item?.name)
    lines.push(`${result.item.name}: ${money(result.item.price ?? 0)}`);
  for (const item of result.items ?? []) {
    if (item.nameSnapshot !== undefined) {
      lines.push(
        `${item.quantity} × ${item.nameSnapshot}: ${money(item.subtotal ?? 0)}`,
      );
    } else if (item.name !== undefined) {
      lines.push(`${item.name}: ${money(item.price ?? 0)}`);
    }
  }
  if (result.cart) lines.push(`Tổng cộng: ${money(result.cart.total)}`);
  return lines.length ? lines.join("\n") : undefined;
}

/** Reads recent conversation turns stored on the session. */
async function loadConversation(
  sessionId: string,
): Promise<ConversationTurn[]> {
  try {
    const context =
      await services.sessionService.getConversationContext(sessionId);
    const turns = context?.context?.turns;
    if (!Array.isArray(turns)) return [];
    return turns.filter(
      (turn): turn is ConversationTurn =>
        !!turn &&
        typeof turn === "object" &&
        typeof (turn as ConversationTurn).content === "string" &&
        ["user", "assistant", "system"].includes(
          (turn as ConversationTurn).role,
        ),
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
    const saved =
      await services.sessionService.getConversationContext(sessionId);
    const previous = await loadConversation(sessionId);
    await services.sessionService.saveConversationContext({
      sessionId,
      context: { ...saved?.context, turns: [...previous, ...turns].slice(-10) },
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to persist conversation context:", error);
  }
}

/** Added products need their own price/name binding even if the cart is empty. */
async function proposalMenuSignature(
  actions: ProposedAction[],
): Promise<string> {
  const ids = [
    ...new Set(
      actions
        .filter((action) => action.type === "ADD_TO_CART")
        .map((action) =>
          String(
            action.parameters.itemId ?? action.parameters.menuItemId ?? "",
          ),
        ),
    ),
  ].sort();
  const products = await Promise.all(
    ids.map(async (id) => {
      const item = await services.menuService.getMenuItemById(id);
      return item
        ? [id, item.name, item.price, item.isActive, item.isAvailable]
        : [id, null];
    }),
  );
  return createHash("sha256").update(JSON.stringify(products)).digest("hex");
}

async function describeActions(
  actions: ProposedAction[],
  userId: string,
): Promise<string[]> {
  const view = await services.cartService.getCartView(userId);
  const money = (value: number) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(value);
  return Promise.all(
    actions.map(async (action) => {
      const id = String(
        action.parameters.itemId ?? action.parameters.menuItemId ?? "",
      );
      const quantity = Number(action.parameters.quantity ?? 1);
      if (action.type === "ADD_TO_CART") {
        const item = await services.menuService.getMenuItemById(id);
        return `Thêm ${quantity} × ${item?.name ?? id}: ${money((item?.price ?? 0) * quantity)}`;
      }
      const line = view?.items.find(
        (item) => item.id === id || item.menuItemId === id,
      );
      if (action.type === "UPDATE_CART")
        return `Đổi ${line?.nameSnapshot ?? id} thành ${quantity} phần: ${money((line?.unitPrice ?? 0) * quantity)}`;
      if (action.type === "REMOVE_FROM_CART")
        return `Xoá ${line?.nameSnapshot ?? id} khỏi giỏ hàng`;
      return "Xoá toàn bộ món trong giỏ hàng";
    }),
  );
}

function buildUserPrompt(message: string): string {
  // History is already passed as provider conversation turns. Keep the latest
  // customer message separate instead of duplicating the entire conversation.
  return `Tin nhắn hiện tại: ${message}\nPhân tích ý định và chỉ trả JSON theo schema.\nUSER_MESSAGE_JSON:${JSON.stringify(message)}`;
}
