import { SessionService } from "@/lib/services/session-service";
import { Message, Session } from "@/lib/types/session";
import { agentCore, persistConversation } from "@/lib/agent/agent-core";
import { ChatRequest, ChatResponse } from "@/lib/types/domain";

export class ChatService {
  constructor(private sessionService: SessionService) {}

  async processChat(request: ChatRequest): Promise<ChatResponse> {
    // 1. Find or create the customer's active session
    let session = await this.sessionService.getActiveSession(request.userId);
    if (!session) {
      const platform: Session["platform"] =
        request.platform === "mobile" ? "mobile" : "web";
      session = {
        id: `session_${Date.now()}_${request.userId}`,
        userId: request.userId,
        platform,
        status: "ACTIVE",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await this.sessionService.createSession(session);
    }

    // 2. Persist the user message
    const userMessage: Message = {
      id: `msg_${Date.now()}_user`,
      sessionId: session.id,
      role: "user",
      content: request.message,
      createdAt: new Date().toISOString(),
    };
    await this.sessionService.appendMessage(userMessage);

    // 3. Run the agent (LLM -> policy -> tools); it never mutates state itself
    //    beyond the deterministic tools it is explicitly allowed to call.
    const agentResult = await agentCore({
      platform: request.platform,
      userId: request.userId,
      sessionId: session.id,
      message: request.message,
      confirm: request.confirm === true,
    });

    // 4. Persist the assistant message
    const assistantMessage: Message = {
      id: `msg_${Date.now()}_assistant`,
      sessionId: session.id,
      role: "assistant",
      content: agentResult.reply,
      createdAt: new Date().toISOString(),
    };
    await this.sessionService.appendMessage(assistantMessage);

    // 5. Persist conversation turns for the next request's context
    await persistConversation(session.id, [
      { role: "user", content: request.message },
      { role: "assistant", content: agentResult.reply },
    ]);

    // 6. Return the structured response
    return {
      reply: agentResult.reply,
      sessionId: agentResult.sessionId,
      actions: agentResult.actions,
      requiresConfirmation: agentResult.requiresConfirmation,
      execution: agentResult.execution,
    };
  }
}

