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

/** Trạng thái hội thoại để nhân viên tiếp quản (giai đoạn 6). */
export interface ConversationState {
  channel: ChannelId;
  externalUserId: string;
  /** Map từ waId, tạo tự động lần đầu. */
  customerId: string;
  mode: "AI" | "HUMAN";
  takenOverBy?: string;
  takenOverAt?: string;
  /** Để biết còn trong cửa sổ 24 giờ của WhatsApp không. */
  lastInboundAt: string;
}
