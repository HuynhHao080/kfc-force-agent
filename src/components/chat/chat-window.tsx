"use client";
import { useEffect, useRef, useState } from "react";
import { ChatInput } from "./chat-input";
import { ChatMessage } from "./chat-message";
interface ChatWindowProps {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  disabled?: boolean;
}
export function ChatWindow({
  messages,
  onSendMessage,
  isLoading,
  disabled = false,
}: ChatWindowProps) {
  const [input, setInput] = useState("");
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [messages, isLoading]);
  return (
    <div className="chat-window">
      <div
        ref={log}
        className="chat-log"
        role="log"
        aria-label="Hội thoại với trợ lý"
        aria-live="polite"
        aria-busy={isLoading}
      >
        {messages.map((message, index) => (
          <ChatMessage key={index} {...message} />
        ))}
        {isLoading && (
          <p className="typing-status" role="status">
            Trợ lý đang trả lời<span aria-hidden="true"> ···</span>
          </p>
        )}
      </div>
      <ChatInput
        value={input}
        onChange={setInput}
        disabled={disabled || isLoading}
        onSend={() => {
          if (input.trim() && !isLoading) {
            onSendMessage(input.trim());
            setInput("");
          }
        }}
      />
      <details className="chat-help">
        <summary>Cách nói với trợ lý</summary>
        <p>
          Nên gửi một món và một thao tác mỗi lần, dùng chữ số hoặc số viết bằng
          chữ rõ ràng.
        </p>
        <ul>
          <li>Thêm hai Pepsi — thêm 2 phần.</li>
          <li>Đổi Pepsi thành ba — đặt số lượng cuối là 3.</li>
          <li>Xoá Pepsi trong giỏ — xoá cả dòng Pepsi.</li>
          <li>Xoá toàn bộ giỏ hàng — xoá mọi món.</li>
        </ul>
        <p>
          Đọc lại món, số lượng và giá rồi bấm xác nhận. Câu tăng/giảm tương đối
          hoặc chưa rõ sẽ cần làm rõ; chữ “ok” không thực thi thay nút xác nhận.
        </p>
      </details>
    </div>
  );
}
