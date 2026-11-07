import type { Order, OrderItem } from "./types/order";
import { kitchenStatuses, type KitchenBoard, type KitchenCard } from "./types/kitchen";

export function buildKitchenBoard(
  rows: { order: Order; items: OrderItem[] }[],
  fulfillment: KitchenBoard["fulfillment"] = "all",
) {
  const cards: KitchenCard[] = [];
  let matchedActiveOrders = 0, excludedActiveOrders = 0;
  for (const { order, items } of rows) {
    if (!kitchenStatuses.some(status => status === order.status) ||
        (fulfillment !== "all" && order.fulfillment !== fulfillment)) continue;
    matchedActiveOrders++;
    if (typeof order.id !== "string" || !order.id || order.id.length > 128 ||
        !["pickup", "delivery"].includes(order.fulfillment ?? "") ||
        typeof order.createdAt !== "string" || typeof order.updatedAt !== "string" ||
        !Number.isFinite(Date.parse(order.createdAt)) || !Number.isFinite(Date.parse(order.updatedAt)) ||
        (order.status === "READY" && order.fulfillment !== "pickup") ||
        (order.status === "DELIVERING" && order.fulfillment !== "delivery") ||
        items.length < 1 || items.length > 50 ||
        new Set(items.map(item => item.menuItemId)).size !== items.length ||
        items.some(item => item.orderId !== order.id || typeof item.menuItemId !== "string" || !item.menuItemId || item.menuItemId.length > 128 ||
          typeof item.nameSnapshot !== "string" || !item.nameSnapshot.trim() || item.nameSnapshot.length > 100 ||
          !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 100 ||
          Object.keys(item.options ?? {}).length > 0)) {
      excludedActiveOrders++;
      continue;
    }
    cards.push({
      id: order.id,
      status: order.status as KitchenCard["status"],
      fulfillment: order.fulfillment as KitchenCard["fulfillment"],
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      note: typeof order.note === "string" ? order.note.slice(0, 300) : "",
      items: items.map(item => ({ menuItemId: item.menuItemId, name: item.nameSnapshot, quantity: item.quantity })),
    });
  }
  cards.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id));
  const counts: KitchenBoard["counts"] = { CONFIRMED: 0, PREPARING: 0, READY: 0, DELIVERING: 0 };
  const grouped = new Map<string, KitchenBoard["preparation"][number]>();
  for (const card of cards) {
    counts[card.status]++;
    if (card.status !== "CONFIRMED" && card.status !== "PREPARING") continue;
    for (const item of card.items) {
      const row = grouped.get(item.menuItemId) ?? { menuItemId: item.menuItemId, name: item.name, waiting: 0, preparing: 0, total: 0 };
      // Ascending cards make the most recent immutable name the summary label.
      row.name = item.name;
      if (card.status === "CONFIRMED") row.waiting += item.quantity;
      else row.preparing += item.quantity;
      row.total += item.quantity;
      grouped.set(item.menuItemId, row);
    }
  }
  return { cards, counts, matchedActiveOrders, excludedActiveOrders,
    preparation: [...grouped.values()].sort((a, b) => b.total - a.total || a.menuItemId.localeCompare(b.menuItemId)) };
}
