import { randomUUID } from "node:crypto";
import type { z } from "zod";
import type { createPromotionSchema } from "@/lib/validation/promotion";
import type { IMenuRepository } from "@/lib/db/repositories/interfaces/menu-repository.interface";
import type { AppliedPromotion, Promotion } from "@/lib/types/promotion";
import { DomainError } from "@/lib/domain-error";
export class PromotionService {
  constructor(private repository: IMenuRepository) {}
  async list() {
    return (await this.repository.getPromotions()).sort((a, b) =>
      a.code.localeCompare(b.code),
    );
  }
  async save(
    fields: z.infer<typeof createPromotionSchema>,
    revision?: string,
  ): Promise<Promotion> {
    const previous = await this.repository.getPromotion(fields.code);
    if (revision && (!previous || previous.revision !== revision))
      throw new DomainError(
        "PROMOTION_CHANGED",
        "Mã giảm giá đã thay đổi. Hãy làm mới danh sách trước khi lưu.",
        409,
      );
    if (!revision && previous)
      throw new DomainError("PROMOTION_EXISTS", "Mã giảm giá đã tồn tại.", 409);
    if (!previous && (await this.repository.getPromotions()).length >= 200)
      throw new DomainError(
        "PROMOTION_LIMIT",
        "Tối đa 200 mã giảm giá; có thể tắt mã cũ.",
      );
    const now = new Date().toISOString();
    const entry: Promotion = {
      ...fields,
      startsAt: new Date(fields.startsAt).toISOString(),
      endsAt: new Date(fields.endsAt).toISOString(),
      revision: randomUUID(),
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    };
    await this.repository.savePromotion(entry, revision);
    return entry;
  }
  async evaluate(
    code: string,
    subtotal: number,
    now = Date.now(),
  ): Promise<AppliedPromotion> {
    const entry = await this.repository.getPromotion(code.trim().toUpperCase());
    if (
      !entry ||
      !entry.isActive ||
      now < Date.parse(entry.startsAt) ||
      now >= Date.parse(entry.endsAt)
    )
      throw new DomainError(
        "PROMOTION_UNAVAILABLE",
        "Mã giảm giá không có sẵn hoặc ngoài thời gian áp dụng.",
      );
    if (subtotal < entry.minimumSubtotal)
      throw new DomainError(
        "PROMOTION_MINIMUM",
        "Giỏ chưa đạt giá trị tối thiểu " +
          entry.minimumSubtotal.toLocaleString("vi-VN") +
          "đ.",
      );
    let discount =
      entry.discountType === "percent"
        ? Math.floor((subtotal * entry.value) / 100)
        : entry.value;
    if (entry.discountType === "percent" && entry.maxDiscount > 0)
      discount = Math.min(discount, entry.maxDiscount);
    discount = Math.min(subtotal, discount);
    return {
      code: entry.code,
      title: entry.title,
      revision: entry.revision,
      discount,
    };
  }
}
