import type { Order, OrderItem } from "./types/order";
import type { ProductSales, SalesReport } from "./types/sales";
type SalesRow = { order: Order; items: OrderItem[] };
const money = (n: number) => Number.isSafeInteger(n) && n >= 0;
export function aggregateSales(rows: SalesRow[]) {
  const products = new Map<string, ProductSales>();
  let completedOrders = 0,
    excludedOrders = 0,
    units = 0,
    gross = 0,
    discount = 0,
    deliveryFee = 0,
    net = 0;
  // Latest completed snapshot supplies the display name; menu edits never rewrite sales.
  const sorted = [...rows].sort(
    (a, b) =>
      a.order.createdAt.localeCompare(b.order.createdAt) ||
      a.order.id.localeCompare(b.order.id),
  );
  for (const { order, items } of sorted) {
    if (order.status !== "COMPLETED") continue;
    const valid =
      order.currency === "VND" &&
      [order.subtotal, order.discount, order.deliveryFee, order.total].every(
        money,
      ) &&
      order.discount <= order.subtotal &&
      order.total === order.subtotal - order.discount + order.deliveryFee &&
      items.length > 0 &&
      items.length <= 50 &&
      items.every(
        (item) =>
          item.orderId === order.id &&
          typeof item.menuItemId === "string" &&
          !!item.menuItemId &&
          typeof item.nameSnapshot === "string" &&
          !!item.nameSnapshot &&
          money(item.unitPrice) &&
          Number.isInteger(item.quantity) &&
          item.quantity >= 1 &&
          item.quantity <= 100 &&
          money(item.subtotal) &&
          item.subtotal === item.unitPrice * item.quantity,
      ) &&
      items.reduce((sum, item) => sum + item.subtotal, 0) === order.subtotal;
    if (!valid) {
      excludedOrders++;
      continue;
    }
    completedOrders++;
    gross += order.subtotal;
    discount += order.discount;
    deliveryFee += order.deliveryFee;
    net += order.total;
    const counted = new Set<string>();
    for (const item of items) {
      const product = products.get(item.menuItemId) ?? {
        menuItemId: item.menuItemId,
        name: item.nameSnapshot,
        units: 0,
        orderCount: 0,
        gross: 0,
      };
      product.name = item.nameSnapshot;
      product.units += item.quantity;
      product.gross += item.subtotal;
      if (!counted.has(item.menuItemId)) {
        product.orderCount++;
        counted.add(item.menuItemId);
      }
      products.set(item.menuItemId, product);
      units += item.quantity;
    }
  }
  return {
    completedOrders,
    excludedOrders,
    units,
    gross,
    discount,
    deliveryFee,
    net,
    topLimit: 10,
    products: [...products.values()]
      .sort(
        (a, b) =>
          b.units - a.units ||
          b.gross - a.gross ||
          a.menuItemId.localeCompare(b.menuItemId),
      )
      .slice(0, 10),
  };
}
function textCell(value: string) {
  const clean = value.replace(/[\p{Cc}\p{Cf}]/gu, " ");
  return /^[\s\uFEFF]*[=+@-]/u.test(clean) ? "'" + clean : clean;
}
/** Product data only. Never export order contacts, notes, raw filters or coupon titles. */
export function productSalesCsv(report: SalesReport) {
  const rows = [
    [
      "menu_item_id",
      "snapshot_name",
      "units",
      "completed_order_count",
      "gross_before_discount_vnd",
      "source_sample_limit",
      "sampled_orders",
      "valid_completed_orders",
      "excluded_orders",
      "generated_at",
      "source_revision",
    ],
    ...report.products.map((p) => [
      textCell(p.menuItemId),
      textCell(p.name),
      String(p.units),
      String(p.orderCount),
      String(p.gross),
      String(report.sampleLimit),
      String(report.sampledOrders),
      String(report.completedOrders),
      String(report.excludedOrders),
      report.generatedAt,
      report.basisRevision,
    ]),
  ];
  return (
    "\ufeff" +
    rows
      .map((row) =>
        row.map((cell) => '"' + cell.replace(/"/g, '""') + '"').join(","),
      )
      .join("\r\n")
  );
}
