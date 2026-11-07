import { randomUUID } from "node:crypto";
import type { MenuCategory, MenuItem } from "@/lib/types/menu";
import type {
  CatalogAuditEntry,
  CatalogAuditValue,
} from "@/lib/types/catalog-audit";
const value = (entry: unknown): CatalogAuditValue =>
  typeof entry === "string" ||
  typeof entry === "number" ||
  typeof entry === "boolean"
    ? entry
    : null;
/** Only catalog fields enter the log. Never capture request bodies or accounts. */
export function catalogAudit(
  kind: "menu" | "category",
  current: MenuItem | MenuCategory,
  previous: MenuItem | MenuCategory | null,
): CatalogAuditEntry {
  const fields =
    kind === "menu"
      ? [
          "name",
          "description",
          "price",
          "categoryId",
          "imageUrl",
          "isActive",
          "isAvailable",
        ]
      : ["name", "description", "displayOrder", "isActive"];
  const before = previous as unknown as Record<string, unknown> | null;
  const after = current as unknown as Record<string, unknown>;
  return {
    id: randomUUID(),
    actor: "admin",
    action:
      kind === "menu"
        ? previous
          ? "MENU_UPDATED"
          : "MENU_CREATED"
        : previous
          ? "CATEGORY_UPDATED"
          : "CATEGORY_CREATED",
    entityId: current.id,
    entityName: current.name,
    createdAt: current.updatedAt,
    changes: fields
      .map((field) => ({
        field,
        before: value(before?.[field]),
        after: value(after[field]),
      }))
      .filter((change) => change.before !== change.after),
  };
}
