import { z } from "zod";
export const feedbackOrderId = z.string().min(1).max(100);
export const customerFeedbackSchema = z.object({
  orderId: feedbackOrderId, rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).default(""), revision: z.string().uuid().optional(),
}).strict();
export const feedbackReplySchema = z.object({
  orderId: feedbackOrderId, revision: z.string().uuid(), message: z.string().trim().min(5).max(1000),
}).strict();
export const feedbackFiltersSchema = z.object({
  rating: z.enum(["all", "1", "2", "3", "4", "5"]).default("all"),
  response: z.enum(["all", "pending", "replied"]).default("all"),
}).strict();
