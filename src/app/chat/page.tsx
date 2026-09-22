"use client";

import { useState, useCallback } from "react";
import { ChatWindow } from "@/components/chat/chat-window";

export default function ChatPage() {
  const [messages, setMessages] = useState<
    Array<{ role: "user" | "assistant"; content: string }>
  >([
    {
      role: "assistant",
      content: "Xin chào! Mình có thể giúp bạn đặt món KFC 🍗 Bạn muốn gọi món gì?",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(
    async (text: string) => {
      const userMsg = text;
      setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
      setIsLoading(true);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            platform: "web",
            userId: "user_demo",
            sessionId: "session_demo",
            message: userMsg,
          }),
        });

        const data = await response.json();

        if (data.reply) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: data.reply },
          ]);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Có lỗi xảy ra. Vui lòng thử lại.",
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="bg-blue-600 text-white px-6 py-4 shadow-md">
        <h1 className="text-xl font-bold">🍗 KFC Force Agent</h1>
        <p className="text-sm opacity-90">Hệ thống đặt món KFC thông minh</p>
      </header>
      <ChatWindow
        messages={messages}
        onSendMessage={sendMessage}
        isLoading={isLoading}
      />
    </div>
  );
}
