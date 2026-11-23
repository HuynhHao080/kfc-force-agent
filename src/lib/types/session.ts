export interface Session {
  id: string;
  userId: string;
  platform: "web" | "mobile" | "whatsapp";
  status: "ACTIVE" | "INACTIVE" | "EXPIRED";
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  productIds?: string[];
  /** "staff": tin nhân viên gửi khi tiếp quản hội thoại (role assistant). Không có = AI hoặc khách. */
  sender?: "staff";
  createdAt: string;
}

export interface ConversationContext {
  sessionId: string;
  context: Record<string, unknown>;
  updatedAt: string;
}
