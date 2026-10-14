import { AgentTool, ToolExecutionContext } from "./agent-tool";
import { CartView, CartService } from "@/lib/services/cart-service";
import { Cart, CartItem } from "@/lib/types/cart";
import { MenuService } from "@/lib/services/menu-service";
import { z } from "zod";

const MAX_ADD_QUANTITY = 100;

export const CartToolInputSchema = z.object({
  operation: z.enum(["get", "add", "update", "remove", "clear"]),
  itemId: z.string().min(1).optional(),
  quantity: z.number().int().min(1).max(MAX_ADD_QUANTITY).optional(),
  options: z.record(z.string(), z.string()).optional(),
});

export type CartToolInput = z.infer<typeof CartToolInputSchema>;

export const CartToolOutputSchema = z.object({
  cart: z.custom<Cart>().nullable().optional(),
  item: z.custom<CartItem>().optional(),
  items: z.array(z.custom<CartItem>()).optional(),
  message: z.string().optional(),
});

export type CartToolOutput = z.infer<typeof CartToolOutputSchema>;

/**
 * Cart tool.
 *
 * The tool never touches a repository directly: every mutation goes through
 * CartService, which resolves the caller's own active cart and derives all
 * prices from the authoritative menu record. `cartId` is intentionally NOT
 * part of the input surface — it is resolved from the execution context so
 * that neither the LLM nor a client can address another user's cart.
 */
export class CartTool extends AgentTool<CartToolInput, CartToolOutput> {
  readonly name = "cart";
  readonly description = "Cart operations: get, add, update, remove, clear";

  constructor(
    private cartService: CartService,
    private menuService: MenuService,
  ) {
    super();
  }

  readonly inputSchema = CartToolInputSchema;
  readonly outputSchema = CartToolOutputSchema;

  protected async executeInternal(
    input: CartToolInput,
    context: ToolExecutionContext,
  ): Promise<CartToolOutput> {
    switch (input.operation) {
      case "get":
        return this.getCart(context.userId);

      case "add":
        return this.addItem(input, context);

      case "update":
        return this.updateItem(input, context);

      case "remove":
        return this.removeItem(input, context);

      case "clear":
        return this.clearCart(context.userId);

      default:
        throw new Error(`Không hỗ trợ thao tác giỏ hàng: ${String(input.operation)}`);
    }
  }

  private async getCart(userId: string): Promise<CartToolOutput> {
    const view = await this.cartService.getCartView(userId);
    if (!view) {
      return { cart: null, items: [], message: "Giỏ hàng của bạn đang trống." };
    }
    return { cart: view.cart, items: view.items };
  }

  private async addItem(
    input: CartToolInput,
    context: ToolExecutionContext,
  ): Promise<CartToolOutput> {
    if (!input.itemId) {
      throw new Error("Thiếu ID món ăn.");
    }

    // Existence, availability and price all come from the menu domain.
    const menuItem = await this.menuService.getMenuItemById(input.itemId);
    if (!menuItem || !menuItem.isActive || !menuItem.isAvailable) {
      throw new Error("Món ăn không tồn tại hoặc không có sẵn.");
    }

    const quantity = input.quantity ?? 1;
    if (quantity < 1) {
      throw new Error("Số lượng phải lớn hơn 0.");
    }
    if (quantity > MAX_ADD_QUANTITY) {
      throw new Error(`Số lượng tối đa cho mỗi món là ${MAX_ADD_QUANTITY}.`);
    }

    const view = await this.cartService.addMenuItem(
      context.userId,
      menuItem,
      quantity,
      input.options ?? {},
    );

    return {
      cart: view.cart,
      items: view.items,
      message: `Đã thêm ${quantity} ${menuItem.name} vào giỏ hàng.`,
    };
  }

  private async updateItem(
    input: CartToolInput,
    context: ToolExecutionContext,
  ): Promise<CartToolOutput> {
    if (!input.itemId) {
      throw new Error("Thiếu ID món trong giỏ hàng.");
    }
    const quantity = input.quantity;
    if (quantity === undefined || quantity < 1) {
      throw new Error("Số lượng phải lớn hơn 0.");
    }

    const view = await this.cartService.updateItemQuantity(context.userId, input.itemId, quantity);
    return {
      cart: view.cart,
      items: view.items,
      message: "Đã cập nhật số lượng món ăn.",
    };
  }

  private async removeItem(
    input: CartToolInput,
    context: ToolExecutionContext,
  ): Promise<CartToolOutput> {
    if (!input.itemId) {
      throw new Error("Thiếu ID món trong giỏ hàng.");
    }

    const view = await this.cartService.removeItem(context.userId, input.itemId);
    return {
      cart: view.cart,
      items: view.items,
      message: "Đã xóa món ăn khỏi giỏ hàng.",
    };
  }

  private async clearCart(userId: string): Promise<CartToolOutput> {
    const view: CartView = await this.cartService.clearCart(userId);
    return {
      cart: view.cart,
      items: view.items,
      message: "Đã xóa toàn bộ giỏ hàng.",
    };
  }
}

