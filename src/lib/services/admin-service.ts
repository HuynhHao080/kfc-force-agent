import {
  summarizeOrders,
  filterOrders,
  type OrderFilters,
} from "@/lib/order-reporting";
import { aggregateSales } from "@/lib/sales-reporting";
import { orderWindowRevision } from "@/lib/server/order-window";
import { buildKitchenBoard } from "@/lib/kitchen-board";
import { kitchenStatuses, type KitchenBoard } from "@/lib/types/kitchen";
import { catalogAudit } from "./catalog-audit";
import { randomUUID } from "node:crypto";
import type { OrderRepository } from "@/lib/db/repositories/interfaces/order-repository.interface";
import type { IMenuRepository } from "@/lib/db/repositories/interfaces/menu-repository.interface";
import type { Order, OrderStatus } from "@/lib/types/order";
import type { MenuCategory, MenuItem } from "@/lib/types/menu";
import { DomainError } from "@/lib/domain-error";
import { nextOrderStatuses } from "@/lib/order-workflow";
import { normalizeVietnamese } from "./menu-service";
import type { z } from "zod";
import type {
  adminCategorySchema,
  adminMenuSchema,
} from "@/lib/validation/admin";
export class AdminService {
  constructor(
    private orders: OrderRepository,
    private menu: IMenuRepository,
  ) {}
  async kitchen(fulfillment: KitchenBoard["fulfillment"] = "all"): Promise<KitchenBoard> {
    const sampled = await this.orders.getRecentOrders(200);
    const active = sampled.filter(order => kitchenStatuses.some(status => status === order.status) &&
      (fulfillment === "all" || order.fulfillment === fulfillment));
    const rows: { order: Order; items: import("@/lib/types/order").OrderItem[] }[] = [];
    for (let start = 0; start < active.length; start += 8)
      rows.push(...await Promise.all(active.slice(start, start + 8).map(async order => ({
        order, items: await this.orders.getOrderItems(order.id),
      }))));
    return { generatedAt: new Date().toISOString(), sampleLimit: 200, sampledOrders: sampled.length,
      fulfillment, ...buildKitchenBoard(rows, fulfillment) };
  }
  async dashboard() {
    const orders = await this.orders.getRecentOrders(200);
    return {
      orders,
      stats: summarizeOrders(orders),
      revision: orderWindowRevision(orders),
    };
  }
  async sales(filters: OrderFilters, expectedRevision?: string) {
    const sampled = await this.orders.getRecentOrders(200);
    const basisRevision = orderWindowRevision(sampled);
    if (expectedRevision && expectedRevision !== basisRevision)
      throw new DomainError(
        "SALES_CHANGED",
        "Tập đơn đã thay đổi. Hãy làm mới dữ liệu quản trị rồi xem lại báo cáo món.",
        409,
      );
    const matched = filterOrders(sampled, filters),
      completed = matched.filter((order) => order.status === "COMPLETED");
    const rows: {
      order: Order;
      items: import("@/lib/types/order").OrderItem[];
    }[] = [];
    for (let start = 0; start < completed.length; start += 8) {
      rows.push(
        ...(await Promise.all(
          completed
            .slice(start, start + 8)
            .map(async (order) => ({
              order,
              items: await this.orders.getOrderItems(order.id),
            })),
        )),
      );
    }
    return {
      basisRevision,
      generatedAt: new Date().toISOString(),
      sampleLimit: 200,
      sampledOrders: sampled.length,
      matchedOrders: matched.length,
      ...aggregateSales(rows),
    };
  }
  async detail(id: string) {
    const order = await this.orders.getOrderById(id);
    if (!order)
      throw new DomainError("ORDER_NOT_FOUND", "Không tìm thấy đơn hàng.", 404);
    return {
      ...order,
      items: await this.orders.getOrderItems(id),
      events: await this.orders.getOrderEvents(id),
    };
  }
  async transition(
    id: string,
    expectedStatus: OrderStatus,
    nextStatus: OrderStatus,
    cancellationReason?: string,
  ) {
    const reason = cancellationReason?.trim();
    if (nextStatus === "CANCELLED" && (!reason || reason.length < 5 || reason.length > 300))
      throw new DomainError("CANCEL_REASON_REQUIRED", "Lý do huỷ hiển thị cho khách cần từ 5 đến 300 ký tự.");
    if (nextStatus !== "CANCELLED" && cancellationReason !== undefined)
      throw new DomainError("INVALID_REASON", "Chỉ nhập lý do khi huỷ đơn.");
    const order = await this.orders.getOrderById(id);
    if (!order)
      throw new DomainError("ORDER_NOT_FOUND", "Không tìm thấy đơn hàng.", 404);
    if (order.status === nextStatus) {
      if (nextStatus === "CANCELLED") {
        const event = (await this.orders.getOrderEvents(id)).find((entry) => entry.type === "CANCELLED");
        if (!event || event.metadata?.actor !== "admin" ||
            event.metadata.previousStatus !== expectedStatus || event.metadata.cancellationReason !== reason)
          throw new DomainError("ORDER_CONFLICT", "Đơn đã được huỷ với thông tin khác. Vui lòng tải lại.", 409);
      }
      return this.detail(id); // exact retry, no duplicate event
    }
    if (order.status !== expectedStatus)
      throw new DomainError(
        "ORDER_CONFLICT",
        "Đơn đã thay đổi. Vui lòng tải lại.",
        409,
      );
    if (!nextOrderStatuses(order).includes(nextStatus))
      throw new DomainError(
        "INVALID_TRANSITION",
        "Không được bỏ qua hoặc quay ngược bước xử lý đơn.",
        409,
      );
    const now = new Date().toISOString();
    const updated: Order = { ...order, status: nextStatus, updatedAt: now };
    await this.orders.transitionOrder(
      updated,
      {
        id: randomUUID(),
        orderId: id,
        type: nextStatus,
        metadata: {
          actor: "admin", previousStatus: expectedStatus,
          ...(nextStatus === "CANCELLED" ? { cancellationReason: reason } : {}),
        },
        createdAt: now,
      },
      expectedStatus,
    );
    return this.detail(id);
  }
  async catalog() {
    return {
      items: await this.menu.getMenuItems(),
      categories: await this.menu.getCategories(),
    };
  }
  catalogHistory() {
    return this.menu.getCatalogAudit(200);
  }
  async saveCategory(
    input: z.infer<typeof adminCategorySchema>,
    id?: string,
  ): Promise<MenuCategory> {
    const previous = id ? await this.menu.getCategoryById(id) : null;
    if (id && !previous)
      throw new DomainError(
        "CATEGORY_NOT_FOUND",
        "Không tìm thấy danh mục.",
        404,
      );
    const duplicate = (await this.menu.getCategories()).some(
      (category) =>
        category.id !== id &&
        normalizeVietnamese(category.name) === normalizeVietnamese(input.name),
    );
    if (duplicate)
      throw new DomainError(
        "DUPLICATE_CATEGORY",
        "Tên danh mục đã tồn tại.",
        409,
      );
    if (
      id &&
      !input.isActive &&
      (await this.menu.getItemsByCategory(id)).length
    )
      throw new DomainError(
        "CATEGORY_IN_USE",
        "Danh mục còn món. Hãy chuyển toàn bộ món sang danh mục khác trước khi tắt.",
        409,
      );
    const now = new Date().toISOString();
    const category: MenuCategory = {
      ...input,
      id: previous?.id ?? "cat_" + randomUUID(),
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    };
    const audit = catalogAudit("category", category, previous);
    if (previous && !audit.changes.length) return previous;
    await this.menu.saveCategory(category, audit);
    return category;
  }
  async saveMenu(
    input: z.infer<typeof adminMenuSchema>,
    id?: string,
  ): Promise<MenuItem> {
    const previous = id ? await this.menu.getMenuItemById(id) : null;
    if (id && !previous)
      throw new DomainError("ITEM_NOT_FOUND", "Không tìm thấy món.", 404);
    const category = await this.menu.getCategoryById(input.categoryId);
    if (!category?.isActive)
      throw new DomainError("CATEGORY_INVALID", "Danh mục không hợp lệ.");
    const duplicate = (await this.menu.getMenuItems()).some(
      (item) =>
        item.id !== id &&
        normalizeVietnamese(item.name) === normalizeVietnamese(input.name),
    );
    if (duplicate)
      throw new DomainError("DUPLICATE_ITEM", "Tên món đã tồn tại.", 409);
    const now = new Date().toISOString();
    const item: MenuItem = {
      ...previous,
      ...input,
      id: previous?.id ?? `menu_${randomUUID()}`,
      currency: "VND",
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    };
    const audit = catalogAudit("menu", item, previous);
    if (previous && !audit.changes.length) return previous;
    await this.menu.saveMenuItem(item, audit);
    return item;
  }
}
