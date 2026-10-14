import { ActionExecutionResult, ProposedAction } from "@/lib/types/agent";

export type OrderStatus =
  | "BROWSING"
  | "SELECTING"
  | "CART_EDITING"
  | "ORDER_REVIEW"
  | "WAITING_CONFIRMATION"
  | "CONFIRMED"
  | "SUBMITTED"
  | "PREPARING"
  | "COMPLETED";

export interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

export interface Session {
  id: string;
  userId: string;
  platform: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  basePrice: number;
  imageUrl?: string;
  available: boolean;
}

export interface Order {
  id: string;
  userId: string;
  cartId: string;
  status: OrderStatus;
  totalAmount: number;
  discountAmount: number;
  deliveryFee: number;
  finalAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  orderId: string;
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface ChatRequest {
  platform: string;
  userId: string;
  sessionId: string;
  message: string;
  /**
   * Explicit confirmation of the previously proposed mutation.
   * A boolean only — never inferred from message text or identifiers.
   */
  confirm?: boolean;
}

export interface ChatResponse {
  reply: string;
  sessionId: string;
  actions: ProposedAction[];
  requiresConfirmation: boolean;
  execution: ActionExecutionResult[];
  /** Populated instead of `reply` when the request is a controlled failure. */
  error?: string;
}

