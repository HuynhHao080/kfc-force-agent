import { createLocalInboundQueue, type LocalInboundQueue } from "../queue";
import { createTurnDebouncer } from "../debounce";
import { createChannelWorker, type ChannelSenderPort, type ChannelWorkerDeps } from "../worker";
import { servicesCommercePort } from "../commerce";
import { servicesTranscript } from "../transcript";
import { notifyOrderStatus, type OrderStatusUpdate } from "../order-notifications";
import { channelUserId } from "./identity";
import { createWhatsAppSender } from "./sender";
import type { WhatsAppConfig } from "./config";

export interface LocalWhatsAppRuntime {
  queue: LocalInboundQueue;
  /** Gửi ngay các cụm tin đang chờ gộp và đợi xử lý xong (test, tắt tiến trình). */
  drain(): Promise<void>;
  /** Báo khách WhatsApp khi đơn đổi trạng thái (gọi sau khi admin chuyển trạng thái thành công). */
  notifyOrder(order: OrderStatusUpdate): Promise<string>;
  /** Gửi tin qua Graph API (nhân viên nhắn khách khi tiếp quản). */
  sender: ChannelSenderPort;
}

const shared = globalThis as typeof globalThis & { kfcWhatsAppLocalRuntime?: LocalWhatsAppRuntime };

const services = () => import("@/lib/agent/agent-core").then((module) => module.services);

/**
 * Runtime local cho cổng Next.js (một tiến trình): hàng đợi trong tiến trình → gộp tin liên tiếp → worker →
 * ChatService và các service giỏ/đơn (cùng pipeline với web, khoá theo khách như route web) → gửi qua Graph API.
 * Thiếu cấu hình gửi tin hoặc CHANNEL_ID_SECRET thì trả null để route từ chối (503) thay vì nhận tin rồi im lặng.
 */
export function localWhatsAppRuntime(
  config: WhatsAppConfig,
  env: Record<string, string | undefined> = process.env,
): LocalWhatsAppRuntime | null {
  if (shared.kfcWhatsAppLocalRuntime) return shared.kfcWhatsAppLocalRuntime;
  const secret = env.CHANNEL_ID_SECRET?.trim();
  if (!secret || secret.length < 32 || !config.accessToken || !config.phoneNumberId || !config.graphVersion) return null;
  const sender: ChannelSenderPort = createWhatsAppSender({ accessToken: config.accessToken, phoneNumberId: config.phoneNumberId, graphVersion: config.graphVersion });
  const debounceMs = Number(env.CHANNEL_DEBOUNCE_MS ?? 2500);

  const deps: ChannelWorkerDeps = {
    customerId: (waId) => channelUserId(waId, secret),
    // Nạp service container khi có tin đầu tiên, không phải lúc import route.
    states: {
      recordInbound: async (input) => (await services()).channelStateService.recordInbound(input),
      update: async (channel, customerId, change) => (await services()).channelStateService.update(channel, customerId, change),
    },
    agent: {
      async chat({ userId, message, confirm, confirmationId }) {
        const [container, { chatRequestSchema }] = await Promise.all([services(), import("@/lib/validation/chat")]);
        // Cùng khoá phiên với route web và AgentCore: chat_<userId>. confirm chỉ có khi khách bấm nút xác nhận.
        const request = chatRequestSchema.parse({
          platform: "whatsapp", userId, sessionId: `chat_${userId}`, message,
          ...(confirm ? { confirm: true, confirmationId } : {}),
        });
        return container.chatService.processChat(request);
      },
    },
    commerce: servicesCommercePort(),
    transcript: servicesTranscript(),
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
    sender,
    async drain() {
      await queue.idle();
      await debouncer.flushAll();
    },
    async notifyOrder(order) {
      return notifyOrderStatus({ states: (await services()).channelStateService, sender }, order);
    },
  };
  return shared.kfcWhatsAppLocalRuntime;
}
