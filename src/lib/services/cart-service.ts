import { CartRepository } from "@/lib/db/repositories/interfaces/cart-repository.interface";
import { Cart, CartItem, calculateCartTotals, withRecalculatedSubtotals } from "@/lib/types/cart";
import { MenuItem } from "@/lib/types/menu";

export class CartDomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "CartDomainError";
  }
}

export interface CartView {
  cart: Cart;
  items: CartItem[];
}

export class CartService {
  constructor(private cartRepository: CartRepository) {}

  async getActiveCart(userId: string): Promise<Cart | null> {
    return this.cartRepository.getActiveCart(userId);
  }

  async createCart(cart: Cart): Promise<void> {
    await this.cartRepository.createCart(cart);
  }

  async getCartItems(cartId: string): Promise<CartItem[]> {
    return this.cartRepository.getCartItems(cartId);
  }

  /**
   * Resolves the user's active cart, asserting ownership.
   * The cartId is never trusted from the caller.
   */
  async requireActiveCart(userId: string): Promise<Cart> {
    const cart = await this.cartRepository.getActiveCart(userId);
    if (!cart) {
      throw new CartDomainError("CART_NOT_FOUND", "Không tìm thấy giỏ hàng.");
    }
    if (cart.userId !== userId) {
      throw new CartDomainError("CART_FORBIDDEN", "Không có quyền truy cập giỏ hàng này.");
    }
    return cart;
  }

  /** Creates the user's active cart if it does not exist yet. */
  async getOrCreateActiveCart(userId: string): Promise<Cart> {
    const existing = await this.cartRepository.getActiveCart(userId);
    if (existing) {
      if (existing.userId !== userId) {
        throw new CartDomainError("CART_FORBIDDEN", "Không có quyền truy cập giỏ hàng này.");
      }
      return existing;
    }

    const now = new Date().toISOString();
    const cart: Cart = {
      id: `cart_${userId}`,
      userId,
      status: "ACTIVE",
      subtotal: 0,
      discount: 0,
      deliveryFee: 0,
      total: 0,
      createdAt: now,
      updatedAt: now,
    };
    await this.cartRepository.createCart(cart);
    return cart;
  }

  /** Cart plus line items, with totals recalculated from stored prices. */
  async getCartView(userId: string): Promise<CartView | null> {
    const cart = await this.cartRepository.getActiveCart(userId);
    if (!cart) return null;
    const items = await this.cartRepository.getCartItems(cart.id);
    return { cart: this.applyTotals(cart, items), items };
  }

  /**
   * Adds a menu item to the user's active cart.
   *
   * `menuItem` must come from the MenuService: it is the only authoritative
   * source of the unit price and of the product's existence/availability.
   * No price supplied by the LLM or client is ever accepted.
   *
   * An existing line for the same menu item (with the same options) is merged
   * instead of appended, so repeated adds never produce duplicate lines.
   */
  async addMenuItem(
    userId: string,
    menuItem: MenuItem,
    quantity: number,
    options: Record<string, string> = {},
  ): Promise<CartView> {
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new CartDomainError("INVALID_QUANTITY", "Số lượng phải là số nguyên lớn hơn 0.");
    }
    if (!menuItem.isActive || !menuItem.isAvailable) {
      throw new CartDomainError("ITEM_UNAVAILABLE", "Món ăn không có sẵn.");
    }

    const cart = await this.getOrCreateActiveCart(userId);
    const items = await this.cartRepository.getCartItems(cart.id);
    const now = new Date().toISOString();

    const existing = items.find(
      (item) => item.menuItemId === menuItem.id && sameOptions(item.options, options),
    );

    if (existing) {
      // Merge instead of duplicating; the authoritative price is refreshed.
      const merged: CartItem = withRecalculatedSubtotals({
        ...existing,
        nameSnapshot: menuItem.name,
        unitPrice: menuItem.price,
        quantity: existing.quantity + quantity,
        updatedAt: now,
      });
      await this.cartRepository.updateItem(merged);
    } else {
      const item: CartItem = {
        id: `item_${menuItem.id}_${Date.now()}`,
        cartId: cart.id,
        menuItemId: menuItem.id,
        nameSnapshot: menuItem.name,
        unitPrice: menuItem.price,
        quantity,
        options,
        subtotal: menuItem.price * quantity,
        createdAt: now,
        updatedAt: now,
      };
      await this.cartRepository.addItem(item);
    }

    return this.finalize(cart);
  }

  /**
   * Updates a line quantity. The line item is resolved through the user's own
   * active cart, so a caller cannot mutate somebody else's cart.
   */
  async updateItemQuantity(userId: string, itemId: string, quantity: number): Promise<CartView> {
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new CartDomainError("INVALID_QUANTITY", "Số lượng phải là số nguyên lớn hơn 0.");
    }

    const cart = await this.requireActiveCart(userId);
    const item = await this.requireItem(cart, itemId);
    const updated: CartItem = withRecalculatedSubtotals({
      ...item,
      quantity,
      updatedAt: new Date().toISOString(),
    });
    await this.cartRepository.updateItem(updated);

    return this.finalize(cart);
  }

  async removeItem(userId: string, itemId: string): Promise<CartView> {
    const cart = await this.requireActiveCart(userId);
    await this.requireItem(cart, itemId);
    await this.cartRepository.removeItem(cart.id, itemId);
    return this.finalize(cart);
  }

  async clearCart(userId: string): Promise<CartView> {
    const cart = await this.requireActiveCart(userId);
    await this.cartRepository.clearCart(cart.id);
    return this.finalize(cart);
  }

  private async requireItem(cart: Cart, itemId: string): Promise<CartItem> {
    const item = await this.cartRepository.getCartItemById(cart.id, itemId);
    if (!item) {
      throw new CartDomainError("CART_ITEM_NOT_FOUND", "Không tìm thấy món trong giỏ hàng.");
    }
    return item;
  }

  /**
   * Recomputes cart totals from the stored line items and persists them so
   * cart.subtotal/total never drift from the line items.
   */
  private async finalize(cart: Cart): Promise<CartView> {
    const items = await this.cartRepository.getCartItems(cart.id);
    const updatedCart = this.applyTotals(cart, items);
    await this.cartRepository.updateCart(updatedCart);
    return { cart: updatedCart, items };
  }

  private applyTotals(cart: Cart, items: CartItem[]): Cart {
    const totals = calculateCartTotals(items);
    return {
      ...cart,
      subtotal: totals.subtotal,
      discount: totals.discount,
      deliveryFee: totals.deliveryFee,
      total: totals.total,
      updatedAt: new Date().toISOString(),
    };
  }
}

function sameOptions(
  a: Record<string, string> | undefined,
  b: Record<string, string> | undefined,
): boolean {
  const left = a ?? {};
  const right = b ?? {};
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key, index) => key === rightKeys[index] && left[key] === right[key]);
}

