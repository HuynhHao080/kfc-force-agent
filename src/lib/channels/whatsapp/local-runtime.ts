import { createLocalInboundQueue, type LocalInboundQueue } from "../queue";
import { maskWaId } from "./identity";

const shared = globalThis as typeof globalThis & { kfcWhatsAppLocalQueue?: LocalInboundQueue };

/**
 * Hàng đợi local cho cổng Next.js (chạy local, một tiến trình).
 * Giai đoạn 2 chưa có worker: tin đã qua kiểm chữ ký chỉ được ghi log dạng che (loại tin, số đã che),
 * chưa gọi agent và chưa trả lời khách. Worker gọi ChatService/AgentCore làm ở giai đoạn 3.
 */
export function localWhatsAppQueue(): LocalInboundQueue {
  shared.kfcWhatsAppLocalQueue ??= createLocalInboundQueue(async (message) => {
    console.info("whatsapp_inbound", JSON.stringify({ kind: message.kind, from: maskWaId(message.externalUserId) }));
  });
  return shared.kfcWhatsAppLocalQueue;
}
