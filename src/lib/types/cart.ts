export type CartStatus = "ACTIVE" | "CHECKED_OUT" | "ABANDONED";

export interface Cart {
  id: string;
  userId: string;
  status: CartStatus;
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  id: string;
  cartId: string;
  menuItemId: string;
  nameSnapshot: string;
  unitPrice: number;
  quantity: number;
  options?: Record<string, string>;
  subtotal: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Totals derived from a cart's line items. Always computed from
 * authoritative line-item data, never supplied by the LLM or the client.
 */
export function calculateCartTotals(items: CartItem[]): {
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
} {
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const discount = 0;
  const deliveryFee = 0;
  return { subtotal, discount, deliveryFee, total: subtotal - discount + deliveryFee };
}

/** Recomputes every line subtotal from its authoritative unit price. */
export function withRecalculatedSubtotals(item: CartItem): CartItem {
  return { ...item, subtotal: item.unitPrice * item.quantity };
}

