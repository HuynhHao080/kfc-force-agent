import { z } from "zod";
export const shopRevisionSchema = z.union([z.literal("default"), z.string().uuid()]);
export const shopFieldsSchema = z.object({
  name: z.string().trim().min(2).max(100), address: z.string().trim().min(5).max(300),
  phone: z.string().trim().regex(/^(?:|(?:0|\+84)[0-9]{9})$/, "Số điện thoại cửa hàng chưa hợp lệ."),
  announcement: z.string().trim().max(300), acceptingOrders: z.boolean(), pickupEnabled: z.boolean(), deliveryEnabled: z.boolean(),
  deliveryFee: z.number().int().min(0).max(200000), minimumSubtotal: z.number().int().min(0).max(10000000), scheduleEnabled: z.boolean(),
  hours: z.array(z.object({ day: z.number().int().min(0).max(6), closed: z.boolean(),
    opensAt: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
    closesAt: z.string().regex(/^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/),
  }).strict()).length(7),
}).strict();
export const updateShopSchema = shopFieldsSchema.extend({ revision: shopRevisionSchema }).superRefine((value, ctx) => {
  if (new Set(value.hours.map(day => day.day)).size !== 7 || value.hours.some(day => day.opensAt >= day.closesAt))
    ctx.addIssue({ code: "custom", path: ["hours"], message: "Cần đủ 7 ngày, giờ mở trước giờ đóng trong cùng ngày; chưa hỗ trợ qua đêm." });
});
