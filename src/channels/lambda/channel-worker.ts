import { parseInboundMessage } from "@/lib/channels/sqs-queue";
import type { InboundMessage } from "@/lib/channels/types";
import type { ChannelChatPort, ChannelWorker } from "@/lib/channels/worker";

/** Sự kiện SQS gửi tới Lambda, chỉ các trường cần dùng. */
export interface SqsEvent {
  Records: { messageId: string; body: string }[];
}

/** Phản hồi "partial batch" của Lambda: chỉ các tin lỗi được SQS giao lại. */
export interface SqsBatchResponse {
  batchItemFailures: { itemIdentifier: string }[];
}

/**
 * Lambda worker đọc SQS FIFO. Một lô có thể có tin của nhiều khách; tin của cùng khách giữ đúng thứ tự và được
 * gộp thành một lượt (đây là cách gộp tin liên tiếp trên AWS; độ trễ gom tin đặt ở cấu hình queue khi deploy).
 * Khách khác nhau chạy song song. Một khách lỗi (ví dụ DynamoDB) thì toàn bộ tin của khách đó trong lô được báo lỗi
 * để SQS giao lại theo đúng thứ tự; khách khác không bị ảnh hưởng. Body sai cấu trúc bị bỏ qua, không lặp vô hạn.
 */
export function createChannelWorkerHandler(deps: { worker: Pick<ChannelWorker, "handleTurn"> }) {
  return async (event: SqsEvent): Promise<SqsBatchResponse> => {
    const groups = new Map<string, { messages: InboundMessage[]; recordIds: string[] }>();
    for (const record of event.Records ?? []) {
      const message = parseInboundMessage(record.body);
      if (!message) {
        console.error("channel_worker_invalid_message");
        continue;
      }
      const key = `${message.channel}:${message.externalUserId}`;
      const group = groups.get(key) ?? { messages: [], recordIds: [] };
      group.messages.push(message);
      group.recordIds.push(record.messageId);
      groups.set(key, group);
    }
    const failures: { itemIdentifier: string }[] = [];
    await Promise.all([...groups.values()].map(async (group) => {
      try {
        await deps.worker.handleTurn(group.messages);
      } catch (error) {
        console.error("channel_worker_turn_failed", error instanceof Error ? error.name : "unknown");
        failures.push(...group.recordIds.map((itemIdentifier) => ({ itemIdentifier })));
      }
    }));
    return { batchItemFailures: failures };
  };
}

/** Cổng gọi AgentCore Runtime (InvokeAgentRuntime). Lambda truyền hàm gọi thật khi deploy; test truyền bản giả. */
export type AgentCoreInvoke = (payload: { userId: string; message: string; platform: "whatsapp" }) => Promise<unknown>;

/**
 * Agent trên AWS: worker gọi AgentCore Runtime với cùng payload như web (src/agentcore/invocation.ts).
 * Lỗi có kiểm soát của runtime ({status: "error"}) thành exception để worker gửi câu xin lỗi cho khách.
 */
export function agentCoreChatPort(invoke: AgentCoreInvoke): ChannelChatPort {
  return {
    async chat({ userId, message }) {
      const body = await invoke({ userId, message, platform: "whatsapp" }) as { status?: unknown; reply?: unknown } | null;
      if (body?.status !== "success" || typeof body.reply !== "string") throw new Error("AGENTCORE_ERROR");
      return { reply: body.reply };
    },
  };
}
