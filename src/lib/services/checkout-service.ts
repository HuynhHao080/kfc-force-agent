import { createHash, randomUUID } from "node:crypto";
import { OrderRepository } from "@/lib/db/repositories/interfaces/order-repository.interface";
import { CartService, CartDomainError } from "./cart-service";
import { MenuService } from "./menu-service";
import { CreateOrder } from "@/lib/validation/order";
import { Order, OrderItem, OrderEvent } from "@/lib/types/order";
import type { PromotionService } from "./promotion-service";
import type { CheckoutQuote } from "@/lib/types/promotion";
import { DomainError } from "@/lib/domain-error";
import { SHOP_ORDER_GATE, type ShopService } from "./shop-service";
import { withUserLock } from "@/lib/server/user-lock";

export const DELIVERY_FEE = 15000;
const checkoutOrderId = (userId: string, key: string) =>
  `order_${createHash("sha256").update(`${userId}:${key}`).digest("hex").slice(0, 32)}`;
export class CheckoutService {
  constructor(
    private orders: OrderRepository,
    private carts: CartService,
    private menu: MenuService,
    private promotions?: PromotionService,
    private shop?: ShopService,
  ) {}
  async findAttempt(userId: string, input: { idempotencyKey: string; cartId: string }) {
    const order = await this.orders.getOrderById(checkoutOrderId(userId, input.idempotencyKey));
    if (!order || order.userId !== userId || order.cartId !== input.cartId) return null;
    return this.detail(userId, order.id);
  }
  async quote(
    userId: string,
    input: {
      cartId: string;
      cartSignature: string;
      fulfillment: "pickup" | "delivery";
      promotionCode: string;
      shopRevision?: string;
    },
  ): Promise<CheckoutQuote> {
    const view = await this.carts.getCartView(userId);
    if (!view?.items.length)
      throw new CartDomainError("EMPTY_CART", "Giỏ hàng đang trống.");
    if (view.cart.id !== input.cartId || view.signature !== input.cartSignature)
      throw new CartDomainError(
        "CART_CHANGED",
        "Giỏ hàng đã thay đổi. Hãy tải lại trước khi áp mã.",
      );
    if (!this.promotions)
      throw new CartDomainError(
        "PROMOTION_UNAVAILABLE",
        "Chưa hỗ trợ mã giảm giá.",
      );
    const promotion = await this.promotions.evaluate(
      input.promotionCode,
      view.cart.subtotal,
    );
    const shop = await this.shop?.checkoutTerms(input.fulfillment, view.cart.subtotal, input.shopRevision);
    const deliveryFee = input.fulfillment === "delivery" ? shop?.deliveryFee ?? DELIVERY_FEE : 0;
    return {
      cartId: view.cart.id,
      cartSignature: view.signature,
      subtotal: view.cart.subtotal,
      discount: promotion.discount,
      deliveryFee,
      total: view.cart.subtotal - promotion.discount + deliveryFee,
      promotion,
    };
  }
  async checkout(userId: string, input: CreateOrder, beforeCheckout?: () => Promise<void>): Promise<Order> {
    return withUserLock(SHOP_ORDER_GATE, async () => {
      await beforeCheckout?.();
      return this.checkoutUnlocked(userId, input);
    });
  }
  private async checkoutUnlocked(userId: string, input: CreateOrder): Promise<Order> {
    const id = checkoutOrderId(userId, input.idempotencyKey);
    const requestHash = createHash("sha256")
      .update(JSON.stringify({
        userId,
        cartId: input.cartId,
        cartSignature: input.cartSignature,
        customerName: input.customerName.trim(),
        phone: input.phone.trim(),
        fulfillment: input.fulfillment,
        address: input.fulfillment === "delivery" ? input.address?.trim() ?? "" : "",
        note: input.note?.trim() ?? "",
        expectedTotal: input.expectedTotal,
        promotionCode: input.promotionCode?.trim().toUpperCase() ?? "",
        promotionRevision: input.promotionRevision ?? "",
        ...(input.shopRevision !== undefined ? { shopRevision: input.shopRevision } : {}),
      }))
      .digest("hex");
    const existing = await this.orders.getOrderById(id);
    if (existing) {
      const cart = await this.carts.getCartById(existing.cartId);
      // Older local snapshots did not store a request hash. Compare every
      // request field recoverable from their immutable order instead.
      const legacyMatches =
        existing.cartId === input.cartId &&
        (existing.customerName ?? "").trim() === input.customerName.trim() &&
        (existing.phone ?? "").trim() === input.phone.trim() &&
        existing.fulfillment === input.fulfillment &&
        (typeof existing.shippingAddress?.address === "string" ? existing.shippingAddress.address.trim() : "") ===
          (input.fulfillment === "delivery" ? input.address?.trim() ?? "" : "") &&
        (existing.note?.trim() ?? "") === (input.note?.trim() ?? "") &&
        existing.total === input.expectedTotal &&
        (input.shopRevision === undefined || existing.store?.revision === input.shopRevision) &&
        (existing.promotion?.code ?? "") === (input.promotionCode?.trim().toUpperCase() ?? "") &&
        (existing.promotion?.revision ?? "") === (input.promotionRevision ?? "");
      if (existing.userId !== userId ||
          (cart?.checkoutRequestHash ? cart.checkoutRequestHash !== requestHash : !legacyMatches))
        throw new DomainError(
          "IDEMPOTENCY_CONFLICT",
          "Mã yêu cầu đã được dùng với thông tin khác. Hãy kiểm tra lịch sử đơn hàng trước khi đặt tiếp.",
          409,
        );
      return existing;
    }
    const view = await this.carts.getCartView(userId);
    if (!view?.items.length)
      throw new CartDomainError("EMPTY_CART", "Giỏ hàng đang trống.");
    if (input.cartId !== view.cart.id || input.cartSignature !== view.signature)
      throw new CartDomainError(
        "CART_CHANGED",
        "Giỏ hàng đã thay đổi. Vui lòng tải lại giỏ trước khi đặt đơn.",
      );
    if (view.items.length > 50)
      throw new CartDomainError("CART_LIMIT", "Giỏ hàng tối đa 50 món.");
    const now = new Date().toISOString();
    const items: OrderItem[] = [];
    for (const line of view.items) {
      const item = await this.menu.getMenuItemById(line.menuItemId);
      if (!item?.isActive || !item.isAvailable)
        throw new CartDomainError(
          "ITEM_UNAVAILABLE",
          `${line.nameSnapshot} hiện không có sẵn.`,
        );
      if (
        line.quantity < 1 ||
        line.quantity > 100 ||
        !Number.isInteger(line.quantity)
      )
        throw new CartDomainError("INVALID_QUANTITY", "Số lượng không hợp lệ.");
      if (Object.keys(line.options ?? {}).length)
        throw new CartDomainError(
          "INVALID_OPTIONS",
          "Vui lòng chọn món tiêu chuẩn.",
        );
      items.push({
        id: randomUUID(),
        orderId: id,
        menuItemId: item.id,
        nameSnapshot: item.name,
        unitPrice: item.price,
        quantity: line.quantity,
        subtotal: item.price * line.quantity,
        createdAt: now,
        updatedAt: now,
      });
    }
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    const shop = await this.shop?.checkoutTerms(input.fulfillment, subtotal, input.shopRevision);
    const deliveryFee = input.fulfillment === "delivery" ? shop?.deliveryFee ?? DELIVERY_FEE : 0;
    const promotion =
      input.promotionCode && this.promotions
        ? await this.promotions.evaluate(input.promotionCode, subtotal)
        : undefined;
    if (
      input.promotionCode &&
      (!promotion || promotion.revision !== input.promotionRevision)
    )
      throw new CartDomainError(
        "PROMOTION_CHANGED",
        "Mã giảm giá đã thay đổi. Vui lòng áp dụng lại và kiểm tra tổng tiền.",
      );
    const discount = promotion?.discount ?? 0;
    const total = subtotal - discount + deliveryFee;
    if (input.expectedTotal !== total)
      throw new CartDomainError(
        "PRICE_CHANGED",
        "Giá giỏ hàng đã thay đổi. Vui lòng xem lại và xác nhận tổng tiền mới.",
      );
    const order: Order = {
      id,
      userId,
      cartId: view.cart.id,
      status: "CONFIRMED",
      subtotal,
      discount,
      ...(promotion ? { promotion } : {}),
      deliveryFee,
      total,
      currency: "VND",
      ...(shop ? { store: { name: shop.name, address: shop.address, phone: shop.phone, revision: shop.revision } } : {}),
      customerName: input.customerName,
      phone: input.phone,
      fulfillment: input.fulfillment,
      note: input.note,
      shippingAddress:
        input.fulfillment === "delivery"
          ? { address: input.address }
          : undefined,
      paymentMethod: "COD",
      createdAt: now,
      updatedAt: now,
    };
    const event: OrderEvent = {
      id: randomUUID(),
      orderId: id,
      type: "CONFIRMED",
      metadata: { actor: "customer" },
      createdAt: now,
    };
    await this.shop?.checkoutTerms(input.fulfillment, subtotal, input.shopRevision);
    if (promotion && this.promotions) {
      const currentPromotion = await this.promotions.evaluate(promotion.code, subtotal);
      if (
        currentPromotion.revision !== promotion.revision ||
        currentPromotion.discount !== discount
      )
        throw new DomainError(
          "PROMOTION_CHANGED",
          "Mã giảm giá đã thay đổi. Vui lòng áp dụng lại và xác nhận tổng tiền.",
          409,
        );
    }
    await this.orders.completeCheckout(order, items, event, {
      ...view.cart,
      status: "CHECKED_OUT",
      checkoutRequestHash: requestHash,
      updatedAt: now,
    });
    return order;
  }
  async cancel(userId: string, id: string): Promise<Order> {
    const order = await this.orders.getOrderById(id);
    if (!order || order.userId !== userId)
      throw new CartDomainError("ORDER_NOT_FOUND", "Không tìm thấy đơn hàng.");
    if (order.status === "CANCELLED") return order;
    if (order.status !== "CONFIRMED")
      throw new CartDomainError("ORDER_LOCKED", "Đơn hàng này không thể huỷ.");
    const now = new Date().toISOString();
    const cancelled: Order = { ...order, status: "CANCELLED", updatedAt: now };
    await this.orders.cancelOrder(cancelled, {
      id: randomUUID(),
      orderId: id,
      type: "CANCELLED",
      metadata: { actor: "customer", previousStatus: order.status },
      createdAt: now,
    });
    return cancelled;
  }
  async detail(userId: string, id: string) {
    const order = await this.orders.getOrderById(id);
    if (!order || order.userId !== userId) return null;
    return {
      ...order,
      items: await this.orders.getOrderItems(id),
      events: await this.orders.getOrderEvents(id),
    };
  }
}
