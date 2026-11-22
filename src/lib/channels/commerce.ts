import type { PendingConfirmation } from "@/lib/agent/confirmation";

export interface ChannelCartLine {
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface ChannelQuote {
  cartId: string;
  cartSignature: string;
  lines: ChannelCartLine[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  /** Revision điều kiện cửa hàng khách đã xem; checkout từ chối nếu cửa hàng đổi điều kiện sau đó. */
  shopRevision: string;
}

/**
 * Các thao tác giỏ/đơn mà kênh chat cần ngoài agent. Local và AWS đều dùng service của ứng dụng
 * (local JSON hoặc DynamoDB), cùng kiểm tra như web: chữ ký giỏ, điều kiện cửa hàng, idempotency.
 */
export interface ChannelCommercePort {
  /** Giỏ hiện tại; null khi trống. */
  cart(userId: string): Promise<{ lines: ChannelCartLine[]; subtotal: number } | null>;
  pendingConfirmation(userId: string): Promise<PendingConfirmation | null>;
  /** Như DELETE /api/chat: chỉ bỏ đúng đề xuất khách đang thấy. */
  skipProposal(userId: string, confirmationId: string): Promise<"skipped" | "changed" | "none">;
  /** Ném DomainError khi giỏ trống, cửa hàng đóng hoặc chưa đủ tiền tối thiểu. */
  quote(userId: string, fulfillment: "pickup" | "delivery"): Promise<ChannelQuote>;
  placeOrder(userId: string, input: {
    cartId: string; cartSignature: string; customerName: string; phone: string;
    fulfillment: "pickup" | "delivery"; address: string; idempotencyKey: string; expectedTotal: number; shopRevision: string;
  }): Promise<{ orderId: string; total: number; status: string }>;
  /** false khi chạy chế độ chuyển khách sang website KFC (không nhận đơn xuống bếp). */
  orderingEnabled(): boolean;
}

/** Cổng dùng service container của ứng dụng (nạp khi cần, không nạp lúc import). */
export function servicesCommercePort(): ChannelCommercePort {
  const load = () => import("@/lib/agent/agent-core").then((module) => module.services);
  const pendingOf = async (userId: string) => {
    const services = await load();
    const { activeConfirmation } = await import("@/lib/agent/confirmation");
    const session = await services.sessionService.getActiveSession(userId);
    const saved = session ? await services.sessionService.getConversationContext(session.id) : null;
    return activeConfirmation(saved?.context);
  };
  return {
    async cart(userId) {
      const view = await (await load()).cartService.getCartView(userId);
      if (!view?.items.length) return null;
      return {
        lines: view.items.map((line) => ({ name: line.nameSnapshot, quantity: line.quantity, unitPrice: line.unitPrice })),
        subtotal: view.cart.subtotal,
      };
    },
    pendingConfirmation: pendingOf,
    async skipProposal(userId, confirmationId) {
      const pending = await pendingOf(userId);
      if (!pending) return "none";
      if (pending.id !== confirmationId) return "changed";
      const { invalidateProposal } = await import("@/lib/server/invalidate-proposal");
      await invalidateProposal(userId);
      return "skipped";
    },
    async quote(userId, fulfillment) {
      const services = await load();
      const { CartDomainError } = await import("@/lib/services/cart-service");
      const view = await services.cartService.getCartView(userId);
      if (!view?.items.length) throw new CartDomainError("EMPTY_CART", "Giỏ hàng đang trống.");
      // Lấy điều kiện cửa hàng hiện tại; checkout sau đó kiểm lại đúng revision này.
      const shop = await services.shopService.view();
      const terms = await services.shopService.checkoutTerms(fulfillment, view.cart.subtotal, shop.settings.revision);
      const deliveryFee = fulfillment === "delivery" ? terms.deliveryFee : 0;
      return {
        cartId: view.cart.id,
        cartSignature: view.signature,
        lines: view.items.map((line) => ({ name: line.nameSnapshot, quantity: line.quantity, unitPrice: line.unitPrice })),
        subtotal: view.cart.subtotal,
        deliveryFee,
        total: view.cart.subtotal + deliveryFee,
        shopRevision: terms.revision,
      };
    },
    async placeOrder(userId, input) {
      const services = await load();
      const { createOrderSchema } = await import("@/lib/validation/order");
      // Cùng schema với POST /api/orders: tên, số điện thoại Việt Nam, địa chỉ giao hàng, xác nhận.
      const order = await services.checkoutService.checkout(userId, createOrderSchema.parse({ ...input, note: "", confirm: true }));
      const { invalidateProposal } = await import("@/lib/server/invalidate-proposal");
      await invalidateProposal(userId);
      return { orderId: order.id, total: order.total, status: order.status };
    },
    orderingEnabled: () => process.env.KFC_PURCHASE_ASSISTANT !== "1",
  };
}
