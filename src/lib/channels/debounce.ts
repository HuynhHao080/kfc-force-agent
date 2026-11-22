import type { InboundMessage } from "./types";

interface Pending {
  buffer: InboundMessage[];
  timer: ReturnType<typeof setTimeout> | null;
  firstAt: number;
  chain: Promise<void>;
}

/**
 * Gộp tin liên tiếp của cùng một khách (local). Mỗi tin chữ đặt lại hẹn giờ `windowMs`; hết hẹn giờ hoặc đã chờ
 * quá `maxWaitMs` thì gửi cả cụm thành một lượt. Tin không phải chữ (nút, ảnh) gửi ngay cùng phần đang chờ.
 * Các lượt của một khách chạy nối tiếp nhau, khách khác nhau chạy song song.
 * Trên AWS, việc gộp do lô tin SQS FIFO đảm nhận (worker Lambda).
 */
export function createTurnDebouncer(
  handleTurn: (messages: InboundMessage[]) => Promise<unknown>,
  options: { windowMs?: number; maxWaitMs?: number; onError?: (error: unknown) => void; now?: () => number } = {},
) {
  const windowMs = options.windowMs ?? 2500;
  const maxWaitMs = options.maxWaitMs ?? 8000;
  const now = options.now ?? Date.now;
  const onError = options.onError ?? ((error: unknown) => console.error("channel_turn_failed", error instanceof Error ? error.name : "unknown"));
  const pending = new Map<string, Pending>();

  const flush = (key: string) => {
    const entry = pending.get(key);
    if (!entry || !entry.buffer.length) return;
    if (entry.timer) clearTimeout(entry.timer);
    entry.timer = null;
    const batch = entry.buffer.splice(0);
    entry.chain = entry.chain.then(() => handleTurn(batch)).then(() => undefined, onError);
    const settled = entry.chain;
    void settled.then(() => {
      const current = pending.get(key);
      if (current && current.chain === settled && !current.buffer.length && !current.timer) pending.delete(key);
    });
  };

  return {
    push(message: InboundMessage) {
      const key = `${message.channel}:${message.externalUserId}`;
      const entry = pending.get(key) ?? { buffer: [], timer: null, firstAt: now(), chain: Promise.resolve() };
      if (!entry.buffer.length) entry.firstAt = now();
      entry.buffer.push(message);
      pending.set(key, entry);
      if (entry.timer) clearTimeout(entry.timer);
      entry.timer = null;
      if (message.kind !== "text" || now() - entry.firstAt >= maxWaitMs) flush(key);
      else entry.timer = setTimeout(() => flush(key), windowMs);
    },
    /** Gửi ngay mọi cụm đang chờ và đợi các lượt xong (test, tắt tiến trình). */
    async flushAll() {
      for (const key of [...pending.keys()]) flush(key);
      while (pending.size) await Promise.all([...pending.values()].map((entry) => entry.chain));
    },
  };
}
