import { DomainError } from "@/lib/domain-error";
import { calculateCartTotals, type Cart, type CartItem } from "@/lib/types/cart";

/** Validate a prepared full cart before the repository performs any write. */
export function assertCartCommit(cart: Cart, items: CartItem[]) {
  const totals = calculateCartTotals(items);
  if (cart.status !== "ACTIVE" || !cart.id || !cart.userId || !cart.revision || items.length > 50 ||
      new Set(items.map(item => item.id)).size !== items.length ||
      new Set(items.map(item => item.menuItemId)).size !== items.length ||
      items.some(item => item.cartId !== cart.id || !item.id || !item.menuItemId ||
        !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 100 ||
        !Number.isSafeInteger(item.unitPrice) || item.unitPrice < 0 ||
        item.subtotal !== item.unitPrice * item.quantity || Object.keys(item.options ?? {}).length > 0) ||
      !Number.isSafeInteger(totals.total) || cart.subtotal !== totals.subtotal || cart.total !== totals.total ||
      cart.discount !== 0 || cart.deliveryFee !== 0)
    throw new DomainError("INVALID_CART", "Dữ liệu giỏ hàng không hợp lệ. Hãy tải lại hoặc xoá giỏ để chọn món lại.");
}
