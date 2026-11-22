import { readWhatsAppConfig } from "@/lib/channels/whatsapp/config";
import { localWhatsAppRuntime } from "@/lib/channels/whatsapp/local-runtime";
import { MAX_WEBHOOK_BYTES, handleNotification, handleVerification, type WebhookResponse } from "@/lib/channels/whatsapp/webhook";

/**
 * Webhook WhatsApp Cloud API cho chạy local (issue #16). Trên AWS, cùng logic chạy sau API Gateway
 * bằng src/channels/lambda/whatsapp-webhook.ts. Không dùng cookie/origin của khách web: xác thực
 * bằng chữ ký X-Hub-Signature-256.
 */
const respond = (result: WebhookResponse) =>
  new Response(result.body, { status: result.status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

export async function GET(request: Request) {
  return respond(handleVerification(new URL(request.url).searchParams, readWhatsAppConfig().verifyToken));
}

export async function POST(request: Request) {
  const config = readWhatsAppConfig();
  // Cổng local chỉ có hàng đợi trong tiến trình; SQS FIFO dùng cổng Lambda.
  if (config.queueDriver !== "local") return respond({ status: 503, body: "Not configured" });
  // Thiếu cấu hình gửi tin hoặc CHANNEL_ID_SECRET: từ chối thay vì nhận tin rồi không trả lời được.
  const runtime = localWhatsAppRuntime(config);
  if (!runtime) return respond({ status: 503, body: "Not configured" });
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_WEBHOOK_BYTES) return respond({ status: 413, body: "Payload too large" });
  const rawBody = new Uint8Array(await request.arrayBuffer());
  return respond(await handleNotification({
    rawBody,
    signature: request.headers.get("x-hub-signature-256"),
    appSecret: config.appSecret,
    queue: runtime.queue,
  }));
}
