import type { InboundQueue } from "@/lib/channels/queue";
import type { WhatsAppConfig } from "@/lib/channels/whatsapp/config";
import { MAX_WEBHOOK_BYTES, handleNotification, handleVerification, type WebhookResponse } from "@/lib/channels/whatsapp/webhook";

/** Sự kiện API Gateway HTTP API (payload 2.0), chỉ các trường cần dùng. Header đã viết thường. */
export interface HttpApiEvent {
  requestContext?: { http?: { method?: string } };
  headers?: Record<string, string | undefined>;
  queryStringParameters?: Record<string, string | undefined>;
  body?: string | null;
  isBase64Encoded?: boolean;
}

export interface HttpApiResult {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

const result = (response: WebhookResponse): HttpApiResult => ({
  statusCode: response.status,
  headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  body: response.body,
});

/**
 * Lambda sau API Gateway: cùng logic với route Next.js. Hàng đợi được truyền vào
 * (SQS FIFO ở giai đoạn 3), nên adapter này test được offline với hàng đợi giả.
 */
export function createWhatsAppWebhookHandler(deps: { config: () => WhatsAppConfig; queue: InboundQueue }) {
  return async (event: HttpApiEvent): Promise<HttpApiResult> => {
    const method = event.requestContext?.http?.method?.toUpperCase();
    const config = deps.config();
    if (method === "GET") {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(event.queryStringParameters ?? {}))
        if (value !== undefined) params.set(key, value);
      return result(handleVerification(params, config.verifyToken));
    }
    if (method !== "POST") return result({ status: 405, body: "Method not allowed" });
    const body = event.body ?? "";
    // Base64 dài hơn khoảng 4/3 lần dữ liệu gốc: chặn sớm trước khi giải mã.
    if (body.length > MAX_WEBHOOK_BYTES * 2) return result({ status: 413, body: "Payload too large" });
    const rawBody = new Uint8Array(Buffer.from(body, event.isBase64Encoded ? "base64" : "utf8"));
    return result(await handleNotification({
      rawBody,
      signature: event.headers?.["x-hub-signature-256"],
      appSecret: config.appSecret,
      queue: deps.queue,
    }));
  };
}
