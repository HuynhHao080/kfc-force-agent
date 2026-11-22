import type { OutboundMessage } from "./types";

/** Tiền VND theo cách hiển thị của web ("45.000 ₫"). */
export const money = (value: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Id của nút. Server chỉ tin id đã kiểm tra hình dạng; quyền thực thi vẫn do luồng xác nhận/checkout quyết định. */
export const BUTTON = {
  confirm: (id: string) => `confirm:${id}`,
  skip: (id: string) => `skip:${id}`,
  checkout: "checkout:start",
  cancelCheckout: "checkout:cancel",
  pickup: "fulfillment:pickup",
  delivery: "fulfillment:delivery",
  profileName: "name:profile",
  order: (token: string) => `order:${token}`,
} as const;

export type ButtonAction =
  | { kind: "confirm"; id: string }
  | { kind: "skip"; id: string }
  | { kind: "checkout" }
  | { kind: "cancelCheckout" }
  | { kind: "fulfillment"; value: "pickup" | "delivery" }
  | { kind: "profileName" }
  | { kind: "order"; token: string };

export function parseButton(replyId: string | undefined): ButtonAction | null {
  if (!replyId) return null;
  const separator = replyId.indexOf(":");
  const kind = separator < 0 ? replyId : replyId.slice(0, separator);
  const value = separator < 0 ? "" : replyId.slice(separator + 1);
  if (kind === "confirm" && UUID.test(value)) return { kind: "confirm", id: value };
  if (kind === "skip" && UUID.test(value)) return { kind: "skip", id: value };
  if (kind === "order" && UUID.test(value)) return { kind: "order", token: value };
  if (replyId === BUTTON.checkout) return { kind: "checkout" };
  if (replyId === BUTTON.cancelCheckout) return { kind: "cancelCheckout" };
  if (replyId === BUTTON.pickup) return { kind: "fulfillment", value: "pickup" };
  if (replyId === BUTTON.delivery) return { kind: "fulfillment", value: "delivery" };
  if (replyId === BUTTON.profileName) return { kind: "profileName" };
  return null;
}

/**
 * Đề xuất thay đổi giỏ kèm nút. Nội dung nút luôn có tóm tắt của server (nguồn đúng về món, số lượng, giá);
 * câu của agent đứng trước nếu chưa chứa đủ tóm tắt đó.
 */
export function proposalMessage(reply: string, pending: { id: string; summary: string[] }): OutboundMessage {
  const summary = pending.summary.map((line) => "- " + line).join("\n");
  const covered = pending.summary.every((line) => reply.includes(line));
  const text = covered ? reply : `${reply.trim()}\n\nĐề xuất đang chờ bạn xác nhận:\n${summary}`.trim();
  return {
    kind: "buttons",
    text,
    buttons: [
      { id: BUTTON.confirm(pending.id), title: "Xác nhận thao tác" },
      { id: BUTTON.skip(pending.id), title: "Bỏ qua" },
    ],
  };
}

/** Câu trả lời kèm nút "Chốt đơn" khi giỏ có món và không có đề xuất đang chờ. */
export function withCheckoutButton(text: string): OutboundMessage {
  return { kind: "buttons", text, buttons: [{ id: BUTTON.checkout, title: "Chốt đơn" }] };
}

export const CANCEL_CHECKOUT_BUTTON = { id: BUTTON.cancelCheckout, title: "Huỷ chốt đơn" };
