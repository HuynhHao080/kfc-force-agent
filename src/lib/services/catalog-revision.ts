import { createHash } from "node:crypto";
import type { MenuCategory, MenuItem } from "@/lib/types/menu";

/** Content version for staff editors, derived from existing records. */
export function catalogRevision(entry: MenuItem | MenuCategory): string {
  const fields = "price" in entry
    ? ["menu", entry.categoryId, entry.price, entry.currency, entry.imageUrl ?? null, entry.isAvailable]
    : ["category", entry.displayOrder];
  return createHash("sha256").update(JSON.stringify([
    entry.id, entry.name, entry.description ?? null, entry.isActive,
    entry.createdAt, entry.updatedAt, fields,
  ])).digest("hex");
}
