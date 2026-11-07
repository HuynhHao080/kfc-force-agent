import { z } from "zod";
import { shopRevisionSchema } from "./shop";
export const createOrderSchema = z
  .object({
    cartId: z.string().min(1).max(128),
    cartSignature: z.string().length(64),
    customerName: z.string().trim().min(2, "Vui lòng nhập họ tên.").max(100),
    phone: z
      .string()
      .trim()
      .regex(/^(?:0|\+84)[0-9]{9}$/, "Số điện thoại Việt Nam không hợp lệ."),
    fulfillment: z.enum(["pickup", "delivery"]),
    address: z.string().trim().max(300).default(""),
    note: z.string().trim().max(300).default(""),
    idempotencyKey: z.string().uuid(),
    expectedTotal: z.number().int().nonnegative(),
    promotionCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{3,24}$/)
      .optional(),
    promotionRevision: z.string().uuid().optional(),
    confirm: z.literal(true, { error: "Vui lòng xác nhận đơn hàng." }),
    shopRevision: shopRevisionSchema.optional(),
  })
  .refine((data) => !!data.promotionCode === !!data.promotionRevision, {
    message: "Vui lòng áp dụng mã giảm giá trước khi đặt đơn.",
    path: ["promotionCode"],
  })
  .refine(
    (data) => data.fulfillment !== "delivery" || data.address.length >= 10,
    {
      path: ["address"],
      message: "Vui lòng nhập địa chỉ giao hàng đầy đủ (ít nhất 10 ký tự).",
    },
  );
export type CreateOrder = z.infer<typeof createOrderSchema>;
