import { z } from "zod";
import { shopRevisionSchema } from "./shop";
export const promotionCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9_-]{3,24}$/);
const fields = z
  .object({
    code: promotionCode,
    title: z.string().trim().min(2).max(100),
    discountType: z.enum(["percent", "fixed"]),
    value: z.number().int().min(1).max(1000000),
    minimumSubtotal: z.number().int().min(0).max(10000000),
    maxDiscount: z.number().int().min(0).max(1000000),
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }),
    isActive: z.boolean(),
  })
  .strict();
const valid = (v: z.infer<typeof fields>) =>
  Date.parse(v.startsAt) < Date.parse(v.endsAt) &&
  (v.discountType !== "percent" || v.value <= 100) &&
  (v.discountType !== "fixed" || v.maxDiscount === 0);
export const createPromotionSchema = fields.refine(
  valid,
  "Kiểm tra thời gian, phần trăm (1–100) và trần giảm (chỉ dùng cho %).",
);
export const updatePromotionSchema = fields
  .extend({ revision: z.string().uuid() })
  .refine(valid, "Điều kiện khuyến mãi không hợp lệ.");
export const checkoutQuoteSchema = z
  .object({
    shopRevision: shopRevisionSchema.optional(),
    cartId: z.string().min(1).max(128),
    cartSignature: z.string().length(64),
    fulfillment: z.enum(["pickup", "delivery"]),
    promotionCode: promotionCode,
  })
  .strict();
