import { OrderRepository } from "@/lib/db/repositories/interfaces/order-repository.interface";
import { Order, OrderItem, OrderEvent } from "@/lib/types/order";

export class OrderService {
  constructor(private orderRepository: OrderRepository) {}

  async createOrder(order: Order): Promise<void> {
    await this.orderRepository.createOrder(order);
  }

  async getOrderById(orderId: string): Promise<Order | null> {
    return this.orderRepository.getOrderById(orderId);
  }

  async getUserOrders(userId: string): Promise<Order[]> {
    return this.orderRepository.getUserOrders(userId);
  }

  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    return this.orderRepository.getOrderItems(orderId);
  }

  async appendOrderEvent(event: OrderEvent): Promise<void> {
    await this.orderRepository.appendOrderEvent(event);
  }
}
