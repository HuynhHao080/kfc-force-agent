import { z } from "zod";
export const loginSchema = z.object({
  email: z.string().trim().email("Email không hợp lệ.").max(254),
  password: z.string().min(1, "Vui lòng nhập mật khẩu.").max(128),
});
export const registerSchema = loginSchema.extend({
  fullName: z.string().trim().min(2, "Họ tên ít nhất 2 ký tự.").max(100),
  password: z.string().min(10, "Mật khẩu ít nhất 10 ký tự.").max(128),
});
export const profileSchema = z
  .object({
    fullName: registerSchema.shape.fullName,
  })
  .strict();
export const passwordChangeSchema = z
  .object({
    currentPassword: loginSchema.shape.password,
    newPassword: registerSchema.shape.password,
    confirmPassword: z.string().min(1).max(128),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.newPassword !== input.confirmPassword)
      context.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "Mật khẩu xác nhận không khớp.",
      });
    if (input.newPassword === input.currentPassword)
      context.addIssue({
        code: "custom",
        path: ["newPassword"],
        message: "Mật khẩu mới phải khác mật khẩu hiện tại.",
      });
  });
