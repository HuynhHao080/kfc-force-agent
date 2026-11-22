import type { InboundMessage } from "./types";

/**
 * Hàng đợi tin vào. Webhook chỉ đưa tin vào hàng đợi rồi trả 200 ngay (Meta gửi lại nếu chậm).
 * Driver "local" (dưới đây) chạy trong một tiến trình; driver "sqs" (SQS FIFO, MessageGroupId = khách,
 * MessageDeduplicationId = mã tin) làm ở giai đoạn 3.
 */
export interface InboundQueue {
  enqueue(messages: InboundMessage[]): Promise<void>;
}

export type InboundHandler = (message: InboundMessage) => Promise<void>;

export interface LocalInboundQueue extends InboundQueue {
  /** Chờ mọi tin đã nhận xử lý xong (test, tắt tiến trình). */
  idle(): Promise<void>;
}

/**
 * Hàng đợi trong tiến trình:
 * - tuần tự theo từng khách (kênh + externalUserId), song song giữa các khách;
 * - bỏ tin trùng theo mã tin (Meta có thể gửi lại cùng một tin), nhớ tối đa `seenLimit` mã gần nhất;
 * - lỗi của một tin không chặn các tin sau. Giống SQS FIFO, tin trùng gửi lại sau lỗi cũng bị bỏ.
 * Chỉ dùng cho một tiến trình (như local JSON và budget Bedrock).
 */
export function createLocalInboundQueue(
  handler: InboundHandler,
  options: { seenLimit?: number; onError?: (error: unknown, message: InboundMessage) => void } = {},
): LocalInboundQueue {
  const seenLimit = options.seenLimit ?? 10_000;
  const seen = new Set<string>();
  const chains = new Map<string, Promise<void>>();
  // Chỉ ghi loại lỗi, không ghi nội dung tin hay số điện thoại.
  const onError = options.onError ?? ((error) => console.error("channel_inbound_failed", error instanceof Error ? error.name : "unknown"));

  const remember = (key: string) => {
    seen.add(key);
    if (seen.size > seenLimit) seen.delete(seen.values().next().value as string);
  };

  return {
    async enqueue(messages) {
      for (const message of messages) {
        const id = `${message.channel}:${message.externalMessageId}`;
        if (seen.has(id)) continue;
        remember(id);
        const key = `${message.channel}:${message.externalUserId}`;
        const next = (chains.get(key) ?? Promise.resolve())
          .then(() => handler(message))
          .catch((error) => onError(error, message));
        chains.set(key, next);
        void next.then(() => {
          if (chains.get(key) === next) chains.delete(key);
        });
      }
    },
    async idle() {
      while (chains.size) await Promise.all([...chains.values()]);
    },
  };
}
