import { Cart } from "@/lib/types/cart";
import { Order, OrderItem, OrderEvent } from "@/lib/types/order";

export interface OrderRepository {
  getRecentFeedback(limit: number): Promise<Order[]>;
  saveFeedback(orderId: string, userId: string, feedback: import("@/lib/types/feedback").OrderFeedback, expectedRevision: string | null): Promise<void>;
  getRecentOrders(limit: number): Promise<Order[]>;
  transitionOrder(
    order: Order,
    event: OrderEvent,
    expectedStatus: Order["status"],
  ): Promise<void>;
  completeCheckout(
    order: Order,
    items: OrderItem[],
    event: OrderEvent,
    cart: Cart,
  ): Promise<void>;
  cancelOrder(order: Order, event: OrderEvent): Promise<void>;
  getOrderEvents(orderId: string): Promise<OrderEvent[]>;
  createOrder(order: Order): Promise<void>;
  getOrderById(orderId: string): Promise<Order | null>;
  getUserOrders(userId: string): Promise<Order[]>;
  getOrderItems(orderId: string): Promise<OrderItem[]>;
  appendOrderEvent(event: OrderEvent): Promise<void>;
}
