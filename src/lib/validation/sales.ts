import { z } from "zod";
export const salesFiltersSchema = z
  .object({
    status: z
      .enum([
        "all",
        "PENDING",
        "CONFIRMED",
        "SUBMITTED",
        "PREPARING",
        "READY",
        "DELIVERING",
        "COMPLETED",
        "CANCELLED",
      ])
      .default("all"),
    fulfillment: z.enum(["all", "pickup", "delivery"]).default("all"),
    search: z.string().trim().max(100).default(""),
    from: z.string().max(10).default(""),
    to: z.string().max(10).default(""),
  })
  .strict();
