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
import { FavoritesService } from "@/lib/services/favorites-service";
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
import { LLMProvider, type LLMResult } from "@/lib/agent/providers/llm-provider";
import { ToolExecutionContext, ToolResult } from "@/lib/agent/tools/agent-tool";
import { toolRegistry } from "@/lib/agent/tools/tool-registry";
import { getToolMapping, PolicyEngine } from "@/lib/policy/policy-engine";
import { systemPrompt } from "@/lib/agent/prompts/system-prompt";
import { catalogContext } from "./catalog-context";
import { resolveMenuMention } from "./understanding/menu-resolver";
import { groundedReply } from "./understanding/grounded-reply";
import { rankMenuCandidates } from "./understanding/menu-resolver";
import { ToolAgent } from "./tool-agent/agent";
import { officialKfcSources } from "@/lib/catalog/official-sources";
import type { CartChange, ToolAgentDeps } from "./tool-agent/tools";
import { officialAnswer } from "./official-answer";
import { chatProducts } from "./chat-products";
import { ReadOnlyAgent } from "@/lib/agent/read-only/agent";
import type { ReadOnlyTrace } from "@/lib/agent/read-only/contract";
import { ChannelStateService } from "@/lib/channels/state-service";

export interface AgentCoreResult {
  reply: string;
  sessionId: string;
  actions: ProposedAction[];
  requiresConfirmation: boolean;
  execution: ActionExecutionResult[];
  pendingConfirmation?: PendingConfirmation | null;
  ai?: ReadOnlyTrace;
  /** Catalog items the reply refers to, for product cards (tool agent). */
  productIds?: string[];
}

export class ServiceContainer {
  feedbackService: FeedbackService;
  shopService: ShopService;
  accountService: AccountService;
  addressService: AddressService;
  favoritesService: FavoritesService;
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
  channelStateService: ChannelStateService;
  menuTool: MenuTool;
  cartTool: CartTool;
  bedrockService: BedrockService;
  llmProvider: LLMProvider;
  policyEngine: PolicyEngine;
  readOnlyAgent: ReadOnlyAgent | null;
  toolAgent: ToolAgent | null;

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
    this.favoritesService = new FavoritesService(repositories.userRepository, this.menuService);
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
    this.channelStateService = new ChannelStateService(repositories.channelRepository);

    this.menuTool = new MenuTool(this.menuService);
    this.cartTool = new CartTool(this.cartService, this.menuService);

    this.bedrockService = new BedrockService({
      modelId: process.env.BEDROCK_MODEL_ID || "mock-model",
    });
    this.llmProvider = createLLMProvider(this.bedrockService);
    this.policyEngine = new PolicyEngine(this.cartService, this.menuService);
    this.readOnlyAgent = (process.env.AI_PROVIDER || "mock").toLowerCase() === "bedrock" &&
      process.env.KFC_AGENT_MODE === "read-only"
      ? new ReadOnlyAgent(this.bedrockService, executeProposedActions)
      : null;
    // Tool-using agent: the model calls search/cart tools and writes the reply,
    // which is verified against tool evidence before it is shown.
    this.toolAgent = (process.env.AI_PROVIDER || "mock").toLowerCase() === "bedrock" &&
      process.env.KFC_AGENT_MODE === "tools"
      ? new ToolAgent(this.bedrockService)
      : null;

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
    const sourceAnswer = request.selectedProduct || services.toolAgent ? undefined : officialAnswer(request.message);
    if (sourceAnswer) {
      return { reply: sourceAnswer, sessionId, actions: [], requiresConfirmation: false, execution: [] };
    }
    if (services.readOnlyAgent && !request.selectedProduct) {
      const result = await services.readOnlyAgent.run(request.message, conversation, {
        userId: request.userId,
        sessionId,
        confirmed: false,
      }, saved?.context.readOnlyDialogue);
      const latest = await services.sessionService.getConversationContext(sessionId);
      await services.sessionService.saveConversationContext({
        sessionId,
        context: { ...latest?.context, readOnlyDialogue: result.dialogueState },
        updatedAt: new Date().toISOString(),
      });
      return result;
    }
    if (services.toolAgent && !request.selectedProduct)
      return runToolAgent(services.toolAgent, request.message, conversation, request.userId, sessionId);
    // The full catalog (including sold-out items) lets the context say "tạm hết"
    // instead of letting the model guess a substitute; candidates stay orderable only.
    const [menu, catalogItems, categories, basket] = await Promise.all([
      services.menuService.getAvailableMenuItems(),
      services.menuService.getMenuItems(),
      services.menuService.getCategories(),
      services.cartService.getCartView(request.userId),
    ]);
    const recentMessages = await services.sessionService.getMessages(sessionId);
    const lastProducts = recentMessages.findLast(message => message.role === "assistant" && !!message.productIds?.length)?.productIds ?? [];
    const shownProducts = chatProducts(lastProducts, menu).map((item, index) => ({ position: index + 1, id: item.id, name: item.name, priceVnd: item.price }));
    const userPrompt = catalogContext(request.message, catalogItems, basket?.items ?? [], categories) + "\nDISPLAYED_PRODUCTS_JSON:" + JSON.stringify(shownProducts) + "\n" + buildUserPrompt(request.message);

