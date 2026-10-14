import { z } from "zod";

/** Upper bound for a single add-to-cart request. */
export const MAX_CART_QUANTITY = 100;

export const addCartItemSchema = z.object({
  userId: z.string().min(1),
  menuItemId: z.string().min(1),
  quantity: z.number().int().positive().max(MAX_CART_QUANTITY),
  /**
   * Option selections. Values are validated against the menu's option values
   * by the cart domain; prices are never accepted from the client.
   */
  options: z.record(z.string(), z.string()).optional(),
});

export type AddCartItem = z.infer<typeof addCartItemSchema>;

/**
 * Quantity updates address a line item inside the caller's own active cart.
 * `cartId` is intentionally absent: it is resolved from `userId` server-side,
 * so a client cannot target another customer's cart.
 */
export const updateCartItemSchema = z.object({
  userId: z.string().min(1),
  itemId: z.string().min(1),
  quantity: z.number().int().positive().max(MAX_CART_QUANTITY),
});

export type UpdateCartItem = z.infer<typeof updateCartItemSchema>;

