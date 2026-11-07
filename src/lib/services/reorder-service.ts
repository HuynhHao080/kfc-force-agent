import { createHash, randomUUID } from "node:crypto";
import type { CartRepository } from "@/lib/db/repositories/interfaces/cart-repository.interface";
import type { OrderRepository } from "@/lib/db/repositories/interfaces/order-repository.interface";
import type { Cart, CartItem } from "@/lib/types/cart";
import type { ReorderLine, ReorderPreview } from "@/lib/types/reorder";
import { DomainError } from "@/lib/domain-error";
import { issueToken, readToken } from "@/lib/server/session-token";
import { reorderTokenSchema } from "@/lib/validation/reorder";
import type { CartService } from "./cart-service";
import type { MenuService } from "./menu-service";
const digest = (data: unknown) =>
  createHash("sha256").update(JSON.stringify(data)).digest("hex");
export class ReorderService {
  constructor(
    private orders: OrderRepository,
    private cartRepository: CartRepository,
    private carts: CartService,
    private menu: MenuService,
  ) {}
  private async resolve(userId: string, orderId: string) {
    const order = await this.orders.getOrderById(orderId);
    if (!order || order.userId !== userId)
      throw new DomainError("ORDER_NOT_FOUND", "Không tìm thấy đơn hàng.", 404);
    const saved = await this.orders.getOrderItems(orderId);
    if (!saved.length || saved.length > 50)
      throw new DomainError(
        "REORDER_INVALID",
        "Đơn cũ không có danh sách món phù hợp để đặt lại.",
        409,
      );
    const items: ReorderLine[] = [];
    const seen = new Set<string>();
    for (const line of saved) {
      if (
        !Number.isInteger(line.quantity) ||
        line.quantity < 1 ||
        line.quantity > 100 ||
        Object.keys(line.options ?? {}).length ||
        seen.has(line.menuItemId)
      )
        throw new DomainError(
          "REORDER_INVALID",
          "Đơn có tuỳ chọn, dòng trùng hoặc số lượng chưa hỗ trợ. Hãy chọn món từ thực đơn.",
          409,
        );
      seen.add(line.menuItemId);
      const item = await this.menu.getMenuItemById(line.menuItemId);
      if (!item?.isActive || !item.isAvailable)
        throw new DomainError(
          "REORDER_UNAVAILABLE",
          line.nameSnapshot +
            " hiện không có sẵn. Giỏ hàng chưa được thêm món.",
          409,
        );
      items.push({
        menuItemId: item.id,
        name: item.name,
        quantity: line.quantity,
        unitPrice: item.price,
        previousUnitPrice: line.unitPrice,
        previousName: line.nameSnapshot,
        subtotal: item.price * line.quantity,
      });
    }
    const sourceSignature = digest(
      saved
        .map((line) => [
          line.id,
          line.menuItemId,
          line.nameSnapshot,
          line.unitPrice,
          line.quantity,
          line.options ?? {},
        ])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    );
    const menuSignature = digest(
      items
        .map((line) => [
          line.menuItemId,
          line.name,
          line.unitPrice,
          line.quantity,
        ])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    );
    return { items, sourceSignature, menuSignature };
  }
  private async emptyCart(userId: string) {
    const view = await this.carts.getCartView(userId);
    if (view?.items.length)
      throw new DomainError(
        "REORDER_CART_NOT_EMPTY",
        "Giỏ đang có món. Hãy hoàn tất hoặc tự xoá món trong giỏ trước khi đặt lại.",
        409,
      );
    return view?.cart ?? null;
  }
  async preview(userId: string, orderId: string): Promise<ReorderPreview> {
    const resolved = await this.resolve(userId, orderId);
    const cart = await this.emptyCart(userId);
    const confirmationToken = issueToken(
      "reorder",
      {
        ownerId: userId,
        orderId,
        operationId: randomUUID(),
        sourceSignature: resolved.sourceSignature,
        menuSignature: resolved.menuSignature,
        baseCartId: cart?.id ?? null,
      },
      900,
    );
    const token = readToken("reorder", confirmationToken)!;
    return {
      orderId,
      items: resolved.items,
      subtotal: resolved.items.reduce((sum, line) => sum + line.subtotal, 0),
      confirmationToken,
      expiresAt: new Date(token.expires as number).toISOString(),
    };
  }
  private async replay(userId: string, cartId: string) {
    const cart = await this.cartRepository.getCartById(cartId);
    if (!cart) return null;
    const active = await this.cartRepository.getActiveCart(userId);
    if (
      cart.userId !== userId ||
      cart.status !== "ACTIVE" ||
      active?.id !== cartId
    )
      throw new DomainError(
        "REORDER_ALREADY_USED",
        "Lần đặt lại này đã kết thúc. Hãy xem giỏ hoặc lịch sử, rồi tạo bản xem trước mới nếu cần.",
        409,
      );
    return this.carts.getCartView(userId);
  }
  async confirm(userId: string, confirmationToken: string) {
    const parsed = reorderTokenSchema.safeParse(
      readToken("reorder", confirmationToken),
    );
    if (!parsed.success || parsed.data.ownerId !== userId)
      throw new DomainError(
        "REORDER_EXPIRED",
        "Bản xem trước không hợp lệ hoặc đã hết hạn. Hãy xem lại giỏ và tạo bản xem trước mới.",
        409,
      );
    const token = parsed.data;
    const cartId =
      "cart_reorder_" + digest([userId, token.operationId]).slice(0, 32);
    const existing = await this.replay(userId, cartId);
    if (existing) return { ...existing, replayed: true };
    const cart = await this.emptyCart(userId);
    if ((cart?.id ?? null) !== token.baseCartId)
      throw new DomainError(
        "REORDER_CHANGED",
        "Giỏ đã thay đổi. Hãy tạo bản xem trước mới.",
        409,
      );
    const resolved = await this.resolve(userId, token.orderId);
    if (
      resolved.sourceSignature !== token.sourceSignature ||
      resolved.menuSignature !== token.menuSignature
    )
      throw new DomainError(
        "REORDER_CHANGED",
        "Món hoặc giá đã thay đổi. Hãy xem lại bản đặt lại mới trước khi xác nhận.",
        409,
      );
    const now = new Date().toISOString();
    const subtotal = resolved.items.reduce(
      (sum, line) => sum + line.subtotal,
      0,
    );
    const next: Cart = {
      id: cartId,
      userId,
      status: "ACTIVE",
      subtotal,
      discount: 0,
      deliveryFee: 0,
      total: subtotal,
      createdAt: now,
      updatedAt: now,
      reorderOperationId: token.operationId,
      sourceOrderId: token.orderId,
    };
    const items: CartItem[] = resolved.items.map((line) => ({
      id: randomUUID(),
      cartId,
      menuItemId: line.menuItemId,
      nameSnapshot: line.name,
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      subtotal: line.subtotal,
      createdAt: now,
      updatedAt: now,
    }));
    try {
      await this.cartRepository.completeReorder(next, items, token.baseCartId);
    } catch (error) {
      if (error instanceof DomainError && error.code === "REORDER_CHANGED") {
        const replay = await this.replay(userId, cartId);
        if (replay) return { ...replay, replayed: true };
      }
      throw error;
    }
    const result = await this.carts.getCartView(userId);
    if (!result)
      throw new DomainError(
        "REORDER_CHANGED",
        "Giỏ đã thay đổi. Hãy xem lại.",
        409,
      );
    return { ...result, replayed: false };
  }
}
