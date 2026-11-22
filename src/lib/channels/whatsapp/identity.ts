import { createHmac } from "node:crypto";
import { isWaId } from "./normalize";

/**
 * waId → userId nội bộ: "wa_" + HMAC-SHA256(CHANNEL_ID_SECRET, waId), 32 ký tự hex.
 * Số điện thoại không nằm trong id, log hay DTO. Cần khoá bí mật vì số điện thoại có ít
 * khả năng nên băm không khoá thì dò ngược được. Đổi khoá thì khách thành người mới.
 */
export function channelUserId(waId: string, secret: string | undefined): string {
  if (!secret || secret.length < 32) throw new Error("CHANNEL_ID_SECRET phải có ít nhất 32 ký tự.");
  if (!isWaId(waId)) throw new Error("WhatsApp id không hợp lệ.");
  return "wa_" + createHmac("sha256", secret).update("whatsapp:" + waId).digest("hex").slice(0, 32);
}

/** Che số để ghi log: giữ 2 số đầu và 3 số cuối. */
export function maskWaId(waId: string): string {
  return waId.length <= 5 ? "***" : waId.slice(0, 2) + "*".repeat(waId.length - 5) + waId.slice(-3);
}

/** Số Việt Nam (84 + 9 số) → dạng 0xxxxxxxxx cho đơn hàng; số nước ngoài → null (hỏi khách khi checkout). */
export function vietnamPhoneFromWaId(waId: string): string | null {
  return /^84[0-9]{9}$/.test(waId) ? "0" + waId.slice(2) : null;
}
