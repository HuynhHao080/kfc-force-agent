import { DomainError } from "@/lib/domain-error";
import { createHash, randomUUID } from "node:crypto";
import { CartRepository } from "@/lib/db/repositories/interfaces/cart-repository.interface";
import {
  Cart,
  CartItem,
  calculateCartTotals,
  withRecalculatedSubtotals,
} from "@/lib/types/cart";
import type { MenuService } from "./menu-service";
import { MenuItem } from "@/lib/types/menu";

export class CartDomainError extends DomainError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "CartDomainError";
  }
}

export interface CartView {
  signature: string;
  cart: Cart;
  items: CartItem[];
}

export class CartService {
  constructor(
    private cartRepository: CartRepository,
    private menuService?: MenuService,
  ) {}

  async getActiveCart(userId: string): Promise<Cart | null> {
    const cart = await this.cartRepository.getActiveCart(userId);
    if (cart && cart.userId !== userId) throw new CartDomainError("CART_FORBIDDEN", "Không có quyền truy cập giỏ hàng này.");
    return cart;

  }

  async getCartById(cartId: string): Promise<Cart | null> {
    return this.cartRepository.getCartById(cartId);
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
      throw new CartDomainError(
        "CART_FORBIDDEN",
        "Không có quyền truy cập giỏ hàng này.",
      );
    }
    return cart;
  }

  /** Creates the user's active cart if it does not exist yet. */
  async getOrCreateActiveCart(userId: string): Promise<Cart> {
    const existing = await this.getActiveCart(userId);
    if (existing) return existing;
    return (await this.commit(this.newCart(userId), [], true)).cart;
  }
  private newCart(userId: string): Cart {
    const now = new Date().toISOString();
    return { id: `cart_${randomUUID()}`, userId, status: "ACTIVE", subtotal: 0, discount: 0, deliveryFee: 0, total: 0, createdAt: now, updatedAt: now };
  }

  /** Cart plus line items, with totals recalculated from stored prices. */
  async getCartView(userId: string): Promise<CartView | null> {
    const cart = await this.getActiveCart(userId);
    if (!cart) return null;
    const stored = await this.cartRepository.getCartItems(cart.id), items: CartItem[] = [];
    let changed = false;
    for (const line of stored) {
      const current = await this.menuService?.getMenuItemById(line.menuItemId);
      if (current && (line.unitPrice !== current.price || line.nameSnapshot !== current.name)) {
        items.push(withRecalculatedSubtotals({ ...line, unitPrice: current.price, nameSnapshot: current.name, updatedAt: new Date().toISOString() }));
        changed = true;
      } else items.push(line);
    }
    if (changed) return this.commit(cart, items);
    return { cart: this.applyTotals(cart, items), items, signature: this.signature(cart, items) };
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
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      throw new CartDomainError(
        "INVALID_QUANTITY",
        "Số lượng phải là số nguyên lớn hơn 0.",
      );
    }
    if (!menuItem.isActive || !menuItem.isAvailable) {
      throw new CartDomainError("ITEM_UNAVAILABLE", "Món ăn không có sẵn.");
    }

    const currentCart = await this.getActiveCart(userId);
    const cart = currentCart ?? this.newCart(userId);
    const items = currentCart ? [...await this.cartRepository.getCartItems(cart.id)] : [];
    const now = new Date().toISOString();

    if (Object.keys(options).length)
      throw new CartDomainError(
        "INVALID_OPTIONS",
        "Tuỳ chọn món chưa được hỗ trợ. Vui lòng chọn món tiêu chuẩn.",
      );
    const existing = items.find(
      (item) =>
        item.menuItemId === menuItem.id && sameOptions(item.options, options),
    );

    if (!existing && items.length >= 50)
      throw new CartDomainError("CART_LIMIT", "Giỏ hàng tối đa 50 dòng món.");
    if (existing) {
      if (existing.quantity + quantity > 100)
        throw new CartDomainError(
          "INVALID_QUANTITY",
          "Mỗi món tối đa 100 phần.",
        );
      // Merge instead of duplicating; the authoritative price is refreshed.
      const merged: CartItem = withRecalculatedSubtotals({
        ...existing,
        nameSnapshot: menuItem.name,
        unitPrice: menuItem.price,
        quantity: existing.quantity + quantity,
        updatedAt: now,
      });
      items[items.findIndex(item => item.id === existing.id)] = merged;
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
      items.push(item);
    }

    return this.commit(cart, items, !currentCart);
  }

  /**
   * Updates a line quantity. The line item is resolved through the user's own
   * active cart, so a caller cannot mutate somebody else's cart.
   */
  async updateItemQuantity(
    userId: string,
    itemId: string,
    quantity: number,
  ): Promise<CartView> {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      throw new CartDomainError(
        "INVALID_QUANTITY",
        "Số lượng phải là số nguyên lớn hơn 0.",
      );
    }

    const cart = await this.requireActiveCart(userId);
    const items = [...await this.cartRepository.getCartItems(cart.id)];
    const item = this.requireItem(items, itemId);
    const updated: CartItem = withRecalculatedSubtotals({
      ...item,
      quantity,
      updatedAt: new Date().toISOString(),
    });
    return this.commit(cart, items.map(line => line.id === item.id ? updated : line));
  }

  async removeItem(userId: string, itemId: string): Promise<CartView> {
    const cart = await this.requireActiveCart(userId);
    const items = await this.cartRepository.getCartItems(cart.id);
    this.requireItem(items, itemId);
    return this.commit(cart, items.filter(item => item.id !== itemId));
  }

  async clearCart(userId: string): Promise<CartView> {
    return this.commit(await this.requireActiveCart(userId), []);
  }

  private requireItem(items: CartItem[], itemId: string): CartItem {
    const item = items.find(line => line.id === itemId);
    if (!item) throw new CartDomainError("CART_ITEM_NOT_FOUND", "Không tìm thấy món trong giỏ hàng.");
    return item;
  }

  private async commit(cart: Cart, items: CartItem[], creating = false): Promise<CartView> {
    const next = { ...this.applyTotals(cart, items), revision: randomUUID() };
    await this.cartRepository.saveCartView(next, items, creating ? null : cart.revision ?? "legacy");
    return { cart: next, items, signature: this.signature(next, items) };
  }

  private signature(cart: Cart, items: CartItem[]): string {
    return createHash("sha256")
      .update(
        JSON.stringify([
          cart.id,
          items
            .map((item) => [
              item.id,
              item.menuItemId,
              item.quantity,
              item.unitPrice,
              item.nameSnapshot,
              item.options ?? {},
            ])
            .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
        ]),
      )
      .digest("hex");
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
  return leftKeys.every(
    (key, index) => key === rightKeys[index] && left[key] === right[key],
  );
}
