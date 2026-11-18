import type { MenuCategory, MenuItem } from "@/lib/types/menu";
import type { CartItem } from "@/lib/types/cart";
import { rankMenuCandidates } from "./understanding/menu-resolver";
import { parsePriceConstraint } from "./understanding/vietnamese-input";

const LIMIT = 12;

/**
 * Builds the grounded menu context for the model.
 *
 * `menu` may contain sold-out items (isActive && !isAvailable): they are never
 * offered as candidates, but a sold-out item the customer clearly asked for is
 * reported in `soldOut` so the model can say so instead of guessing.
 *
 * Candidates are padded to a stable size with the cheapest available items;
 * `matched` distinguishes real matches from padding, and `noMatch` /
 * `unknownTerms` tell the model when the request matched nothing.
 */
export function catalogContext(
  message: string,
  menu: MenuItem[],
  cart: CartItem[],
  categories: Pick<MenuCategory, "id" | "name">[] = [],
): string {
  const categoryName = new Map(categories.map((category) => [category.id, category.name]));
  const catalog = menu.map((item) => ({ ...item, categoryName: categoryName.get(item.categoryId) }));
  const available = catalog.filter((item) => item.isActive && item.isAvailable);
  const ranked = rankMenuCandidates(message, catalog, LIMIT);
  const matchedIds = new Set(ranked.items.map((item) => item.id));
  const padding = available
    .filter((item) => !matchedIds.has(item.id))
    .sort((a, b) => a.price - b.price || a.id.localeCompare(b.id))
    .slice(0, Math.max(0, LIMIT - ranked.items.length));
  const budget = parsePriceConstraint(message);

  // Only public menu fields and cart quantities enter model context.
  const data = {
    candidates: [
      ...ranked.items.map((item) => ({ id: item.id, name: item.name, priceVnd: item.price, matched: true })),
      ...padding.map((item) => ({ id: item.id, name: item.name, priceVnd: item.price, matched: false })),
    ],
    noMatch: ranked.noMatch,
    unknownTerms: ranked.unknownTokens,
    soldOut: ranked.soldOut.map((item) => ({ id: item.id, name: item.name })),
    ...(Object.keys(budget).length ? { budgetHint: budget } : {}),
    cart: cart
      .slice(0, LIMIT)
      .map((line) => ({
        itemId: line.menuItemId,
        name: line.nameSnapshot,
        quantity: line.quantity,
        unitPriceVnd: line.unitPrice,
      })),
    totalCartLines: cart.length,
    totalAvailableProducts: available.length,
  };
  return `CATALOG_CONTEXT_JSON:${JSON.stringify(data)}`;
}
