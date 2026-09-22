"use client";

import { useEffect, useRef, useState } from "react";
import { ChatMessage } from "./chat-message";
import { ChatInput } from "./chat-input";

interface ChatWindowProps {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  onSendMessage: (message: string) => void;
  isLoading: boolean;
}

export function ChatWindow({ messages, onSendMessage, isLoading }: ChatWindowProps) {
  const [inputValue, setInputValue] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!inputValue.trim() || isLoading) return;
    onSendMessage(inputValue.trim());
    setInputValue("");
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-20">
            <p className="text-lg">🍗 Xin chào! Mình có thể giúp bạn đặt món KFC</p>
            <p className="text-sm mt-2">Hãy thử nói: &ldquo;Cho mình 2 combo gà cay&rdquo;</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <ChatMessage key={i} role={msg.role} content={msg.content} />
        ))}
        {isLoading && (
          <div className="flex justify-start mb-3">
            <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3 text-sm text-gray-600">
              Đang xử lý...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <ChatInput
        value={inputValue}
        onChange={setInputValue}
        onSend={handleSend}
        disabled={isLoading}
      />
    </div>
  );
}
