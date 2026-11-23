/**
 * Lịch sử hội thoại của khách kênh chat (giai đoạn 6). Khi nhân viên tiếp quản, agent không chạy nên
 * ChatService không lưu tin; phần này lưu tin của khách và của nhân viên vào cùng phiên chat, để nhân viên
 * đọc được và để AI biết đã nói gì khi được trả lại.
 */
export interface TranscriptEntry {
  role: "user" | "assistant";
  content: string;
  sender?: "staff";
  createdAt: string;
}

export interface TranscriptPort {
  append(userId: string, entry: { role: "user" | "assistant"; content: string; sender?: "staff" }): Promise<void>;
  recent(userId: string, limit: number): Promise<TranscriptEntry[]>;
}

/** Dùng SessionService của ứng dụng: cùng phiên với ChatService (`getActiveSession(userId)`). */
export function servicesTranscript(): TranscriptPort {
  const load = () => import("@/lib/agent/agent-core");
  return {
    async append(userId, entry) {
      const { services, persistConversation } = await load();
      let session = await services.sessionService.getActiveSession(userId);
      if (!session) {
        const now = new Date().toISOString();
        session = { id: `session_${Date.now()}_${userId}`, userId, platform: "whatsapp", status: "ACTIVE", createdAt: now, updatedAt: now };
        await services.sessionService.createSession(session);
      }
      await services.sessionService.appendMessage({
        id: `msg_${crypto.randomUUID()}_${entry.sender ?? entry.role}`,
        sessionId: session.id, role: entry.role, content: entry.content,
        ...(entry.sender ? { sender: entry.sender } : {}),
        createdAt: new Date().toISOString(),
      });
      // Ngữ cảnh cho AI khi được trả lại hội thoại.
      await persistConversation(session.id, [{ role: entry.role, content: entry.content }]);
    },
    async recent(userId, limit) {
      const { services } = await load();
      const session = await services.sessionService.getActiveSession(userId);
      if (!session) return [];
      const messages = await services.sessionService.getMessages(session.id);
      return messages
        .filter((message) => message.role === "user" || message.role === "assistant")
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .slice(-limit)
        .map((message) => ({
          role: message.role as "user" | "assistant", content: message.content, createdAt: message.createdAt,
          ...(message.sender ? { sender: message.sender } : {}),
        }));
    },
  };
}
