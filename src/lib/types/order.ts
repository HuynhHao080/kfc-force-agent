export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "SUBMITTED"
  | "PREPARING"
  | "READY"
  | "DELIVERING"
  | "COMPLETED"
  | "CANCELLED";

export interface Order {
  id: string;
  userId: string;
  cartId: string;
  status: OrderStatus;
  subtotal: number;
  discount: number;
  promotion?: import("./promotion").AppliedPromotion;
  deliveryFee: number;
  total: number;
  currency: "VND";
  shippingAddress?: Record<string, unknown>;
  customerName?: string;
  phone?: string;
  fulfillment?: "pickup" | "delivery";
  note?: string;
  paymentMethod?: "COD";
  store?: import("./shop").OrderStoreSnapshot;
  feedback?: import("./feedback").OrderFeedback;
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
