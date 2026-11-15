import { z } from "zod";
import { isKfcImage } from "@/lib/menu-images";
import type { MenuCategory, MenuItem } from "@/lib/types/menu";

const sourceUrl = z
  .string()
  .url()
  .max(1500)
  .refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "kfcvietnam.com.vn" &&
      !url.username &&
      !url.password &&
      !url.port
    );
  }, "Nguồn thực đơn phải thuộc website KFC Việt Nam.");
const identifier = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);

export const kfcExtractionSchema = z
  .object({
    categories: z
      .array(
        z
          .object({
            id: identifier,
            name: z.string().trim().min(2).max(80),
            displayOrder: z.number().int().min(0).max(999),
          })
          .strict(),
      )
      .min(1)
      .max(50),
    items: z
      .array(
        z
          .object({
            id: identifier,
            categoryId: identifier,
            name: z.string().trim().min(2).max(100),
            description: z.string().trim().max(400),
            price: z.number().int().min(1000).max(5000000),
            imageUrl: z
              .string()
              .max(2000)
              .refine(
                isKfcImage,
                "Ảnh phải là ảnh món trên miền KFC được hỗ trợ.",
              ),
            sourceUrl,
            isAvailable: z.boolean(),
          })
          .strict(),
      )
      .min(1)
      .max(500),
    exclusions: z.array(z.string().max(300)).max(500),
  })
  .strict()
  .superRefine((data, context) => {
    const categories = new Set(data.categories.map((category) => category.id));
    const items = new Set(data.items.map((item) => item.id));
    const names = new Set(
      data.items.map((item) =>
        item.name.normalize("NFC").toLocaleLowerCase("vi"),
      ),
    );
    if (
      categories.size !== data.categories.length ||
      items.size !== data.items.length ||
      names.size !== data.items.length
    )
      context.addIssue({
        code: "custom",
        message: "Mã danh mục, mã món và tên món phải duy nhất.",
      });
    if (data.items.some((item) => !categories.has(item.categoryId)))
      context.addIssue({
        code: "custom",
        message: "Món phải thuộc một danh mục đã thu thập.",
      });
  });

export const kfcCatalogSchema = z
  .object({
    version: z.literal(1),
    source: z
      .object({
        provider: z.literal("tinyfish"),
        method: z.enum(["agent", "fetch"]).optional(),
        url: sourceUrl,
        fetchedAt: z.string().datetime(),
        runId: z.string().min(1).max(100),
        rawSha256: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .strict(),
    catalog: kfcExtractionSchema,
  })
  .strict();

export function catalogRecords(input: unknown): {
  categories: MenuCategory[];
  items: MenuItem[];
} {
  const { source, catalog } = kfcCatalogSchema.parse(input);
  const timestamps = {
    createdAt: source.fetchedAt,
    updatedAt: source.fetchedAt,
  };
  return {
    categories: catalog.categories.map((category) => ({
      ...category,
      isActive: true,
      ...timestamps,
    })),
    items: catalog.items.map(({ sourceUrl, ...item }) => ({
      ...item,
      currency: "VND",
      isActive: true,
      metadata: {
        source: { ...source, url: sourceUrl, priceVnd: item.price },
        availabilityScope: "public-menu",
      },
      ...timestamps,
    })),
  };
}
