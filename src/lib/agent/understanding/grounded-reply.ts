import type { MenuCategory, MenuItem } from "@/lib/types/menu";
import type { CartItem } from "@/lib/types/cart";
import { normalizeVietnamese } from "@/lib/menu-search";
import { resolveMenuMention, rankMenuCandidates } from "./menu-resolver";
import { expandShorthand } from "./vietnamese-input";

/**
 * Server-written replies for turns where the model proposed no action.
 *
 * The model's own text never reaches the customer (it could claim an order or
 * invent a price). Instead this composes a short answer from verified catalog
 * data only: names, prices and availability come from `menu`, never from the
 * model. Returns null when nothing grounded can be said; the caller then keeps
 * its generic clarification.
 */
const price = (value: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);

const NUMBER_WORDS = /\b(?:\d+|mot|hai|ba|bon|tu|nam|sau|bay|tam|chin|muoi|tram|chuc)\b/g;
const ORDER_OR_ASK = /\b(?:them|cho|lay|mua|dat|goi|order|add|muon|can|tim|xem|ban|co)\b/;
const NEGATION = /^(?:dung|khong|chua|thoi|khoi)\b/;
/** Competitor drinks customers often ask for; KFC VN serves PepsiCo drinks. */
const OTHER_DRINKS = new Set(["coca", "coke", "cocacola", "sprite", "fanta", "sting", "mirinda", "redbull", "number"]);
const MAX_OPTIONS = 6;

type Catalog = MenuItem & { categoryName?: string };

/** Original customer words whose folded form is in `folded` (for readable echoes). */
function originalWords(message: string, folded: string[]): string {
  const wanted = new Set(folded);
  return message
    .normalize("NFC")
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((word) => word && wanted.has(normalizeVietnamese(word)))
    .join(" ");
}

function list(items: { name: string; price: number }[]): string {
  return items.slice(0, MAX_OPTIONS).map((item) => `${item.name} (${price(item.price)})`).join(", ");
}

export function groundedReply(
  message: string,
  menu: MenuItem[],
  categories: Pick<MenuCategory, "id" | "name">[],
  cart: CartItem[],
): string | null {
  const text = expandShorthand(message);
  if (NEGATION.test(text)) {
    // "đừng thêm…" keeps the cart; "không lấy … nữa" is a removal the model must handle.
    return /\bnua\b/.test(text) ? null : "Mình giữ nguyên giỏ hàng nhé.";
  }
  if (/\bgio(?: hang)?\b/.test(text)) {
    if (cart.length === 0) return "Giỏ hàng của bạn đang trống. Bạn muốn tìm món gì?";
    // A question about the cart ("giỏ còn gì", "giỏ bao nhiêu tiền"), not an edit:
    // answer from the stored cart lines, never from the model.
    if (!/\b(?:them|xoa|bo|doi|sua|huy|tang|giam|clear)\b/.test(text)) {
      const lines = cart.map((line) => `${line.quantity} × ${line.nameSnapshot}: ${price(line.unitPrice * line.quantity)}`);
      const total = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
      return `Giỏ hàng hiện tại của bạn:\n${lines.join("\n")}\nTổng cộng: ${price(total)}`;
    }
  }

  const names = new Map(categories.map((category) => [category.id, category.name]));
  const catalog: Catalog[] = menu.map((item) => ({ ...item, categoryName: names.get(item.categoryId) }));
  const mention = text.replace(NUMBER_WORDS, " ").replace(/\s+/g, " ").trim();
  if (!mention) return null;
  const result = resolveMenuMention(mention, catalog);
  const quantity = message.match(/\b(\d{1,3})\b/)?.[1];

  if (result.status === "unavailable")
    return `${result.unavailable.map((item) => item.name).join(", ")} hiện đang tạm hết. Bạn có muốn chọn món khác không?`;

  if (result.status === "resolved") {
    const item = result.items[0];
    return `Có phải bạn muốn ${item.name} (${price(item.price)})? Bạn hãy nói “Thêm ${quantity ?? 1} ${item.name}” để mình chuẩn bị đề xuất cho bạn xác nhận.`;
  }

  if (result.status === "ambiguous") {
    const more = result.items.length > MAX_OPTIONS ? ` và ${result.items.length - MAX_OPTIONS} món khác` : "";
    return `Có nhiều lựa chọn phù hợp: ${list(result.items)}${more}. Bạn muốn chọn loại nào?`;
  }

  // not_found: only answer when the customer is clearly asking for a product.
  if (!result.unknownTokens.length || !ORDER_OR_ASK.test(text)) return null;
  if (result.unknownTokens.some((token) => OTHER_DRINKS.has(token))) {
    const missing = originalWords(message, result.unknownTokens.filter((token) => OTHER_DRINKS.has(token)));
    const drinks = catalog.filter((item) => item.isActive && item.isAvailable && /^(?:Pepsi|7Up|Lipton) \(Vừa\)$/u.test(item.name.normalize("NFC")));
    return `Thực đơn KFC hiện không có “${missing}”.${drinks.length ? ` Bạn có thể chọn ${list(drinks)}.` : ""}`;
  }
  // One unknown word next to known ones ("cánh gà"): name it and suggest the
  // known part. Several unknown words ("trà sữa trân châu") is a product KFC
  // does not sell at all; suggestions from fuzzy leftovers would mislead.
  if (result.unknownTokens.length === 1) {
    const missing = originalWords(message, result.unknownTokens) || result.unknownTokens[0];
    const related = rankMenuCandidates(mention, catalog, 3).items;
    return `Thực đơn KFC hiện không có “${missing}”.${related.length ? ` Bạn có thể tham khảo: ${list(related)}.` : ""}`;
  }
  return "Thực đơn KFC hiện không có món này. Bạn có thể nói tên món khác hoặc xem thực đơn.";
}
