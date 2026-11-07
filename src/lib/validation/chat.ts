import { z } from "zod";

export const chatRequestSchema = z
  .object({
    platform: z.string().min(1).max(32),
    userId: z.string().min(1).max(128),
    sessionId: z.string().min(1).max(128),
    message: z
      .string()
      .trim()
      .min(1, "Vui lòng nhập tin nhắn.")
      .max(1000, "Tin nhắn tối đa 1000 ký tự."),
    /**
     * Explicit confirmation of the previously proposed mutation.
     * Strict boolean on purpose: confirmation is never inferred from the
     * message text or from an identifier.
     */
    confirm: z.boolean().optional(),
    confirmationId: z.string().uuid().optional(),
  })
  .refine((request) => !request.confirm || !!request.confirmationId, {
    path: ["confirmationId"],
    message: "Vui lòng xác nhận đúng đề xuất đang hiển thị.",
  });

export type ChatRequest = z.infer<typeof chatRequestSchema>;
