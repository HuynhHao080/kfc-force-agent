import type { InboundQueue } from "../queue";
import { normalizeWebhook } from "./normalize";
import { sameSecret, verifySignature } from "./signature";

/** Phản hồi không phụ thuộc framework; cổng Next.js và cổng Lambda tự dịch sang định dạng của mình. */
export interface WebhookResponse {
  status: number;
  body: string;
}

/** Webhook của Meta nhỏ; giới hạn để không băm/parse body lớn bất thường. */
export const MAX_WEBHOOK_BYTES = 1_000_000;

const reply = (status: number, body: string): WebhookResponse => ({ status, body });

/**
 * GET: Meta xác minh URL webhook. Đúng hub.mode=subscribe và hub.verify_token thì trả hub.challenge.
 * Challenge chỉ nhận ký tự an toàn để không phản chiếu nội dung tuỳ ý.
 */
export function handleVerification(params: URLSearchParams, verifyToken: string | undefined): WebhookResponse {
  if (!verifyToken) return reply(503, "Not configured");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge") ?? "";
  if (params.get("hub.mode") === "subscribe" && token !== null && sameSecret(token, verifyToken)
    && /^[A-Za-z0-9_-]{1,256}$/.test(challenge))
    return reply(200, challenge);
  return reply(403, "Forbidden");
}

/**
 * POST: kiểm chữ ký trên raw body → parse → chuẩn hoá → đưa vào hàng đợi → 200 ngay.
 * Sai/thiếu chữ ký: 401, không parse, không đưa gì vào hàng đợi. Chưa cấu hình App Secret: 503.
 * Hàng đợi lỗi: 500 để Meta gửi lại (hàng đợi bỏ tin trùng).
 */
export async function handleNotification(input: {
  rawBody: Uint8Array;
  signature: string | null | undefined;
  appSecret: string | undefined;
  queue: InboundQueue;
}): Promise<WebhookResponse> {
  if (!input.appSecret) return reply(503, "Not configured");
  if (input.rawBody.byteLength > MAX_WEBHOOK_BYTES) return reply(413, "Payload too large");
  if (!verifySignature(input.rawBody, input.signature, input.appSecret)) return reply(401, "Invalid signature");
  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(input.rawBody).toString("utf8"));
  } catch {
    return reply(400, "Invalid JSON");
  }
  const messages = normalizeWebhook(payload);
  try {
    if (messages.length) await input.queue.enqueue(messages);
  } catch (error) {
    console.error("whatsapp_enqueue_failed", error instanceof Error ? error.name : "unknown");
    return reply(500, "Retry later");
  }
  return reply(200, "EVENT_RECEIVED");
}
