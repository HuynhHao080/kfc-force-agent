import type { ChannelStateService } from "./state-service";
import type { OutboundMessage } from "./types";
import type { ChannelSenderPort } from "./worker";
import { orderCode } from "./checkout-flow";
import { maskWaId } from "./whatsapp/identity";

/** Ngoài 24 giờ kể từ tin gần nhất của khách, WhatsApp chỉ cho gửi template đã duyệt: không gửi tin thường. */
export const CUSTOMER_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface OrderStatusUpdate {
  id: string;
  userId: string;
  status: string;
  fulfillment?: "pickup" | "delivery";
  /** Lý do huỷ admin nhập (hiển thị cho khách). */
  cancellationReason?: string;
}

export function orderStatusMessage(order: OrderStatusUpdate): OutboundMessage | null {
  const code = orderCode(order.id);
  const text = {
    PREPARING: `Đơn ${code} đang được chuẩn bị.`,
    READY: order.fulfillment === "delivery" ? `Đơn ${code} đã sẵn sàng và sắp được giao.` : `Đơn ${code} đã sẵn sàng, mời bạn đến quầy nhận món.`,
    DELIVERING: `Đơn ${code} đang được giao tới bạn.`,
    COMPLETED: `Đơn ${code} đã hoàn tất. Cảm ơn bạn đã đặt món!`,
    CANCELLED: `Đơn ${code} đã bị huỷ${order.cancellationReason ? `: ${order.cancellationReason}` : "."}`,
  }[order.status];
  return text ? { kind: "text", text } : null;
}

/**
 * Báo khách WhatsApp khi đơn đổi trạng thái. Chỉ áp dụng cho khách WhatsApp (userId wa_…) còn trong cửa sổ 24 giờ.
 * Không bao giờ làm hỏng việc chuyển trạng thái: lỗi chỉ được ghi log (số đã che).
 */
export async function notifyOrderStatus(
  deps: { states: Pick<ChannelStateService, "get">; sender: ChannelSenderPort; now?: () => Date },
  order: OrderStatusUpdate,
): Promise<"sent" | "not_whatsapp" | "no_message" | "outside_window" | "failed"> {
  if (!order.userId.startsWith("wa_")) return "not_whatsapp";
  const message = orderStatusMessage(order);
  if (!message) return "no_message";
  try {
    const state = await deps.states.get("whatsapp", order.userId);
    if (!state) return "not_whatsapp";
    const now = (deps.now ?? (() => new Date()))().getTime();
    if (now - Date.parse(state.lastInboundAt) > CUSTOMER_SERVICE_WINDOW_MS) return "outside_window";
    const sent = await deps.sender.send(state.externalUserId, message);
    if (sent.ok) return "sent";
    console.error("channel_order_notice_failed", JSON.stringify({ status: order.status, to: maskWaId(state.externalUserId) }));
    return "failed";
  } catch (error) {
    console.error("channel_order_notice_failed", error instanceof Error ? error.name : "unknown");
    return "failed";
  }
}
