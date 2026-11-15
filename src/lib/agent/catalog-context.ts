import { normalizeVietnamese } from "@/lib/services/menu-service";
import type { MenuItem } from "@/lib/types/menu";
import type { CartItem } from "@/lib/types/cart";

export function catalogContext(
  message: string,
  menu: MenuItem[],
  cart: CartItem[],
): string {
  const words = normalizeVietnamese(message)
    .split(" ")
    .filter((word) => word.length > 1);
  const ranked = menu
    .filter((item) => item.isActive && item.isAvailable)
    .map((item) => {
      const name = normalizeVietnamese(item.name);
      const tokens = new Set(name.split(" "));
      const score = words.reduce(
        (sum, word) => sum + Number(tokens.has(word)),
        0,
      );
      return { item, score };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.item.price - b.item.price ||
        a.item.id.localeCompare(b.item.id),
    );
  // Only public menu fields and cart quantities enter model context.
  const data = {
    candidates: ranked
      .slice(0, 12)
      .map(({ item }) => ({
        id: item.id,
        name: item.name,
        priceVnd: item.price,
      })),
    cart: cart
      .slice(0, 12)
      .map((line) => ({
        itemId: line.menuItemId,
        name: line.nameSnapshot,
        quantity: line.quantity,
        unitPriceVnd: line.unitPrice,
      })),
    totalCartLines: cart.length,
    totalAvailableProducts: ranked.length,
  };
  return `CATALOG_CONTEXT_JSON:${JSON.stringify(data)}`;
}
