import { z } from "zod";

export const createOrderSchema = z.object({
  userId: z.string().min(1),
  cartId: z.string().min(1),
  shippingAddress: z.record(z.string(), z.unknown()).optional(),
});

export type CreateOrder = z.infer<typeof createOrderSchema>;
