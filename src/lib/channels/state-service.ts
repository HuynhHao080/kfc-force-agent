import { randomUUID } from "node:crypto";
import { DomainError } from "@/lib/domain-error";
import type { ChannelRepository } from "@/lib/db/repositories/interfaces/channel-repository.interface";
import type { ChannelId, ConversationState } from "./types";

export class ChannelStateService {
  constructor(private repository: ChannelRepository, private now: () => Date = () => new Date()) {}

  get(channel: ChannelId, customerId: string): Promise<ConversationState | null> {
    return this.repository.getConversationState(channel, customerId);
  }

  /**
   * Ghi nhận một lượt tin vào: tạo trạng thái ở tin đầu tiên (mode AI), cập nhật thời điểm tin gần nhất
   * (cửa sổ 24 giờ) và tên hiển thị. Ghi compare-and-set; nếu bản ghi vừa bị đổi (ví dụ nhân viên
   * tiếp quản cùng lúc) thì đọc lại và thử một lần nữa, giữ nguyên mode mới nhất.
   */
  async recordInbound(input: {
    channel: ChannelId;
    customerId: string;
    externalUserId: string;
    receivedAt: string;
    profileName?: string;
  }): Promise<ConversationState> {
    for (let attempt = 0; ; attempt++) {
      const current = await this.repository.getConversationState(input.channel, input.customerId);
      const at = this.now().toISOString();
      const lastInboundAt = current && current.lastInboundAt > input.receivedAt ? current.lastInboundAt : input.receivedAt;
      const next: ConversationState = {
        ...(current ?? { channel: input.channel, customerId: input.customerId, mode: "AI" as const, createdAt: at }),
        externalUserId: input.externalUserId,
        lastInboundAt,
        ...(input.profileName ? { profileName: input.profileName } : {}),
        updatedAt: at,
        revision: randomUUID(),
      };
      try {
        await this.repository.saveConversationState(next, current?.revision ?? null);
        return next;
      } catch (error) {
        if (attempt >= 1 || !(error instanceof DomainError) || error.code !== "CHANNEL_STATE_CHANGED") throw error;
      }
    }
  }
}
