import { z } from "zod";

export const chatRequestSchema = z.object({
  platform: z.string().min(1),
  userId: z.string().min(1),
  sessionId: z.string().min(1),
  message: z.string().min(1).max(1000),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