    let llmResponse: LLMResult;
    if (request.selectedProduct) {
      // Explicit card clicks already identify the SKU. Policy still owns validation
      // and confirmation, so this path needs no paid model interpretation.
      llmResponse = { success: true, response: {
        message: "Bạn đã chọn món. Hãy kiểm tra đề xuất trước khi xác nhận.",
        intent: "ADD_TO_CART", confidence: 1, requiresConfirmation: true,
        actions: [{ id: randomUUID(), type: "ADD_TO_CART", parameters: { ...request.selectedProduct }, requiresConfirmation: true }],
      } };
    } else {
      llmResponse = await services.llmProvider.generateResponse(systemPrompt, userPrompt, conversation);
    }

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

    // The provider's generic "chưa hiểu" (intent UNKNOWN, no action) hides any
    // useful answer. Replace it with a reply written from verified catalog data
    // only; the model's free text is still never shown to the customer.
    if (agentResponse.actions.length === 0 && agentResponse.intent === "UNKNOWN") {
      const grounded = groundedReply(request.message, catalogItems, categories, basket?.items ?? []);
      // Defence in depth: even if a provider forwards model text here, it is not shown.
      return {
        reply: grounded ?? "Mình chưa hiểu rõ yêu cầu. Bạn hãy nêu tên món và số lượng nhé.",
        sessionId, actions: [], requiresConfirmation: false, execution: [],
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
    const pendingConfirmation = await storePendingProposal(sessionId, request.userId, pendingActions);

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
      // Match only against the customer's own cart lines, with the same
      // accent/alias/size handling as the menu ("pepsi lớn" is not "Pepsi (Lon)").
      const view = await services.cartService.getCartView(context.userId);
      const lines = (view?.items ?? []).map((line) => ({
        id: line.id,
        name: line.nameSnapshot,
        price: line.unitPrice,
        isActive: true,
        isAvailable: true,
      }));
      const match = resolveMenuMention(action.parameters.query, lines);
      if (match.status === "resolved") action.parameters.itemId = match.items[0].id;
    }
    if (
      (action.type === "REMOVE_FROM_CART" || action.type === "UPDATE_CART") &&
      typeof action.parameters.itemId === "string"
    ) {
      // The model sees cart lines by catalog ID (CATALOG_CONTEXT_JSON cart.itemId)
      // and the policy accepts either ID, but CartService edits by cart-line ID.
      // Translate a catalog ID to the customer's own line when exactly one matches;
      // otherwise leave it, so the edit fails closed instead of guessing.
      const view = await services.cartService.getCartView(context.userId);
      const items = view?.items ?? [];
      if (!items.some((line) => line.id === action.parameters.itemId)) {
        const owned = items.filter((line) => line.menuItemId === action.parameters.itemId);
        if (owned.length === 1) action.parameters.itemId = owned[0].id;
      }
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
/**
 * Stores the actions awaiting the customer's button confirmation, with a new
 * confirmation id, TTL and the cart/menu signatures the confirmation will be
 * checked against. Shared by the classic and the tool-agent paths.
 */
async function storePendingProposal(
  sessionId: string,
  userId: string,
  pendingActions: ProposedAction[],
): Promise<PendingConfirmation | null> {
  const latest = await services.sessionService.getConversationContext(sessionId);
  const view = pendingActions.length ? await services.cartService.getCartView(userId) : null;
  const pendingMenuSignature = pendingActions.length ? await proposalMenuSignature(pendingActions) : null;
  const pendingConfirmation: PendingConfirmation | null = pendingActions.length
    ? {
        id: randomUUID(),
        expiresAt: new Date(Date.now() + CONFIRMATION_TTL_MS).toISOString(),
        summary: await describeActions(pendingActions, userId),
      }
    : null;
  await services.sessionService.saveConversationContext({
    sessionId,
    context: {
      ...latest?.context,
      pendingActions,
      pendingConfirmation,
      pendingCartSignature: view?.signature ?? null,
      pendingMenuSignature,
    },
    updatedAt: new Date().toISOString(),
  });
  return pendingConfirmation;
}

/** One customer turn through the tool-using agent, with tools bound to this customer. */
async function runToolAgent(
  agent: ToolAgent,
  message: string,
  conversation: ConversationTurn[],
  userId: string,
  sessionId: string,
): Promise<AgentCoreResult> {
  const [catalogItems, categories] = await Promise.all([
    services.menuService.getMenuItems(),
    services.menuService.getCategories(),
  ]);
  const categoryName = new Map(categories.map((category) => [category.id, category.name]));
  const withCategory = catalogItems.map((item) => ({ ...item, categoryName: categoryName.get(item.categoryId) }));
  let pendingConfirmation: PendingConfirmation | null = null;
  let proposedActions: ProposedAction[] = [];
  let proposalExecution: ActionExecutionResult[] = [];
  const deps: ToolAgentDeps = {
    async searchMenu(input) {
      const query = input.query?.trim() ?? "";
      const wanted = input.category ? normalizeVietnamese(input.category) : "";
      const category = wanted ? categories.find((entry) => normalizeVietnamese(entry.name) === wanted)
        ?? categories.find((entry) => normalizeVietnamese(entry.name).includes(wanted)) : undefined;
      const all = input.category && !category ? [] : await services.menuService.searchMenuItemsForCustomer(query, {
        maxPrice: input.max_price, minPrice: input.min_price, sort: input.sort ?? "price_asc", categoryId: category?.id,
      });
      const signals = query ? rankMenuCandidates(query, withCategory) : { unknownTokens: [] as string[], soldOut: [] as { name: string }[] };
      // "1 cơm gà rán" names the item "1 Cơm Gà Rán": compare names with a leading count dropped.
      const bare = (value: string) => normalizeVietnamese(value).replace(/^\d+\s+/, "");
      const noPrice = (value: string) => normalizeVietnamese(value).split(" ").filter((word) => !/\d/.test(word)).join(" ");
      // The model may shorten or misspell what the customer said ("gà rán" for "2 miếng gà rán",
      // "xô zone zã" for "xô zòn zã"), so names are also matched against the customer's own words.
      const said = ` ${normalizeVietnamese(message)} `;
      const inMessage = (name: string) => said.includes(` ${normalizeVietnamese(name)} `);
      const isExact = (name: string) => inMessage(name)
        || (!!query && (normalizeVietnamese(name) === normalizeVietnamese(query) || bare(name) === bare(query)));
      const ranked = [...all.filter((item) => isExact(item.name)), ...all.filter((item) => !isExact(item.name))];
      const hit = (item: (typeof all)[number]) => ({
        id: item.id, name: item.name, price: item.price,
        category: categoryName.get(item.categoryId),
        description: item.description?.slice(0, 160),
        ...(isExact(item.name) ? { exact: true } : {}),
      });
      // Removed items the customer or the query names, and what is on sale under the same name without
      // its price tag ("xô zòn zã 159k" → "Xô Zòn Zã 179K").
      const discontinuedItems = catalogItems.filter((item) => !item.isActive && (inMessage(item.name)
        || (!!query && (normalizeVietnamese(item.name) === normalizeVietnamese(query)
          || (noPrice(item.name) !== "" && noPrice(item.name) === noPrice(query))))));
      const discontinued = discontinuedItems.map((item) => item.name);
      const similarQuery = discontinuedItems.length ? noPrice(discontinuedItems[0].name)
        : query && all.length === 0 && noPrice(query) !== normalizeVietnamese(query) ? noPrice(query) : "";
      const similar = similarQuery
        ? (await services.menuService.searchMenuItemsForCustomer(similarQuery, { sort: "price_asc" })).slice(0, 5)
        : [];
      return {
        items: ranked.slice(0, input.limit ?? 8).map(hit),
        ...(discontinued.length ? { discontinued } : {}),
        ...(similar.length ? { similar: similar.map(hit) } : {}),
        totalMatches: all.length,
        notOnMenu: signals.unknownTokens,
        soldOut: signals.soldOut.map((item) => item.name),
        // With no hit, give the model the real menu groups so a suggestion comes from data, not memory.
        ...(all.length === 0 ? {
          categories: categories.map((entry) => entry.name),
          note: "Không có món nào khớp: KFC không bán món này. Muốn gợi ý món thay thế, gọi search_menu lại theo category và chỉ nhắc món có trong kết quả.",
        } : {}),
      };
    },
    async viewCart() {
      const view = await services.cartService.getCartView(userId);
      const lines = (view?.items ?? []).map((line) => ({
        item_id: line.menuItemId, name: line.nameSnapshot, quantity: line.quantity,
        unit_price: line.unitPrice, subtotal: line.unitPrice * line.quantity,
      }));
      return { lines, total: lines.reduce((sum, line) => sum + line.subtotal, 0) };
    },
    async proposeChanges(changes: CartChange[]) {
      const actions: ProposedAction[] = changes.map((change) => ({
        id: randomUUID(),
        type: change.action === "add" ? "ADD_TO_CART" : change.action === "set_quantity" ? "UPDATE_CART"
          : change.action === "remove" ? "REMOVE_FROM_CART" : "CLEAR_CART",
        parameters: change.action === "clear" ? {} : { itemId: change.item_id, ...(change.quantity ? { quantity: change.quantity } : {}) },
        requiresConfirmation: true,
      }));
      const execution = await executeProposedActions(actions, { userId, sessionId, confirmed: false });
      const pending = actions.filter((action) =>
        execution.some((row) => row.actionId === action.id && row.decision === "REQUIRE_CONFIRMATION"));
      // An id that is not in the catalog is a copying mistake, not a sold-out item: say so, or the model tells
      // the customer the product is out of stock.
      const unknownIds = changes.filter((change) => change.action === "add" && change.item_id
        && !catalogItems.some((item) => item.id === change.item_id)).map((change) => change.item_id);
      const blocked = [
        ...unknownIds.map((id) => `item_id "${id}" không có trong catalog (mã sai, KHÔNG phải món hết hàng): lấy đúng item_id từ kết quả search_menu rồi gọi lại.`),
        ...execution.filter((row) => row.decision === "BLOCK").map((row) => row.reason ?? "Không thực hiện được."),
      ];
      // The latest proposal in a turn replaces earlier ones, as a new request does.
      pendingConfirmation = await storePendingProposal(sessionId, userId, pending);
      proposedActions = pending;
      proposalExecution = execution;
      // Product names in the proposal (catalog id for additions, cart line for edits), for the reply check.
      const lines = pending.length ? (await services.cartService.getCartView(userId))?.items ?? [] : [];
      const items = pending.flatMap((action) => {
        const id = String(action.parameters.itemId ?? "");
        const name = catalogItems.find((item) => item.id === id)?.name
          ?? lines.find((line) => line.id === id || line.menuItemId === id)?.nameSnapshot;
        return name ? [name] : [];
      });
      return {
        status: pending.length ? "awaiting_customer_confirmation" : "blocked",
        summary: pendingConfirmation?.summary ?? [],
        items,
        blocked,
      };
    },
    officialInfo(topic) {
      const url = topic === "allergens" ? officialKfcSources.allergens : officialKfcSources.restaurants;
      const note = topic === "allergens"
        ? "Bảng thành phần dị ứng do KFC công bố. Không suy đoán thành phần; khách cần tự kiểm tra và xác nhận với KFC."
        : topic === "opening_hours"
          ? "Giờ mở cửa khác nhau theo từng nhà hàng; khách xem tại trang hệ thống nhà hàng."
          : "Danh sách và địa chỉ nhà hàng KFC.";
      return { topic, url, note };
    },
    async hasPendingProposal() {
      const stored = (await services.sessionService.getConversationContext(sessionId))?.context as
        { pendingConfirmation?: { expiresAt?: string } | null } | undefined;
      const expiresAt = Date.parse(stored?.pendingConfirmation?.expiresAt ?? "");
      return Number.isFinite(expiresAt) && expiresAt > Date.now();
    },
    async catalog() {
      return catalogItems.map((item) => ({ id: item.id, name: item.name, price: item.price, available: item.isActive && item.isAvailable, retired: !item.isActive, category: categoryName.get(item.categoryId) }));
    },
  };
  try {
    const result = await agent.run(message, conversation, deps);
    // Trace has counts and tool names only: never prompt or message text.
    console.info("tool_agent_turn", JSON.stringify(result.trace));
    return {
      reply: result.reply,
      sessionId,
      actions: proposedActions,
      requiresConfirmation: !!pendingConfirmation,
      pendingConfirmation,
      execution: proposalExecution,
      productIds: result.referencedIds,
    };
  } catch (error) {
    const trace = (error as { trace?: unknown }).trace;
    console.error("tool_agent_failure", error instanceof Error ? error.name : "unknown", trace ? JSON.stringify(trace) : "");
    return {
      reply: "Xin lỗi, hệ thống AI đang gặp sự cố. Vui lòng thử lại sau.",
      sessionId, actions: [], requiresConfirmation: false, execution: [],
    };
  }
}

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
      ? "Đây là kết quả mình vừa tra trong thực đơn."
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
  const displayedItems = result.cart ? result.items ?? [] : (result.items ?? []).slice(0, 6);
  for (const item of displayedItems) {
    if (item.nameSnapshot !== undefined) {
      lines.push(
        `${item.quantity} × ${item.nameSnapshot}: ${money(item.subtotal ?? 0)}`,
      );
    } else if (item.name !== undefined) {
      lines.push(`${item.name}: ${money(item.price ?? 0)}`);
    }
  }
  if (!result.cart && (result.items?.length ?? 0) > 6) lines.push(`Còn ${(result.items?.length ?? 0) - 6} món khác. Bạn có thể nói tên món hoặc khoảng giá để mình lọc tiếp.`);
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
