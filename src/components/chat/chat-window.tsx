"use client";
import { useEffect, useRef, useState } from "react";
import { ChatInput } from "./chat-input";
import { ChatMessage } from "./chat-message";
import type { ChatTurn } from "@/lib/storefront-types";
interface ChatWindowProps {
  inputId?: string;
  messages: ChatTurn[];
  onChooseProduct?: (id: string) => void;
  onViewProduct?: (id: string) => void;
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  disabled?: boolean;
  readOnlyLlm?: boolean;
}
export function ChatWindow({
  inputId,
  messages,
  onSendMessage,
  isLoading,
  disabled = false,
  onChooseProduct,
  onViewProduct,
  readOnlyLlm = false,
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
          <ChatMessage
            key={index}
            {...message}
            disabled={disabled || isLoading}
            onChooseProduct={onChooseProduct}
            onViewProduct={onViewProduct}
          />
        ))}
        {isLoading && (
          <p className="typing-status" role="status">
            Trợ lý đang trả lời<span aria-hidden="true"> ···</span>
          </p>
        )}
      </div>
      <ChatInput
        id={inputId}
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
        {readOnlyLlm ? (
          <p>
            Bạn có thể hỏi menu, xem giỏ hoặc nhờ gợi ý món theo ngân sách và số
            người bằng cách nói tự nhiên. Chat hiện chỉ tư vấn; dùng nút trên giao
            diện để thay đổi giỏ và xác nhận đặt hàng.
          </p>
        ) : (<>
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
        </>)}
      </details>
    </div>
  );
}
