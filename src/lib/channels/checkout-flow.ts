import { randomUUID } from "node:crypto";
import { DomainError } from "@/lib/domain-error";
import type { ChannelCommercePort, ChannelQuote } from "./commerce";
import { BUTTON, CANCEL_CHECKOUT_BUTTON, money, withCheckoutButton } from "./messages";
import type { CheckoutDraft, ConversationState, OutboundMessage } from "./types";
import { vietnamPhoneFromWaId } from "./whatsapp/identity";

/** Bản nháp chốt đơn bỏ dở quá lâu thì hết hạn; tin chữ sau đó lại đi tới agent. */
export const CHECKOUT_TTL_MS = 30 * 60 * 1000;

/** Mã đơn như admin và kitchen board hiển thị. */
export const orderCode = (orderId: string) => "#" + orderId.slice(-8).toUpperCase();

export interface FlowContext {
  userId: string;
  state: ConversationState;
  commerce: ChannelCommercePort;
  now?: () => Date;
}

export interface FlowResult {
  replies: OutboundMessage[];
  /** Thay đổi cần ghi vào trạng thái hội thoại (undefined = không đổi). */
  patch?: Partial<Pick<ConversationState, "checkout" | "lastOrder">>;
}

const text = (value: string): OutboundMessage => ({ kind: "text", text: value });
const ask = (value: string, extra: { id: string; title: string }[] = []): OutboundMessage =>
  ({ kind: "buttons", text: value, buttons: [...extra, CANCEL_CHECKOUT_BUTTON] });

export function activeCheckout(state: ConversationState, now: Date = new Date()): CheckoutDraft | null {
  const draft = state.checkout;
  if (!draft) return null;
  return now.getTime() - Date.parse(draft.startedAt) <= CHECKOUT_TTL_MS ? draft : null;
}

const validName = (value: string | undefined) => {
  const name = value?.replace(/\s+/g, " ").trim() ?? "";
  return name.length >= 2 && name.length <= 100 && /\p{L}/u.test(name) ? name : null;
};
const validPhone = (value: string) => {
  const phone = value.replace(/[\s.\-()]/g, "");
  return /^(?:0|\+84)[0-9]{9}$/.test(phone) ? phone : null;
};
const validAddress = (value: string) => {
  const address = value.replace(/\s+/g, " ").trim();
  return address.length >= 10 && address.length <= 300 ? address : null;
};

function reviewText(draft: CheckoutDraft, quote: ChannelQuote): string {
  return [
    "Bạn kiểm tra lại đơn nhé:",
    ...quote.lines.map((line) => `- ${line.quantity} × ${line.name}: ${money(line.unitPrice * line.quantity)}`),
    `Tạm tính: ${money(quote.subtotal)}`,
    ...(draft.fulfillment === "delivery" ? [`Phí giao: ${money(quote.deliveryFee)}`] : []),
    `Tổng: ${money(quote.total)} (thanh toán khi nhận món)`,
    draft.fulfillment === "delivery" ? `Giao tới: ${draft.address}` : "Nhận tại quán",
    `Người nhận: ${draft.customerName} · ${draft.phone}`,
    "Bấm “Đặt đơn” để gửi đơn tới cửa hàng.",
  ].join("\n");
}

