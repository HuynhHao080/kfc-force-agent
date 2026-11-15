import type { Basket } from "./storefront-types";
import type { MenuItem } from "./types/menu";
import type { CartReview } from "./types/cart-review";

export function buildCartReview(
  basket: Basket,
  menu: MenuItem[],
  now = new Date(),
): CartReview {
  const products = new Map(menu.map((item) => [item.id, item]));
  return {
    basket,
    checkedAt: now.toISOString(),
    items: basket.items.map((line) => {
      const item = products.get(line.menuItemId);
      return {
        cartItemId: line.id,
        imageUrl: item?.imageUrl,
        available: !!item?.isActive && !!item.isAvailable,
      };
    }),
  };
}

export function shoppingListText(review: CartReview): string {
  const availability = new Map(
    review.items.map((item) => [item.cartItemId, item.available]),
  );
  const money = (value: number) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(value);
  return [
    "DANH SÁCH MÓN KFC",
    ...review.basket.items.map(
      (item) =>
        `${item.quantity} × ${item.nameSnapshot} — ${money(item.subtotal)}${availability.get(item.id) ? "" : " [Hiện không được niêm yết trên nguồn đã kiểm tra]"}`,
    ),
    `Tạm tính tham khảo: ${money(review.basket.cart?.total ?? 0)}`,
    "Giá, khuyến mãi và tình trạng món được KFC xác nhận khi đặt.",
    "https://kfcvietnam.com.vn/menu",
  ].join("\n");
}
