import { randomUUID } from "node:crypto";
import { DomainError } from "@/lib/domain-error";
import type { ChannelRepository } from "@/lib/db/repositories/interfaces/channel-repository.interface";
import { CUSTOMER_SERVICE_WINDOW_MS } from "./order-notifications";
import type { TranscriptEntry, TranscriptPort } from "./transcript";
import type { ChannelId, ConversationState, HandoffEvent } from "./types";
import type { ChannelSenderPort } from "./worker";
import { maskWaId } from "./whatsapp/identity";

const MAX_EVENTS = 20;

/** Thông tin nhân viên cần; số WhatsApp chỉ hiện dạng che. */
export interface ConversationSummary {
  channel: ChannelId;
  customerId: string;
  contact: string;
  profileName?: string;
  mode: "AI" | "HUMAN";
  takenOverBy?: string;
  takenOverAt?: string;
  lastInboundAt: string;
  /** Còn trong 24 giờ kể từ tin gần nhất của khách: WhatsApp chỉ cho nhắn tin thường trong cửa sổ này. */
  withinWindow: boolean;
  revision: string;
}

export interface ConversationDetail {
  conversation: ConversationSummary;
  messages: TranscriptEntry[];
  events: HandoffEvent[];
}

/**
 * Nhân viên tiếp quản hội thoại (giai đoạn 6).
 * - Tiếp quản: mode HUMAN, AI ngừng trả lời; đề xuất giỏ đang chờ bị vô hiệu và bước chốt đơn dở dang bị huỷ.
 * - Trả lại AI: mode AI.
 * - Mọi lần đổi ghi compare-and-set theo revision nhân viên đang thấy: hai người bấm cùng lúc thì chỉ một người thắng.
 * - Nhân viên chỉ nhắn khách khi đang tiếp quản và còn trong cửa sổ 24 giờ.
 */
export class ChannelStaffService {
  constructor(
    private repository: ChannelRepository,
    private deps: { transcript: TranscriptPort; invalidateProposal(userId: string): Promise<void>; now?: () => Date },
  ) {}

  private now() {
    return (this.deps.now ?? (() => new Date()))();
  }

  private summary(state: ConversationState): ConversationSummary {
    return {
      channel: state.channel, customerId: state.customerId, contact: maskWaId(state.externalUserId),
      ...(state.profileName ? { profileName: state.profileName } : {}),
      mode: state.mode,
      ...(state.takenOverBy ? { takenOverBy: state.takenOverBy } : {}),
      ...(state.takenOverAt ? { takenOverAt: state.takenOverAt } : {}),
      lastInboundAt: state.lastInboundAt,
      withinWindow: this.now().getTime() - Date.parse(state.lastInboundAt) <= CUSTOMER_SERVICE_WINDOW_MS,
      revision: state.revision,
    };
  }

  private async current(customerId: string, expectedRevision?: string): Promise<ConversationState> {
    const state = await this.repository.getConversationState("whatsapp", customerId);
    if (!state) throw new DomainError("CONVERSATION_NOT_FOUND", "Không tìm thấy hội thoại.", 404);
    if (expectedRevision !== undefined && state.revision !== expectedRevision)
      throw new DomainError("CHANNEL_STATE_CHANGED", "Hội thoại vừa được cập nhật. Vui lòng tải lại trước khi thao tác.", 409);
    return state;
  }

  private async write(state: ConversationState, change: Partial<ConversationState>, event?: HandoffEvent) {
    const next: ConversationState = {
      ...state, ...change,
      ...(event ? { handoffEvents: [...(state.handoffEvents ?? []), event].slice(-MAX_EVENTS) } : {}),
      updatedAt: this.now().toISOString(), revision: randomUUID(),
    };
    // Cleared fields are removed, not stored as undefined (DynamoDB rejects undefined attributes).
    for (const key of Object.keys(next) as (keyof ConversationState)[]) if (next[key] === undefined) delete next[key];
    await this.repository.saveConversationState(next, state.revision);
    return next;
  }

  async list(limit = 50): Promise<ConversationSummary[]> {
    return (await this.repository.listConversationStates("whatsapp", Math.min(Math.max(limit, 1), 200))).map((state) => this.summary(state));
  }

  async detail(customerId: string): Promise<ConversationDetail> {
    const state = await this.current(customerId);
    return { conversation: this.summary(state), messages: await this.deps.transcript.recent(customerId, 50), events: state.handoffEvents ?? [] };
  }

  async takeOver(customerId: string, staffId: string, expectedRevision: string): Promise<ConversationSummary> {
    const state = await this.current(customerId, expectedRevision);
    if (state.mode === "HUMAN") {
      if (state.takenOverBy === staffId) return this.summary(state);
      throw new DomainError("ALREADY_TAKEN_OVER", "Hội thoại đang do nhân viên khác tiếp quản.", 409);
    }
    const at = this.now().toISOString();
    const next = await this.write(state, { mode: "HUMAN", takenOverBy: staffId, takenOverAt: at, checkout: null }, { type: "TAKEOVER", by: staffId, at });
    // AI không còn trả lời, nên đề xuất AI đang chờ không được để khách bấm xác nhận nữa.
    await this.deps.invalidateProposal(customerId);
    return this.summary(next);
  }

  async release(customerId: string, staffId: string, expectedRevision: string): Promise<ConversationSummary> {
    const state = await this.current(customerId, expectedRevision);
    if (state.mode === "AI") return this.summary(state);
    if (state.takenOverBy !== staffId)
      throw new DomainError("ALREADY_TAKEN_OVER", "Chỉ nhân viên đang tiếp quản mới trả lại AI.", 409);
    const at = this.now().toISOString();
    const next = await this.write(state, { mode: "AI", takenOverBy: undefined, takenOverAt: undefined }, { type: "RELEASE", by: staffId, at });
    return this.summary(next);
  }

  async send(customerId: string, staffId: string, text: string, sender: ChannelSenderPort | null): Promise<ConversationSummary> {
    const message = text.trim();
    if (message.length < 1 || message.length > 1000) throw new DomainError("INVALID_MESSAGE", "Tin nhắn cần từ 1 đến 1000 ký tự.");
    const state = await this.current(customerId);
    if (state.mode !== "HUMAN" || state.takenOverBy !== staffId)
      throw new DomainError("NOT_TAKEN_OVER", "Hãy tiếp quản hội thoại trước khi nhắn khách.", 409);
    const summary = this.summary(state);
    if (!summary.withinWindow)
      throw new DomainError("OUTSIDE_WINDOW", "Đã quá 24 giờ từ tin gần nhất của khách; WhatsApp không cho nhắn tin thường.", 409);
    if (!sender) throw new DomainError("CHANNEL_UNAVAILABLE", "Kênh WhatsApp chưa được cấu hình.", 503);
    const sent = await sender.send(state.externalUserId, { kind: "text", text: message });
    if (!sent.ok) throw new DomainError("SEND_FAILED", "Chưa gửi được tin cho khách. Vui lòng thử lại.", 502);
    await this.deps.transcript.append(customerId, { role: "assistant", content: message, sender: "staff" });
    return summary;
  }
}
