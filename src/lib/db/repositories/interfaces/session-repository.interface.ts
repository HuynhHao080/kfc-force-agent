import { Session, Message, ConversationContext } from "@/lib/types/session";

export interface SessionRepository {
  createSession(session: Session): Promise<void>;
  getSession(sessionId: string): Promise<Session | null>;
  getActiveSession(userId: string): Promise<Session | null>;
  appendMessage(message: Message): Promise<void>;
  getMessages(sessionId: string): Promise<Message[]>;
  getConversationContext(sessionId: string): Promise<ConversationContext | null>;
  saveConversationContext(context: ConversationContext): Promise<void>;
}
