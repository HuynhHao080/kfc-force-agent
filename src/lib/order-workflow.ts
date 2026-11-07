import type { Order, OrderStatus } from "./types/order";
export const orderStatusLabels: Record<OrderStatus, string> = {
  PENDING: "Chờ xác nhận",
  CONFIRMED: "Đã ghi nhận",
  SUBMITTED: "Đã gửi",
  PREPARING: "Đang chuẩn bị",
  READY: "Sẵn sàng nhận",
  DELIVERING: "Đang giao (demo)",
  COMPLETED: "Hoàn tất",
  CANCELLED: "Đã huỷ",
};
export function nextOrderStatuses(
  order: Pick<Order, "status" | "fulfillment">,
): OrderStatus[] {
  switch (order.status) {
    case "CONFIRMED":
      return ["PREPARING", "CANCELLED"];
    case "PREPARING":
      return [order.fulfillment === "delivery" ? "DELIVERING" : "READY"];
    case "READY":
    case "DELIVERING":
      return ["COMPLETED"];
    default:
      return [];
  }
}
