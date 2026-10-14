import { z } from "zod";

export const menuQuerySchema = z.object({
  categoryId: z.string().optional(),
  q: z.string().optional(),
  itemId: z.string().optional(),
  bundleId: z.string().optional(),
});

export type MenuQuery = z.infer<typeof menuQuerySchema>;
