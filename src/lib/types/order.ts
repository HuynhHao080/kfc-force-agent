export type OrderStatus =
  "PENDING" | "CONFIRMED" | "SUBMITTED" | "PREPARING" | "COMPLETED" | "CANCELLED";

export interface Order {
  id: string;
  userId: string;
  cartId: string;
  status: OrderStatus;
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  currency: "VND";
  shippingAddress?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  nameSnapshot: string;
  unitPrice: number;
  quantity: number;
  options?: Record<string, string>;
  subtotal: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrderEvent {
  id: string;
  orderId: string;
  type: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}
