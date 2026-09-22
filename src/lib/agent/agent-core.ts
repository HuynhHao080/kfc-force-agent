import { ChatRequest, ChatResponse } from "@/lib/types/domain";
import { processChat } from "@/lib/services/chat-service";

export async function agentCore(request: ChatRequest): Promise<ChatResponse> {
  return processChat(request);
}
