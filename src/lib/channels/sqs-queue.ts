import { createHash } from "node:crypto";
import { z } from "zod";
import type { InboundQueue } from "./queue";
import type { InboundMessage } from "./types";

/**
 * Cổng tối thiểu của SQS SendMessageBatch. Lambda truyền SQSClient thật vào (phần deploy, giai đoạn 7);
 * test truyền bản giả, nên code này không cần AWS SDK hay mạng.
 */
export interface SqsSendPort {
  sendMessageBatch(input: {
    QueueUrl: string;
    Entries: { Id: string; MessageBody: string; MessageGroupId: string; MessageDeduplicationId: string }[];
  }): Promise<{ Failed?: { Id?: string }[] }>;
}

/** SendMessageBatch nhận tối đa 10 tin. */
const SQS_BATCH = 10;

/**
 * Driver SQS FIFO cho hàng đợi tin vào:
 * - MessageGroupId = mã khách (wa_ + HMAC, không phải số điện thoại): tuần tự theo khách, song song giữa các khách;
 * - MessageDeduplicationId = SHA-256 của mã tin: SQS bỏ tin Meta gửi lại trong cửa sổ 5 phút.
 * Body chứa số WhatsApp và nội dung tin để worker trả lời: queue phải bật mã hoá (SSE) khi deploy.
 * Có tin gửi lỗi thì ném lỗi để webhook trả 500 và Meta gửi lại.
 */
export function createSqsInboundQueue(options: {
  queueUrl: string;
  client: SqsSendPort;
  groupId: (message: InboundMessage) => string;
}): InboundQueue {
  if (!/^https:\/\/\S+\.fifo$/.test(options.queueUrl)) throw new Error("Hàng đợi tin vào phải là SQS FIFO (.fifo).");
  return {
    async enqueue(messages) {
      for (let start = 0; start < messages.length; start += SQS_BATCH) {
        const entries = messages.slice(start, start + SQS_BATCH).map((message, index) => ({
          Id: String(index),
          MessageBody: JSON.stringify(message),
          MessageGroupId: options.groupId(message),
          MessageDeduplicationId: createHash("sha256").update(`${message.channel}:${message.externalMessageId}`).digest("hex"),
        }));
        const result = await options.client.sendMessageBatch({ QueueUrl: options.queueUrl, Entries: entries });
        if (result.Failed?.length) throw new Error("SQS_SEND_FAILED");
      }
    },
  };
}

const inboundSchema = z.object({
  channel: z.enum(["whatsapp", "web"]),
  externalUserId: z.string().regex(/^\d{6,15}$/),
  externalMessageId: z.string().min(1).max(256),
  receivedAt: z.string().datetime(),
  profileName: z.string().max(100).optional(),
  kind: z.enum(["text", "button_reply", "list_reply", "unsupported"]),
  text: z.string().max(4096).optional(),
  replyId: z.string().min(1).max(256).optional(),
}).strict();

/** Body SQS → InboundMessage; sai cấu trúc → null (worker bỏ qua, không lặp vô hạn). */
export function parseInboundMessage(body: string): InboundMessage | null {
  try {
    const parsed = inboundSchema.safeParse(JSON.parse(body));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
