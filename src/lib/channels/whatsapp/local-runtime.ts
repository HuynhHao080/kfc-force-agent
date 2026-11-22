import { createLocalInboundQueue, type LocalInboundQueue } from "../queue";
import { createTurnDebouncer } from "../debounce";
import { createChannelWorker, type ChannelWorkerDeps } from "../worker";
import { channelUserId } from "./identity";
import { createWhatsAppSender } from "./sender";
import type { WhatsAppConfig } from "./config";

export interface LocalWhatsAppRuntime {
  queue: LocalInboundQueue;
  /** Gửi ngay các cụm tin đang chờ gộp và đợi xử lý xong (test, tắt tiến trình). */
  drain(): Promise<void>;
}

const shared = globalThis as typeof globalThis & { kfcWhatsAppLocalRuntime?: LocalWhatsAppRuntime };

/**
 * Runtime local cho cổng Next.js (một tiến trình): hàng đợi trong tiến trình → gộp tin liên tiếp → worker →
 * ChatService (cùng pipeline với web, khoá theo khách như route web) → gửi trả lời qua Graph API.
 * Thiếu cấu hình gửi tin hoặc CHANNEL_ID_SECRET thì trả null để route từ chối (503) thay vì nhận tin rồi im lặng.
 */
export function localWhatsAppRuntime(
  config: WhatsAppConfig,
  env: Record<string, string | undefined> = process.env,
): LocalWhatsAppRuntime | null {
  if (shared.kfcWhatsAppLocalRuntime) return shared.kfcWhatsAppLocalRuntime;
  const secret = env.CHANNEL_ID_SECRET?.trim();
  if (!secret || secret.length < 32 || !config.accessToken || !config.phoneNumberId || !config.graphVersion) return null;
  const sender = createWhatsAppSender({ accessToken: config.accessToken, phoneNumberId: config.phoneNumberId, graphVersion: config.graphVersion });
  const debounceMs = Number(env.CHANNEL_DEBOUNCE_MS ?? 2500);

  const deps: ChannelWorkerDeps = {
    customerId: (waId) => channelUserId(waId, secret),
    // Nạp service container khi có tin đầu tiên, không phải lúc import route.
    states: {
      recordInbound: async (input) => (await import("@/lib/agent/agent-core")).services.channelStateService.recordInbound(input),
    },
    agent: {
      async chat({ userId, message }) {
        const [{ services }, { chatRequestSchema }] = await Promise.all([import("@/lib/agent/agent-core"), import("@/lib/validation/chat")]);
        // Cùng khoá phiên với route web và AgentCore: chat_<userId>.
        const request = chatRequestSchema.parse({ platform: "whatsapp", userId, sessionId: `chat_${userId}`, message });
        return services.chatService.processChat(request);
      },
    },
    sender,
    lock: async (key, run) => (await import("@/lib/server/user-lock")).withUserLock(key, run),
  };
  const worker = createChannelWorker(deps);
  const debouncer = createTurnDebouncer((batch) => worker.handleTurn(batch), {
    windowMs: Number.isFinite(debounceMs) && debounceMs >= 0 && debounceMs <= 10_000 ? debounceMs : 2500,
  });
  const queue = createLocalInboundQueue(async (message) => debouncer.push(message));
  shared.kfcWhatsAppLocalRuntime = {
    queue,
    async drain() {
      await queue.idle();
      await debouncer.flushAll();
    },
  };
  return shared.kfcWhatsAppLocalRuntime;
}
