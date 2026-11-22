import type { ChannelId, ConversationState } from "@/lib/channels/types";

export interface ChannelRepository {
  getConversationState(channel: ChannelId, customerId: string): Promise<ConversationState | null>;
  /**
   * Ghi có điều kiện (compare-and-set): `expectedRevision` null nghĩa là chưa có bản ghi;
   * khác revision đang lưu thì ném DomainError "CHANNEL_STATE_CHANGED" (409) và không ghi.
   */
  saveConversationState(state: ConversationState, expectedRevision: string | null): Promise<void>;
}
