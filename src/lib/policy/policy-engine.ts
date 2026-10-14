import { ActionType, PolicyDecision, ProposedAction } from "@/lib/types/agent";
import { CartService } from "@/lib/services/cart-service";
import { MenuService, normalizeVietnamese } from "@/lib/services/menu-service";
import { CartToolInputSchema, CartToolInput } from "@/lib/agent/tools/cart-tool";
import { z } from "zod";

export type { PolicyDecision };

export interface PolicyContext {
  userId: string;
  sessionId: string;
  requestId?: string;
  /** Explicit confirmation flag. Never derived from free-form text. */
  confirmed?: boolean;
}

export interface PolicyResult {
  decision: PolicyDecision;
  reason: string;
}

/** Maximum quantity allowed for a single add-to-cart action. */
export const MAX_ACTION_QUANTITY = 100;

export type CartOperation = CartToolInput["operation"];

interface ToolMapping {
  tool: "menu" | "cart";
  operation: CartOperation | null;
  mutating: boolean;
  parameterSchema: z.ZodType<unknown>;
}

const menuActionSchema = z.object({
  query: z.string().optional(),
  itemId: z.string().min(1).optional(),
  categoryId: z.string().min(1).optional(),
  bundleId: z.string().min(1).optional(),
});

const cartMutationSchema = CartToolInputSchema.partial().extend({
  query: z.string().optional(),
  menuItemId: z.string().min(1).optional(),
});

/**
 * Single source of truth for action type -> tool routing.
 * Every supported action MUST appear here explicitly; anything missing is
 * blocked. There is no heuristic or prefix-based fallback.
 */
const ACTION_TO_TOOL: Record<ActionType, ToolMapping | undefined> = {
  SEARCH_MENU: {
    tool: "menu",
    operation: null,
    mutating: false,
    parameterSchema: menuActionSchema,
  },
  LIST_MENU: {
    tool: "menu",
    operation: null,
    mutating: false,
    parameterSchema: menuActionSchema,
  },
  GET_MENU_ITEM: {
    tool: "menu",
    operation: null,
    mutating: false,
    parameterSchema: menuActionSchema,
  },
  VIEW_CART: {
    tool: "cart",
    operation: "get",
    mutating: false,
    parameterSchema: CartToolInputSchema.partial(),
  },
  ADD_TO_CART: {
    tool: "cart",
    operation: "add",
    mutating: true,
    parameterSchema: cartMutationSchema,
  },
  UPDATE_CART: {
    tool: "cart",
    operation: "update",
    mutating: true,
    parameterSchema: cartMutationSchema,
  },
  REMOVE_FROM_CART: {
    tool: "cart",
    operation: "remove",
    mutating: true,
    parameterSchema: cartMutationSchema,
  },
  CLEAR_CART: {
    tool: "cart",
    operation: "clear",
    mutating: true,
    parameterSchema: z.object({}),
  },
  // UNKNOWN is explicitly unmappable: it always blocks.
  UNKNOWN: undefined,
};

/** Explicit action type -> tool routing, for callers that need it. */
export function getToolMapping(actionType: ActionType): ToolMapping | undefined {
  return ACTION_TO_TOOL[actionType];
}

export function isMutatingAction(actionType: ActionType): boolean {
  return ACTION_TO_TOOL[actionType]?.mutating ?? true;
}

export class PolicyEngine {
  constructor(
    private cartService: CartService,
    private menuService: MenuService,
  ) {}

  /**
   * Evaluates one proposed action BEFORE any tool execution.
   *
   * Ordering is deterministic and every check has a fixed priority:
   *   1. structural validation      -> BLOCK
   *   2. action allowlist           -> BLOCK
   *   3. tool mapping exists        -> BLOCK
   *   4. parameter schema/quantity  -> BLOCK
   *   5. domain + ownership         -> BLOCK
   *   6. confirmation requirement   -> REQUIRE_CONFIRMATION
   *   7. otherwise                  -> ALLOW
   */
  async evaluateAction(action: ProposedAction, context: PolicyContext): Promise<PolicyResult> {
    // 1. structural validation
    if (!action || typeof action !== "object" || typeof action.type !== "string") {
      return { decision: "BLOCK", reason: "Action không hợp lệ: thiếu type" };
    }

    // 2. + 3. allowlist and explicit tool mapping
    const mapping = ACTION_TO_TOOL[action.type as ActionType];
    if (!mapping) {
      return { decision: "BLOCK", reason: `Loại hành động không được hỗ trợ: ${action.type}` };
    }

    // 4. parameters
    const parameterCheck = this.validateParameters(action, mapping);
    if (parameterCheck.decision !== "ALLOW") {
      return parameterCheck;
    }

    // 5. domain / ownership
    const domainCheck = await this.checkDomain(action, mapping.operation, context);
    if (domainCheck.decision !== "ALLOW") {
      return domainCheck;
    }

    // 6. confirmation for mutations
    if (mapping.mutating && !context.confirmed) {
      return {
        decision: "REQUIRE_CONFIRMATION",
        reason: "Yêu cầu xác nhận trước khi thực hiện thao tác này.",
      };
    }

    return { decision: "ALLOW", reason: "Hành động được phép thực hiện." };
  }

