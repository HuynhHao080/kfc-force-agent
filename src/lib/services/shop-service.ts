import { randomUUID } from "node:crypto";
import type { IMenuRepository } from "@/lib/db/repositories/interfaces/menu-repository.interface";
import { defaultShopSettings, shopAvailability } from "@/lib/shop-settings";
import type { ShopView } from "@/lib/types/shop";
import { updateShopSchema } from "@/lib/validation/shop";
import type { z } from "zod";
import { DomainError } from "@/lib/domain-error";
import { withUserLock } from "@/lib/server/user-lock";
export const SHOP_ORDER_GATE = "__shop_order_gate__";
export class ShopService {
  constructor(private repository: IMenuRepository) {}
  async view(now = Date.now()): Promise<ShopView> {
    const stored = await this.repository.getShopSettings();
    if (stored) {
      const { updatedAt, ...fields } = stored;
      if (!updateShopSchema.safeParse(fields).success || !Number.isFinite(Date.parse(updatedAt)))
        throw new DomainError("SHOP_UNAVAILABLE", "Cấu hình cửa hàng chưa hợp lệ. Vui lòng liên hệ quản trị.", 503);
    }
    const settings = stored ?? defaultShopSettings();
    return { configured: !!stored, settings, availability: shopAvailability(settings, now) };
  }
  async save(input: z.infer<typeof updateShopSchema>, beforeSave?: () => Promise<void>) {
    const parsed = updateShopSchema.parse(input);
    return withUserLock(SHOP_ORDER_GATE, async () => {
      await beforeSave?.();
      const { revision, ...fields } = parsed;
      const settings = { ...fields, hours: [...fields.hours].sort((a, b) => a.day - b.day), revision: randomUUID(), updatedAt: new Date().toISOString() };
      await this.repository.saveShopSettings(settings, revision);
      return this.view();
    });
  }
  async checkoutTerms(fulfillment: "pickup" | "delivery", subtotal: number, revision?: string) {
    const view = await this.view();
    if ((view.configured || revision !== undefined) && revision !== view.settings.revision)
      throw new DomainError("SHOP_CHANGED", "Thông tin cửa hàng đã thay đổi. Hãy tải lại và xác nhận điều kiện mới.", 409);
    if (!(fulfillment === "pickup" ? view.availability.canPickup : view.availability.canDelivery))
      throw new DomainError("SHOP_CLOSED", view.availability.open ? "Hình thức nhận món này đang tạm tắt." : view.availability.message, 409);
    if (subtotal < view.settings.minimumSubtotal)
      throw new DomainError("MINIMUM_ORDER", "Tiền món tối thiểu là " + view.settings.minimumSubtotal.toLocaleString("vi-VN") + "đ.");
    return view.settings;
  }
}
