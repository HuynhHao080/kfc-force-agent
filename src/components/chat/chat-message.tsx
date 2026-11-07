interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
}
export function ChatMessage({ role, content }: ChatMessageProps) {
  return (
    <div className={`chat-message ${role}`}>
      <span className="sr-only">{role === "user" ? "Bạn" : "Trợ lý"}: </span>
      {content}
    </div>
  );
}
