import type { OutboundMessage } from "../types";

/** Trả lời khi khách gửi loại tin chưa hỗ trợ (ảnh, sticker, âm thanh, vị trí…). Worker gửi ở giai đoạn 3. */
export const UNSUPPORTED_REPLY: OutboundMessage = {
  kind: "text",
  text: "Xin lỗi, hiện mình chỉ đọc được tin nhắn chữ và các nút bấm. Bạn nhắn tên món, số lượng hoặc câu hỏi giúp mình nhé.",
};
