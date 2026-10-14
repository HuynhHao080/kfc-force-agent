export interface Session {
  id: string;
  userId: string;
  platform: "web" | "mobile";
  status: "ACTIVE" | "INACTIVE" | "EXPIRED";
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

export interface ConversationContext {
  sessionId: string;
  context: Record<string, unknown>;
  updatedAt: string;
}
