/**
 * Hợp đồng dữ liệu của kênh chat (issue #16). Không phụ thuộc kênh: adapter của từng kênh
 * chuyển tin của kênh sang InboundMessage và dịch OutboundMessage sang định dạng của kênh.
 */
export type ChannelId = "whatsapp" | "web";

/** Tin nhắn đã chuẩn hoá. */
export interface InboundMessage {
  channel: ChannelId;
  /** whatsapp: waId (số điện thoại dạng quốc tế, chỉ gồm chữ số). Dữ liệu liên hệ: không ghi log đầy đủ. */
  externalUserId: string;
  /** whatsapp: wamid, dùng để chống trùng. */
  externalMessageId: string;
  /** ISO, theo timestamp của kênh. */
  receivedAt: string;
  /** Tên hiển thị WhatsApp, chỉ để gợi ý tên nhận đơn. */
  profileName?: string;
  kind: "text" | "button_reply" | "list_reply" | "unsupported";
  /** kind = text: nội dung; button_reply/list_reply: tiêu đề nút khách bấm (để ghi lịch sử). */
  text?: string;
  /** Id nút/dòng khi kind = button_reply | list_reply. */
  replyId?: string;
}

/** Phản hồi đã chuẩn hoá; adapter tự dịch sang định dạng của kênh. */
export type OutboundMessage =
  | { kind: "text"; text: string }
  /** WhatsApp: tối đa 3 nút, tiêu đề ≤ 20 ký tự. */
  | { kind: "buttons"; text: string; buttons: { id: string; title: string }[] }
  | { kind: "list"; text: string; buttonLabel: string; rows: { id: string; title: string; description?: string }[] };

/**
 * Trạng thái hội thoại của một khách trên một kênh (tạo tự động ở tin đầu tiên).
 * Nhân viên tiếp quản dùng mode/takenOver* ở giai đoạn 6.
 */
export interface ConversationState {
  channel: ChannelId;
  /** whatsapp: waId, cần để gửi trả lời. Dữ liệu liên hệ: chỉ lưu ở đây, không ghi log, không đưa vào id. */
  externalUserId: string;
  /** userId nội bộ: wa_ + HMAC của waId (identity.ts). */
  customerId: string;
  mode: "AI" | "HUMAN";
  takenOverBy?: string;
  takenOverAt?: string;
  /** Tên hiển thị WhatsApp gần nhất, gợi ý tên nhận đơn. */
  profileName?: string;
  /** Để biết còn trong cửa sổ 24 giờ của WhatsApp không. */
  lastInboundAt: string;
  /** Bản nháp chốt đơn trong chat (giai đoạn 4); null khi không chốt đơn. */
  checkout?: CheckoutDraft | null;
  /** Đơn vừa đặt từ nút "Đặt đơn": bấm lại cùng nút trả về đúng đơn này, không tạo đơn mới. */
  lastOrder?: { token: string; orderId: string; total: number; placedAt: string } | null;
  createdAt: string;
  updatedAt: string;
  /** Đổi ở mỗi lần ghi; ghi kèm revision cũ (compare-and-set) để hai lần ghi đồng thời không đè nhau. */
  revision: string;
}

/**
 * Các bước chốt đơn: hình thức nhận → tên → số điện thoại (bỏ qua nếu số WhatsApp là số Việt Nam) →
 * địa chỉ (chỉ khi giao hàng) → xem lại và bấm "Đặt đơn".
 */
export interface CheckoutDraft {
  step: "fulfillment" | "name" | "phone" | "address" | "review";
  fulfillment?: "pickup" | "delivery";
  customerName?: string;
  phone?: string;
  address?: string;
  /** Có ở bước review: khoá idempotency của đơn và dữ liệu giỏ/tổng tiền khách đã xem. */
  review?: { token: string; cartId: string; cartSignature: string; expectedTotal: number; shopRevision: string };
  startedAt: string;
}
