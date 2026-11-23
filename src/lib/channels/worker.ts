import type { ChannelStateService } from "./state-service";
import type { ConversationState, InboundMessage, OutboundMessage } from "./types";
import type { ChannelCommercePort } from "./commerce";
import type { TranscriptPort } from "./transcript";
import { cancelCheckout, checkoutText, chooseFulfillment, placeOrder, startCheckout, useProfileName, type FlowContext, type FlowResult } from "./checkout-flow";
import { parseButton, proposalMessage, withCheckoutButton } from "./messages";
import { maskWaId } from "./whatsapp/identity";
import { UNSUPPORTED_REPLY } from "./whatsapp/replies";

/** Giới hạn tin nhắn của ChatService (chatRequestSchema). */
export const MAX_TURN_TEXT = 1000;

export const AGENT_ERROR_REPLY: OutboundMessage = {
  kind: "text",
  text: "Xin lỗi, mình đang gặp sự cố nên chưa trả lời được. Bạn nhắn lại sau ít phút giúp mình nhé.",
};

const STALE_BUTTON_REPLY: OutboundMessage = { kind: "text", text: "Nút này không còn dùng được. Bạn nhắn yêu cầu bằng chữ giúp mình nhé." };

/**
 * Cổng gọi agent: local gọi ChatService, AWS gọi AgentCore Runtime. Cùng pipeline agent → policy → xác nhận → tool.
 * `confirm` chỉ được đặt khi khách bấm đúng nút xác nhận; gõ chữ "xác nhận" không bao giờ thành `confirm`.
 */
export interface ChannelChatPort {
  chat(input: { userId: string; message: string; confirm?: boolean; confirmationId?: string }): Promise<{
    reply: string;
    pendingConfirmation?: { id: string; summary: string[] } | null;
  }>;
}

export interface ChannelSenderPort {
  send(to: string, message: OutboundMessage): Promise<{ ok: boolean }>;
}

export type TurnOutcome = "replied" | "checkout" | "unsupported" | "human" | "ignored" | "agent_error" | "send_failed";

