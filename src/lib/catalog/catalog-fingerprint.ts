import { createHash } from "node:crypto";
import type { MenuCategory, MenuItem } from "@/lib/types/menu";

/** Exclude capture timestamps and provenance so unchanged pages need no store rewrite. */
export function catalogFingerprint(catalog: {
  categories: MenuCategory[];
  items: MenuItem[];
}): string {
  const categories = catalog.categories
    .filter((row) => row.isActive)
    .map((row) => [row.id, row.name, row.displayOrder]);
  const items = catalog.items
    .filter((row) => row.isActive)
    .map((row) => [
      row.id,
      row.categoryId,
      row.name,
      row.description,
      row.price,
      row.imageUrl,
      row.isAvailable,
    ]);
  return createHash("sha256")
    .update(JSON.stringify([categories, items]))
    .digest("hex");
}
