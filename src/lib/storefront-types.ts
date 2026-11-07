import type { Cart, CartItem } from "./types/cart";
import type { Order, OrderItem, OrderEvent } from "./types/order";
import type { CustomerProfile } from "./types/account";
import type { MenuCategory, MenuItem } from "./types/menu";
import type { PendingConfirmation } from "./agent/confirmation";
import type { AddressBook } from "./types/address-book";
export interface StorefrontSnapshot {
  shop: import("./types/shop").ShopView;
  addressBook: AddressBook | null;
  ownerId: string;
  session: {
    profile: CustomerProfile | null;
    messages: ChatTurn[];
    requiresConfirmation: boolean;
    pendingConfirmation: PendingConfirmation | null;
  };
  menu: { categories: MenuCategory[]; items: MenuItem[] };
  basket: Basket | null;
  history: { orders: Order[] };
  detail: OrderDetail | null;
}
export interface Basket {
  signature?: string;
  cart: Cart | null;
  items: CartItem[];
}
export type OrderDetail = Order & { items: OrderItem[]; events: OrderEvent[] };
export type ChatTurn = { role: "user" | "assistant"; content: string };
export const money = (value: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    value,
  );
export class RequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "RequestError";
  }
}
export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  let response: Response;
  const headers = new Headers(options?.headers);
  if (!headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");
  try {
    response = await fetch(url, {
      ...options,
      headers,
      signal: options?.signal ?? AbortSignal.timeout(20000),
      cache: "no-store",
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError")
    ) {
      throw new Error(
        "Kết nối quá chậm. Hãy làm mới dữ liệu để xem kết quả trước khi thử lại. Nếu vừa đặt đơn, hãy kiểm tra lịch sử trước khi đặt lại.",
      );
    }
    throw new Error(
      "Không thể kết nối máy chủ. Vui lòng kiểm tra mạng rồi thử lại.",
    );
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      "Máy chủ tạm thời không phản hồi đúng định dạng. Vui lòng thử lại sau.",
    );
  }
  if (!response.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? (data as { error: unknown }).error
        : null;
    throw new RequestError(
      typeof message === "string"
        ? message
        : "Không thể xử lý yêu cầu. Vui lòng thử lại.",
      response.status,
      data &&
        typeof data === "object" &&
        "code" in data &&
        typeof data.code === "string"
        ? data.code
        : undefined,
    );
  }
  return data as T;
}