export interface ChannelWorkerDeps {
  /** externalUserId → userId nội bộ (identity.ts). */
  customerId(externalUserId: string): string;
  states: Pick<ChannelStateService, "recordInbound" | "update">;
  agent: ChannelChatPort;
  commerce: ChannelCommercePort;
  sender: ChannelSenderPort;
  /** Khoá theo khách (local: withUserLock, như route web). Trên AWS, SQS FIFO đã tuần tự theo khách. */
  lock?: <T>(key: string, run: () => Promise<T>) => Promise<T>;
  /** Lưu tin của khách khi nhân viên đang tiếp quản (agent không chạy nên ChatService không lưu). */
  transcript?: Pick<TranscriptPort, "append">;
  now?: () => Date;
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
 * Worker xử lý một lượt của một khách:
 * 1. ghi nhận trạng thái; nhân viên đang tiếp quản (HUMAN) thì AI im lặng;
 * 2. tin chữ: nếu đang ở bước nhập tên/số điện thoại/địa chỉ của chốt đơn thì dùng cho bước đó, không thì gửi agent;
 * 3. nút bấm: xác nhận/bỏ qua đề xuất (luồng xác nhận hiện có), các bước chốt đơn, "Đặt đơn".
 * Không bao giờ im lặng với khách: lỗi thì gửi câu xin lỗi. Log chỉ có kết quả và số đã che.
 */
export function createChannelWorker(deps: ChannelWorkerDeps) {
  const lock = deps.lock ?? (<T>(_key: string, run: () => Promise<T>) => run());

  /** Gọi agent; đề xuất đang chờ thì gửi kèm nút xác nhận, giỏ có món thì kèm nút "Chốt đơn". */
  async function agentTurn(userId: string, input: { message: string; confirm?: boolean; confirmationId?: string }) {
    try {
      const result = await deps.agent.chat({ userId, ...input });
      if (!result.reply.trim()) return { reply: AGENT_ERROR_REPLY, outcome: "agent_error" as const };
      if (result.pendingConfirmation) return { reply: proposalMessage(result.reply, result.pendingConfirmation), outcome: "replied" as const };
      const cart = await deps.commerce.cart(userId);
      return { reply: cart ? withCheckoutButton(result.reply) : { kind: "text" as const, text: result.reply }, outcome: "replied" as const };
    } catch (error) {
      console.error("channel_agent_failed", error instanceof Error ? error.name : "unknown");
      return { reply: AGENT_ERROR_REPLY, outcome: "agent_error" as const };
    }
  }

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
        let state: ConversationState = await deps.states.recordInbound({
          channel: first.channel, customerId: userId, externalUserId: first.externalUserId, receivedAt,
          ...(profileName ? { profileName } : {}),
        });
        // Nhân viên đang tiếp quản: AI không trả lời, không chạy nút bấm; tin của khách được lưu để nhân viên đọc.
        if (state.mode === "HUMAN") {
          const text = mergeTurnText(messages);
          const pressed = messages.filter((message) => message.kind !== "text").map((message) =>
            message.kind === "unsupported" ? "[Khách gửi nội dung chưa hỗ trợ: ảnh, sticker…]" : `[Khách bấm nút: ${message.text ?? message.replyId}]`);
          const content = [text, ...pressed].filter(Boolean).join("\n");
          if (content) await deps.transcript?.append(userId, { role: "user", content });
          return "human";
        }

        const replies: OutboundMessage[] = [];
        let outcome: TurnOutcome = "ignored";
        const context = (): FlowContext => ({ userId, state, commerce: deps.commerce, ...(deps.now ? { now: deps.now } : {}) });
        const apply = async (result: FlowResult) => {
          const patch = result.patch;
          if (patch) state = await deps.states.update(first.channel, userId, () => patch);
          replies.push(...result.replies);
          outcome = outcome === "agent_error" ? outcome : "checkout";
        };

        try {
          const text = mergeTurnText(messages);
          if (text) {
            const consumed = await checkoutText(context(), text);
            if (consumed) await apply(consumed);
            else {
              const turn = await agentTurn(userId, { message: text });
              replies.push(turn.reply);
              outcome = turn.outcome;
            }
          }
          // Nút bấm sau cùng của lượt (debounce gửi nút ngay, nên thường chỉ có một).
          const pressed = [...messages].reverse().find((message) => message.kind === "button_reply" || message.kind === "list_reply");
          if (pressed) {
            const action = parseButton(pressed.replyId);
            if (!action) {
              replies.push(STALE_BUTTON_REPLY);
              outcome = outcome === "ignored" ? "unsupported" : outcome;
            } else if (action.kind === "confirm") {
              // Đúng luồng xác nhận của web: kiểm id, hạn, chữ ký giỏ và giá trước khi thực thi.
              const turn = await agentTurn(userId, { message: "Xác nhận", confirm: true, confirmationId: action.id });
              replies.push(turn.reply);
              outcome = turn.outcome;
            } else if (action.kind === "skip") {
              const result = await deps.commerce.skipProposal(userId, action.id);
              const pending = result === "changed" ? await deps.commerce.pendingConfirmation(userId) : null;
              if (pending) replies.push(proposalMessage("Đề xuất đã thay đổi, đây là đề xuất mới nhất:", pending));
              else {
                const message = result === "skipped" ? "Đã bỏ qua đề xuất, giỏ hàng giữ nguyên." : "Không có đề xuất nào đang chờ.";
                replies.push((await deps.commerce.cart(userId)) ? withCheckoutButton(message) : { kind: "text", text: message });
              }
              outcome = "replied";
            } else if (action.kind === "checkout") await apply(await startCheckout(context()));
            else if (action.kind === "cancelCheckout") await apply(cancelCheckout());
            else if (action.kind === "fulfillment") await apply(await chooseFulfillment(context(), action.value));
            else if (action.kind === "profileName") await apply(await useProfileName(context()));
            else if (action.kind === "order") await apply(await placeOrder(context(), action.token));
          }
          if (!replies.length && messages.some((message) => message.kind === "unsupported")) {
            replies.push(UNSUPPORTED_REPLY);
            outcome = "unsupported";
          }
        } catch (error) {
          // Lỗi ngoài dự kiến của bước chốt đơn/giỏ: báo khách thay vì im lặng.
          console.error("channel_turn_step_failed", error instanceof Error ? error.name : "unknown");
          replies.push(AGENT_ERROR_REPLY);
          outcome = "agent_error";
        }
        if (!replies.length) return "ignored";

        for (const reply of replies) {
          let delivered = false;
          try {
            delivered = (await deps.sender.send(first.externalUserId, reply)).ok;
          } catch (error) {
            console.error("channel_send_failed", error instanceof Error ? error.name : "unknown");
          }
          if (!delivered) {
            console.error("channel_reply_not_delivered", JSON.stringify({ outcome, to: maskWaId(first.externalUserId) }));
            return "send_failed";
          }
        }
        return outcome;
      });
    },
  };
}

export type ChannelWorker = ReturnType<typeof createChannelWorker>;