/** Chuyển sang bước còn thiếu tiếp theo; tới bước xem lại thì báo giá mới và tạo khoá đặt đơn mới. */
async function advance(ctx: FlowContext, draft: CheckoutDraft, note?: string): Promise<FlowResult> {
  const prefix = note ? note + "\n" : "";
  if (!draft.fulfillment) {
    const next = { ...draft, step: "fulfillment" as const, review: undefined };
    return { patch: { checkout: next }, replies: [ask(prefix + "Bạn muốn nhận món thế nào?", [
      { id: BUTTON.pickup, title: "Nhận tại quán" }, { id: BUTTON.delivery, title: "Giao hàng" },
    ])] };
  }
  if (!draft.customerName) {
    const next = { ...draft, step: "name" as const, review: undefined };
    const profile = validName(ctx.state.profileName);
    return { patch: { checkout: next }, replies: [profile
      ? ask(`${prefix}Tên người nhận: ${profile}\nBấm “Dùng tên này” hoặc nhắn tên khác.`, [{ id: BUTTON.profileName, title: "Dùng tên này" }])
      : ask(prefix + "Bạn cho mình xin tên người nhận nhé.")] };
  }
  if (!draft.phone) {
    const phone = vietnamPhoneFromWaId(ctx.state.externalUserId);
    if (phone) return advance(ctx, { ...draft, phone }, note);
    const next = { ...draft, step: "phone" as const, review: undefined };
    return { patch: { checkout: next }, replies: [ask(prefix + "Bạn nhắn số điện thoại Việt Nam để cửa hàng liên hệ khi cần nhé (ví dụ 0901234567).")] };
  }
  if (draft.fulfillment === "delivery" && !draft.address) {
    const next = { ...draft, step: "address" as const, review: undefined };
    return { patch: { checkout: next }, replies: [ask(prefix + "Bạn nhắn địa chỉ giao hàng đầy đủ (số nhà, đường, phường/xã, quận/huyện) nhé.")] };
  }
  let quote: ChannelQuote;
  try {
    quote = await ctx.commerce.quote(ctx.userId, draft.fulfillment);
  } catch (error) {
    if (!(error instanceof DomainError)) throw error;
    if (error.code === "EMPTY_CART") return { patch: { checkout: null }, replies: [text("Giỏ hàng đang trống. Bạn chọn món trước rồi chốt đơn nhé.")] };
    // Cửa hàng đóng, tắt hình thức này hoặc chưa đủ tiền tối thiểu: cho chọn lại hình thức nhận.
    return advance(ctx, { ...draft, fulfillment: undefined, address: undefined }, prefix + error.message);
  }
  const review = { token: randomUUID(), cartId: quote.cartId, cartSignature: quote.cartSignature, expectedTotal: quote.total, shopRevision: quote.shopRevision };
  const next: CheckoutDraft = { ...draft, step: "review", review };
  return { patch: { checkout: next }, replies: [ask(prefix + reviewText(next, quote), [{ id: BUTTON.order(review.token), title: "Đặt đơn" }])] };
}

export async function startCheckout(ctx: FlowContext): Promise<FlowResult> {
  if (!ctx.commerce.orderingEnabled())
    return { replies: [text("Hiện cửa hàng chưa nhận đặt đơn qua WhatsApp. Bạn có thể tiếp tục hỏi món nhé.")] };
  if (!(await ctx.commerce.cart(ctx.userId))) return { replies: [text("Giỏ hàng đang trống. Bạn chọn món trước rồi chốt đơn nhé.")] };
  const now = (ctx.now ?? (() => new Date()))();
  return advance(ctx, { step: "fulfillment", startedAt: now.toISOString() });
}

/** Nút của bước chốt đơn khi không có bản nháp còn hạn: mời bắt đầu lại. */
const restart = (): FlowResult => ({ patch: { checkout: null }, replies: [withCheckoutButton("Phiên chốt đơn đã hết hạn hoặc đã thay đổi. Bấm “Chốt đơn” để bắt đầu lại nhé.")] });

export async function chooseFulfillment(ctx: FlowContext, fulfillment: "pickup" | "delivery"): Promise<FlowResult> {
  const draft = activeCheckout(ctx.state, ctx.now?.());
  if (!draft) return restart();
  return advance(ctx, { ...draft, fulfillment, ...(fulfillment === "pickup" ? { address: undefined } : {}) });
}

export async function useProfileName(ctx: FlowContext): Promise<FlowResult> {
  const draft = activeCheckout(ctx.state, ctx.now?.());
  const name = validName(ctx.state.profileName);
  if (!draft || draft.step !== "name" || !name) return draft ? advance(ctx, draft) : restart();
  return advance(ctx, { ...draft, customerName: name });
}

