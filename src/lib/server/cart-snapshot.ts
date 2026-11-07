import { DomainError } from "@/lib/domain-error";
import type { CartService } from "@/lib/services/cart-service";
/** Optimistic UI guard, never an ownership/authentication credential. */
export async function assertCartSnapshot(request: Request, carts: CartService, userId: string) {
  const expected = request.headers.get("x-kfc-cart-signature");
  if (expected === null) return; // Legacy API clients; the current UI always sends it.
  if (expected !== "empty" && !/^[a-f0-9]{64}$/.test(expected))
    throw new DomainError("INVALID_CART_SNAPSHOT", "Phiên bản giỏ chưa hợp lệ. Hãy tải lại.");
  const current = await carts.getCartView(userId);
  if ((current?.signature ?? "empty") !== expected)
    throw new DomainError("CART_CHANGED", "Giỏ đã thay đổi ở lần thao tác khác. Hãy kiểm tra giỏ mới trước khi tiếp tục.", 409);
}
