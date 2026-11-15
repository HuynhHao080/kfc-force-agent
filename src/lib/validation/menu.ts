import { z } from "zod";

export const menuQuerySchema = z.object({
  categoryId: z.string().max(100).optional(),
  q: z.string().max(200).optional(),
  itemId: z.string().max(100).optional(),
  bundleId: z.string().max(100).optional(),
  minPrice: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(0).max(5000000)).optional(),
  maxPrice: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(0).max(5000000)).optional(),
  sort: z.enum(["price_asc", "price_desc", "name"]).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
}).refine(value => value.minPrice === undefined || value.maxPrice === undefined || value.minPrice <= value.maxPrice, {
  message: "Giá tối thiểu phải nhỏ hơn hoặc bằng giá tối đa.",
  path: ["minPrice"],
});

export type MenuQuery = z.infer<typeof menuQuerySchema>;

export const menuSearchOptionsSchema = z.object({
  categoryId: z.string().min(1).max(100).optional(),
  minPrice: z.number().int().min(0).max(5000000).optional(),
  maxPrice: z.number().int().min(0).max(5000000).optional(),
  sort: z.enum(["price_asc", "price_desc", "name"]).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export type MenuSearchOptions = z.infer<typeof menuSearchOptionsSchema>;
