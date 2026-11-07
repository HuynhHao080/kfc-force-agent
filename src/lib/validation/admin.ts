import { z } from "zod";
export const adminLoginSchema = z.object({
  password: z.string().min(1).max(128),
});
export const orderTransitionSchema = z.object({
  orderId: z.string().min(1).max(100),
  expectedStatus: z.enum([
    "CONFIRMED",
    "PREPARING",
    "READY",
    "DELIVERING",
    "COMPLETED",
    "CANCELLED",
  ]),
  nextStatus: z.enum([
    "PREPARING",
    "READY",
    "DELIVERING",
    "COMPLETED",
    "CANCELLED",
  ]),
  cancellationReason: z.string().trim().min(5, "Lý do huỷ cần ít nhất 5 ký tự.").max(300).optional(),
}).strict().superRefine((value, context) => {
  if (value.nextStatus === "CANCELLED" && !value.cancellationReason)
    context.addIssue({ code: "custom", path: ["cancellationReason"], message: "Vui lòng nhập lý do huỷ hiển thị cho khách." });
  if (value.nextStatus !== "CANCELLED" && value.cancellationReason !== undefined)
    context.addIssue({ code: "custom", path: ["cancellationReason"], message: "Chỉ nhập lý do khi huỷ đơn." });
});
export const adminMenuSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(400).default(""),
  categoryId: z.string().min(1).max(100),
  price: z.number().int().min(1000).max(5000000),
  isActive: z.boolean(),
  isAvailable: z.boolean(),
  imageUrl: z.enum([
    "/images/burger.svg",
    "/images/combo.svg",
    "/images/fried-chicken.svg",
    "/images/fries.svg",
    "/images/pepsi.svg",
    "/images/wings.svg",
  ]),
});
export const adminMenuUpdateSchema = adminMenuSchema.extend({
  itemId: z.string().min(1).max(100),
});
export const adminCategorySchema = z
  .object({
    name: z.string().trim().min(2, "Tên danh mục ít nhất 2 ký tự.").max(80),
    description: z.string().trim().max(240).default(""),
    displayOrder: z.number().int().min(0).max(999),
    isActive: z.boolean(),
  })
  .strict();
export const adminCategoryUpdateSchema = adminCategorySchema.extend({
  categoryId: z.string().min(1).max(100),
});
