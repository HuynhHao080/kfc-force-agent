import { Order, OrderItem, OrderEvent } from "@/lib/types/order";

export interface OrderRepository {
  createOrder(order: Order): Promise<void>;
  getOrderById(orderId: string): Promise<Order | null>;
  getUserOrders(userId: string): Promise<Order[]>;
  getOrderItems(orderId: string): Promise<OrderItem[]>;
  appendOrderEvent(event: OrderEvent): Promise<void>;
}
