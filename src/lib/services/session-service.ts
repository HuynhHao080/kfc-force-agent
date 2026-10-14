import { SessionRepository } from "@/lib/db/repositories/interfaces/session-repository.interface";
import { Session, Message, ConversationContext } from "@/lib/types/session";

export class SessionService {
  constructor(private sessionRepository: SessionRepository) {}

  async createSession(session: Session): Promise<void> {
    await this.sessionRepository.createSession(session);
  }

  async getSession(sessionId: string): Promise<Session | null> {
    return this.sessionRepository.getSession(sessionId);
  }

  async getActiveSession(userId: string): Promise<Session | null> {
    return this.sessionRepository.getActiveSession(userId);
  }

  async appendMessage(message: Message): Promise<void> {
    await this.sessionRepository.appendMessage(message);
  }

  async getMessages(sessionId: string): Promise<Message[]> {
    return this.sessionRepository.getMessages(sessionId);
  }

  async getConversationContext(sessionId: string): Promise<ConversationContext | null> {
    return this.sessionRepository.getConversationContext(sessionId);
  }

  async saveConversationContext(context: ConversationContext): Promise<void> {
    await this.sessionRepository.saveConversationContext(context);
  }
}
