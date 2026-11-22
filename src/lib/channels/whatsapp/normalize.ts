import type { InboundMessage } from "../types";

/** Giới hạn độ dài tin chữ của WhatsApp. */
export const MAX_TEXT_LENGTH = 4096;

type Json = Record<string, unknown>;
const isRecord = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const text = (value: unknown, max: number) => (typeof value === "string" ? value.slice(0, max) : undefined);
/** waId: số quốc tế, chỉ gồm chữ số (E.164 không có dấu +). */
export const isWaId = (value: unknown): value is string => typeof value === "string" && /^\d{6,15}$/.test(value);

/**
 * Payload webhook của Meta → danh sách tin đã chuẩn hoá. Một webhook có thể chứa nhiều entry,
 * nhiều change và nhiều tin. Status callback (`statuses`: sent/delivered/read) bị bỏ qua.
 * Tin sai cấu trúc bị bỏ qua thay vì làm hỏng cả webhook; loại tin chưa hỗ trợ (ảnh, sticker,
 * âm thanh, vị trí…) thành kind "unsupported" để worker trả lời lịch sự.
 */
export function normalizeWebhook(payload: unknown): InboundMessage[] {
  const messages: InboundMessage[] = [];
  if (!isRecord(payload) || payload.object !== "whatsapp_business_account") return messages;
  for (const entry of list(payload.entry)) {
    if (!isRecord(entry)) continue;
    for (const change of list(entry.changes)) {
      if (!isRecord(change) || change.field !== "messages" || !isRecord(change.value)) continue;
      const names = new Map<string, string>();
      for (const contact of list(change.value.contacts)) {
        if (!isRecord(contact) || !isWaId(contact.wa_id)) continue;
        const name = isRecord(contact.profile) ? text(contact.profile.name, 100)?.trim() : undefined;
        if (name) names.set(contact.wa_id, name);
      }
      for (const raw of list(change.value.messages)) {
        const message = normalizeMessage(raw, names);
        if (message) messages.push(message);
      }
    }
  }
  return messages;
}

function normalizeMessage(raw: unknown, names: Map<string, string>): InboundMessage | null {
  if (!isRecord(raw) || !isWaId(raw.from) || typeof raw.id !== "string" || !raw.id || raw.id.length > 256) return null;
  const seconds = Number(raw.timestamp);
  const base = {
    channel: "whatsapp" as const,
    externalUserId: raw.from,
    externalMessageId: raw.id,
    receivedAt: new Date(Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : Date.now()).toISOString(),
    ...(names.has(raw.from) ? { profileName: names.get(raw.from) } : {}),
  };
  if (raw.type === "text" && isRecord(raw.text) && typeof raw.text.body === "string")
    return { ...base, kind: "text", text: raw.text.body.slice(0, MAX_TEXT_LENGTH) };
  if (raw.type === "interactive" && isRecord(raw.interactive)) {
    const { type } = raw.interactive;
    const reply = type === "button_reply" ? raw.interactive.button_reply : type === "list_reply" ? raw.interactive.list_reply : undefined;
    if (isRecord(reply) && typeof reply.id === "string" && reply.id && reply.id.length <= 256)
      return { ...base, kind: type === "button_reply" ? "button_reply" : "list_reply", replyId: reply.id, text: text(reply.title, 100) };
  }
  // Nút quick reply của template trả về type "button" với payload.
  if (raw.type === "button" && isRecord(raw.button) && typeof raw.button.payload === "string" && raw.button.payload && raw.button.payload.length <= 256)
    return { ...base, kind: "button_reply", replyId: raw.button.payload, text: text(raw.button.text, 100) };
  return { ...base, kind: "unsupported" };
}