/**
 * Tin chữ trong lúc chốt đơn: chỉ các bước tên, số điện thoại, địa chỉ nhận chữ. Bước khác trả null để
 * tin đi tới agent như bình thường (khách vẫn sửa giỏ được; giỏ đổi thì nút "Đặt đơn" cũ bị từ chối).
 */
export async function checkoutText(ctx: FlowContext, value: string): Promise<FlowResult | null> {
  const draft = activeCheckout(ctx.state, ctx.now?.());
  if (!draft) return null;
  if (draft.step === "name") {
    const name = validName(value);
    return name ? advance(ctx, { ...draft, customerName: name }) : advance(ctx, draft, "Tên cần từ 2 đến 100 ký tự và có chữ cái.");
  }
  if (draft.step === "phone") {
    const phone = validPhone(value);
    return phone ? advance(ctx, { ...draft, phone }) : advance(ctx, draft, "Số điện thoại Việt Nam chưa hợp lệ (10 số, bắt đầu bằng 0 hoặc +84).");
  }
  if (draft.step === "address") {
    const address = validAddress(value);
    return address ? advance(ctx, { ...draft, address }) : advance(ctx, draft, "Địa chỉ cần từ 10 đến 300 ký tự.");
  }
  return null;
}

export function cancelCheckout(): FlowResult {
  return { patch: { checkout: null }, replies: [withCheckoutButton("Đã huỷ bước chốt đơn. Giỏ hàng vẫn giữ nguyên; bạn có thể hỏi thêm món hoặc chốt đơn lại.")] };
}

/** Đặt đơn bằng đúng khoá của lần xem lại gần nhất. Bấm lại nút của đơn đã đặt không tạo đơn mới. */
export async function placeOrder(ctx: FlowContext, token: string): Promise<FlowResult> {
  const last = ctx.state.lastOrder;
  if (last?.token === token)
    return { replies: [text(`Đơn ${orderCode(last.orderId)} đã được đặt rồi (tổng ${money(last.total)}), bạn không cần bấm lại nhé.`)] };
  const draft = activeCheckout(ctx.state, ctx.now?.());
  if (!draft?.review) return restart();
  if (draft.review.token !== token) return advance(ctx, draft, "Nút này thuộc bản xem lại cũ, mình gửi lại thông tin đơn mới nhất:");
  if (!ctx.commerce.orderingEnabled())
    return { patch: { checkout: null }, replies: [text("Hiện cửa hàng chưa nhận đặt đơn qua WhatsApp.")] };
  try {
    const order = await ctx.commerce.placeOrder(ctx.userId, {
      cartId: draft.review.cartId, cartSignature: draft.review.cartSignature,
      customerName: draft.customerName!, phone: draft.phone!, fulfillment: draft.fulfillment!,
      address: draft.fulfillment === "delivery" ? draft.address ?? "" : "",
      idempotencyKey: token, expectedTotal: draft.review.expectedTotal, shopRevision: draft.review.shopRevision,
    });
    const placedAt = (ctx.now ?? (() => new Date()))().toISOString();
    return {
      patch: { checkout: null, lastOrder: { token, orderId: order.orderId, total: order.total, placedAt } },
      replies: [text(`Đặt đơn thành công. Mã đơn ${orderCode(order.orderId)}, tổng ${money(order.total)}. Cửa hàng đã nhận đơn; mình sẽ nhắn khi đơn được chuẩn bị nhé.`)],
    };
  } catch (error) {
    if (!(error instanceof DomainError)) throw error;
    // Giỏ, giá, món hoặc điều kiện cửa hàng đã đổi: cho khách xem lại với số liệu mới, không đặt theo số liệu cũ.
    if (["CART_CHANGED", "PRICE_CHANGED", "ITEM_UNAVAILABLE", "SHOP_CHANGED", "SHOP_CLOSED", "MINIMUM_ORDER", "EMPTY_CART"].includes(error.code))
      return advance(ctx, { ...draft, review: undefined }, error.message);
    return { replies: [text(error.message)] };
  }
}
