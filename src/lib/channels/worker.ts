import type { ChannelStateService } from "./state-service";
import type { InboundMessage, OutboundMessage } from "./types";
import { maskWaId } from "./whatsapp/identity";
import { UNSUPPORTED_REPLY } from "./whatsapp/replies";

/** Giới hạn tin nhắn của ChatService (chatRequestSchema). */
export const MAX_TURN_TEXT = 1000;

export const AGENT_ERROR_REPLY: OutboundMessage = {
  kind: "text",
  text: "Xin lỗi, mình đang gặp sự cố nên chưa trả lời được. Bạn nhắn lại sau ít phút giúp mình nhé.",
};

/** Cổng gọi agent: local gọi ChatService, AWS gọi AgentCore Runtime. Cùng pipeline agent → policy → xác nhận → tool. */
export interface ChannelChatPort {
  chat(input: { userId: string; message: string }): Promise<{ reply: string }>;
}

export interface ChannelSenderPort {
  send(to: string, message: OutboundMessage): Promise<{ ok: boolean }>;
}

export type TurnOutcome = "replied" | "unsupported" | "human" | "ignored" | "agent_error" | "send_failed";

export interface ChannelWorkerDeps {
  /** externalUserId → userId nội bộ (identity.ts). */
  customerId(externalUserId: string): string;
  states: Pick<ChannelStateService, "recordInbound">;
  agent: ChannelChatPort;
  sender: ChannelSenderPort;
  /** Khoá theo khách (local: withUserLock, như route web). Trên AWS, SQS FIFO đã tuần tự theo khách. */
  lock?: <T>(key: string, run: () => Promise<T>) => Promise<T>;
}

/**
 * Gộp các tin chữ liên tiếp của một khách thành một lượt ("cho 2 gà" / "à 3 đi" / "thêm pepsi").
 * Quá giới hạn thì giữ các tin mới nhất (ý mới nhất của khách); một tin đơn quá dài bị cắt.
 */
export function mergeTurnText(messages: InboundMessage[], max = MAX_TURN_TEXT): string {
  const texts = messages.filter((message) => message.kind === "text").map((message) => message.text?.trim() ?? "").filter(Boolean);
  const kept: string[] = [];
  let length = 0;
  for (let index = texts.length - 1; index >= 0; index--) {
    const added = texts[index].length + (kept.length ? 1 : 0);
    if (length + added > max) break;
    kept.unshift(texts[index]);
    length += added;
  }
  if (!kept.length && texts.length) return texts.at(-1)!.slice(0, max);
  return kept.join("\n");
}

/**
 * Worker xử lý một lượt của một khách: ghi nhận trạng thái → (mode AI) gọi agent với tin đã gộp → gửi trả lời.
 * Không bao giờ im lặng với khách: agent lỗi thì gửi câu xin lỗi; loại tin chưa hỗ trợ thì gửi câu hướng dẫn.
 * Log chỉ có kết quả và số đã che.
 */
export function createChannelWorker(deps: ChannelWorkerDeps) {
  const lock = deps.lock ?? (<T>(_key: string, run: () => Promise<T>) => run());
  return {
    async handleTurn(messages: InboundMessage[]): Promise<TurnOutcome> {
      if (!messages.length) return "ignored";
      const [first] = messages;
      if (messages.some((message) => message.channel !== first.channel || message.externalUserId !== first.externalUserId))
        throw new Error("Một lượt chỉ gồm tin của một khách.");
      const userId = deps.customerId(first.externalUserId);
      return lock(userId, async () => {
        const receivedAt = messages.map((message) => message.receivedAt).sort().at(-1)!;
        const profileName = [...messages].reverse().find((message) => message.profileName)?.profileName;
        const state = await deps.states.recordInbound({
          channel: first.channel, customerId: userId, externalUserId: first.externalUserId, receivedAt,
          ...(profileName ? { profileName } : {}),
        });
        // Nhân viên đang tiếp quản: AI không trả lời (giai đoạn 6 thêm giao diện tiếp quản).
        if (state.mode === "HUMAN") return "human";

        const text = mergeTurnText(messages);
        let outcome: TurnOutcome;
        let reply: OutboundMessage;
        if (text) {
          try {
            const result = await deps.agent.chat({ userId, message: text });
            reply = result.reply.trim() ? { kind: "text", text: result.reply } : AGENT_ERROR_REPLY;
            outcome = result.reply.trim() ? "replied" : "agent_error";
          } catch (error) {
            console.error("channel_agent_failed", error instanceof Error ? error.name : "unknown");
            reply = AGENT_ERROR_REPLY;
            outcome = "agent_error";
          }
        } else if (messages.some((message) => message.kind !== "text")) {
          // Ảnh, sticker…; nút/danh sách chưa được dùng trước giai đoạn 4.
          reply = UNSUPPORTED_REPLY;
          outcome = "unsupported";
        } else {
          return "ignored";
        }
        try {
          const sent = await deps.sender.send(first.externalUserId, reply);
          if (sent.ok) return outcome;
        } catch (error) {
          console.error("channel_send_failed", error instanceof Error ? error.name : "unknown");
        }
        console.error("channel_reply_not_delivered", JSON.stringify({ outcome, to: maskWaId(first.externalUserId) }));
        return "send_failed";
      });
    },
  };
}

export type ChannelWorker = ReturnType<typeof createChannelWorker>;