  private validateParameters(action: ProposedAction, mapping: ToolMapping): PolicyResult {
    const parsed = mapping.parameterSchema.safeParse(action.parameters ?? {});
    if (!parsed.success) {
      return {
        decision: "BLOCK",
        reason: `Tham số hành động không hợp lệ: ${parsed.error.issues
          .map((issue) => issue.message)
          .join(", ")}`,
      };
    }

    const quantity = (parsed.data as { quantity?: number }).quantity;
    if (quantity !== undefined) {
      if (!Number.isInteger(quantity) || quantity < 1) {
        return { decision: "BLOCK", reason: "Số lượng phải là số nguyên lớn hơn 0" };
      }
      if (quantity > MAX_ACTION_QUANTITY) {
        return { decision: "BLOCK", reason: `Số lượng vượt quá giới hạn ${MAX_ACTION_QUANTITY}` };
      }
    }

    return { decision: "ALLOW", reason: "Tham số hợp lệ." };
  }

  private async checkDomain(
    action: ProposedAction,
    operation: CartOperation | null,
    context: PolicyContext,
  ): Promise<PolicyResult> {
    try {
      // Menu actions only ever read authoritative data.
      if (operation === null) {
        return { decision: "ALLOW", reason: "Quyền truy cập được phép." };
      }

      // Read-only cart access never requires an existing cart: an empty cart
      // is a valid state which the tool reports as empty.
      if (operation === "get") {
        return { decision: "ALLOW", reason: "Quyền truy cập được phép." };
      }

      // Mutations always operate on the caller's own cart. The cart may need
      // to be created by the first add, so absence is not an ownership error.
      const cart = await this.cartService.getActiveCart(context.userId);
      if (cart && cart.userId !== context.userId) {
        return { decision: "BLOCK", reason: "Không có quyền truy cập giỏ hàng này" };
      }

      if (operation === "add") {
        const resolved = await this.resolveMenuItem(action.parameters);
        if (resolved.decision !== "ALLOW") {
          return resolved;
        }
      }

      if ((operation === "update" || operation === "remove") && cart) {
        const itemId = readString(action.parameters, "itemId");
        if (itemId) {
          const items = await this.cartService.getCartItems(cart.id);
          const owned = items.some((line) => line.id === itemId || line.menuItemId === itemId);
          if (!owned) {
            return { decision: "BLOCK", reason: "Không tìm thấy món trong giỏ hàng của bạn" };
          }
        }
      }

      return { decision: "ALLOW", reason: "Quyền truy cập được phép." };
    } catch (error) {
      return {
        decision: "BLOCK",
        reason: `Lỗi khi kiểm tra quyền: ${
          error instanceof Error ? error.message : "Lỗi không xác định"
        }`,
      };
    }
  }

  /**
   * Verifies the referenced product exists, is active and is available.
   * Prices are never taken from the action parameters: any price-like key is
   * ignored, and the authoritative price is re-read from the menu at execution.
   */
  private async resolveMenuItem(parameters: Record<string, unknown>): Promise<PolicyResult> {
    const itemId = readString(parameters, "itemId") ?? readString(parameters, "menuItemId");
    if (itemId) {
      const menuItem = await this.menuService.getMenuItemById(itemId);
      if (!menuItem || !menuItem.isActive || !menuItem.isAvailable) {
        return { decision: "BLOCK", reason: "Món ăn không tồn tại hoặc không có sẵn" };
      }
      return { decision: "ALLOW", reason: "Món ăn hợp lệ." };
    }

    const query = readString(parameters, "query");
    if (!query) {
      return { decision: "BLOCK", reason: "Thiếu thông tin món ăn để thêm vào giỏ hàng" };
    }

    const matches = await this.findMenuMatches(query);
    if (matches.length === 0) {
      return { decision: "BLOCK", reason: `Không tìm thấy món phù hợp với "${query}"` };
    }
    if (matches.length > 1) {
      const names = matches.map((item) => item.name).join(", ");
      return { decision: "BLOCK", reason: `Có nhiều món phù hợp với "${query}": ${names}` };
    }
    return { decision: "ALLOW", reason: "Món ăn hợp lệ." };
  }

  /**
   * Resolves a free-text product phrase against the authoritative menu.
   * A match requires every query token to appear in the item text, so
   * "combo ga cay" matches "Combo Gà Cay" but not "Combo Gà Rán".
   */
  async findMenuMatches(query: string): Promise<{ id: string; name: string; price: number }[]> {
    const normalizedQuery = normalizeVietnamese(query);
    if (!normalizedQuery) return [];

    const tokens = normalizedQuery.split(" ").filter((token) => token.length > 0);
    const items = await this.menuService.getAvailableMenuItems();

    return items
      .filter((item) => {
        const haystack = normalizeVietnamese(
          [item.name, item.description ?? "", (item.tags ?? []).join(" ")].join(" "),
        );
        return tokens.every((token) => haystack.includes(token));
      })
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((item) => ({ id: item.id, name: item.name, price: item.price }));
  }
}

function readString(source: Record<string, unknown>, key: string): string | undefined {
  const value = source?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

