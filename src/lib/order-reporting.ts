import type { Order } from "./types/order";
import type { AdminDashboard } from "./admin-types";

const vietnamDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export const orderDay = (date: string) => vietnamDay.format(new Date(date));
export interface OrderFilters {
  status: string;
  search: string;
  fulfillment: string;
  from: string;
  to: string;
}
const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
function validDay(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function invalidDateRange(
  filters: Pick<OrderFilters, "from" | "to">,
): boolean {
  return !!(
    (filters.from && !validDay(filters.from)) ||
    (filters.to && !validDay(filters.to)) ||
    (filters.from && filters.to && filters.from > filters.to)
  );
}
export function filterOrders(orders: Order[], filters: OrderFilters): Order[] {
  if (invalidDateRange(filters)) return [];
  const query = normalize(filters.search.trim());
  return orders.filter((order) => {
    const date = orderDay(order.createdAt);
    return (
      (filters.status === "all" || order.status === filters.status) &&
      (filters.fulfillment === "all" ||
        order.fulfillment === filters.fulfillment) &&
      (!filters.from || date >= filters.from) &&
      (!filters.to || date <= filters.to) &&
      normalize(
        [order.id, order.customerName ?? "", order.phone ?? ""].join(" "),
      ).includes(query)
    );
  });
}
export function summarizeOrders(orders: Order[]): AdminDashboard["stats"] {
  const completed = orders.filter((order) => order.status === "COMPLETED");
  const daily = new Map<
    string,
    { date: string; count: number; value: number }
  >();
  for (const order of orders) {
    const date = orderDay(order.createdAt);
    const point = daily.get(date) ?? { date, count: 0, value: 0 };
    point.count++;
    if (order.status === "COMPLETED") point.value += order.total;
    daily.set(date, point);
  }
  return {
    sampleLimit: 200,
    totalOrders: orders.length,
    activeOrders: orders.filter(
      (order) => !["COMPLETED", "CANCELLED"].includes(order.status),
    ).length,
    completedOrders: completed.length,
    cancelledOrders: orders.filter((order) => order.status === "CANCELLED")
      .length,
    completedValue: completed.reduce((sum, order) => sum + order.total, 0),
    daily: [...daily.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14),
  };
}
export function ordersCsv(orders: Order[]): string {
  const rows = [
    [
      "order_id",
      "created_at",
      "status",
      "fulfillment",
      "subtotal_vnd",
      "discount_vnd",
      "delivery_fee_vnd",
      "total_vnd",
    ],
    ...orders.map((order) => [
      order.id,
      order.createdAt,
      order.status,
      order.fulfillment ?? "",
      String(order.subtotal),
      String(order.discount ?? 0),
      String(order.deliveryFee),
      String(order.total),
    ]),
  ];
  // Machine-owned fields only. Never include contact, note or raw search input.
  return (
    "\ufeff" +
    rows
      .map((row) =>
        row.map((value) => '"' + value.replace(/"/g, '""') + '"').join(","),
      )
      .join("\r\n")
  );
}
