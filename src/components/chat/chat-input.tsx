"use client";
interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
}
export function ChatInput({
  value,
  onChange,
  onSend,
  disabled,
}: ChatInputProps) {
  return (
    <form
      className="chat-input"
      onSubmit={(event) => {
        event.preventDefault();
        onSend();
      }}
    >
      <label htmlFor="assistant-message" className="sr-only">
        Tin nhắn cho trợ lý
      </label>
      <input
        id="assistant-message"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={1000}
        placeholder="Hôm nay ăn gì nhỉ?"
        disabled={disabled}
        autoComplete="off"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        aria-label="Gửi tin nhắn"
      >
        ↑
      </button>
    </form>
  );
}
