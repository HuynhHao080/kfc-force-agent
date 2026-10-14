import { z } from "zod";

export const chatRequestSchema = z.object({
  platform: z.string().min(1).max(32),
  userId: z.string().min(1).max(128),
  sessionId: z.string().min(1).max(128),
  message: z.string().min(1).max(1000),
  /**
   * Explicit confirmation of the previously proposed mutation.
   * Strict boolean on purpose: confirmation is never inferred from the
   * message text or from an identifier.
   */
  confirm: z.boolean().optional(),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
