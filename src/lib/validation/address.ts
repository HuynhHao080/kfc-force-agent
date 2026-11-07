import { z } from "zod";
export const addressFieldsSchema = z
  .object({
    label: z.string().trim().min(2).max(50),
    recipientName: z.string().trim().min(2).max(100),
    phone: z
      .string()
      .trim()
      .regex(/^(?:0|\+84)[0-9]{9}$/, "Số điện thoại Việt Nam không hợp lệ."),
    addressLine: z
      .string()
      .trim()
      .min(10, "Địa chỉ ít nhất 10 ký tự.")
      .max(300),
    isDefault: z.boolean().default(false),
  })
  .strict();
const revision = z.string().regex(/^[a-f0-9]{64}$/);
export const createAddressSchema = addressFieldsSchema.extend({ revision });
export const updateAddressSchema = createAddressSchema.extend({
  addressId: z.string().min(1).max(100),
});
export const deleteAddressSchema = z
  .object({
    addressId: z.string().min(1).max(100),
    revision,
    confirm: z.literal(true),
  })
  .strict();
