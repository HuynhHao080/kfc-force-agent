import { Cart, CartItem } from "@/lib/types/cart";

export interface CartRepository {
  /** One atomic cart/items/totals commit. null creates; legacy matches a cart without revision. */
  saveCartView(cart: Cart, items: CartItem[], expectedRevision: string | null): Promise<void>;
  completeReorder(
    cart: Cart,
    items: CartItem[],
    expectedCartId: string | null,
  ): Promise<void>;
  /** Most recently updated ACTIVE cart owned by the user, or null. */
  getActiveCart(userId: string): Promise<Cart | null>;
  getCartById(cartId: string): Promise<Cart | null>;
  createCart(cart: Cart): Promise<void>;
  /** Persists cart-level totals. */
  updateCart(cart: Cart): Promise<void>;
  getCartItems(cartId: string): Promise<CartItem[]>;
  getCartItemById(cartId: string, itemId: string): Promise<CartItem | null>;
  /** Adds a new line item. Callers must merge duplicates first. */
  addItem(item: CartItem): Promise<void>;
  /**
   * Replaces a line item. Quantity and subtotal are recomputed by the
   * caller from the authoritative unit price held on the stored item.
   */
  updateItem(item: CartItem): Promise<void>;
  removeItem(cartId: string, itemId: string): Promise<void>;
  clearCart(cartId: string): Promise<void>;
}
