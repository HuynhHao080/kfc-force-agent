import { z } from "zod";
export const previewReorderSchema = z
  .object({ orderId: z.string().min(1).max(100) })
  .strict();
export const confirmReorderSchema = z
  .object({
    confirmationToken: z.string().min(1).max(2048),
    confirm: z.literal(true),
  })
  .strict();
export const reorderTokenSchema = z
  .object({
    ownerId: z.string().min(1),
    orderId: z.string().min(1),
    operationId: z.string().uuid(),
    sourceSignature: z.string().length(64),
    menuSignature: z.string().length(64),
    baseCartId: z.string().nullable(),
    expires: z.number(),
  })
  .strict();
