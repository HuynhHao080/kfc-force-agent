"use client";
import { useVoiceInput } from "./use-voice-input";
interface ChatInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
}
export function ChatInput({
  id = "assistant-message",
  value,
  onChange,
  onSend,
  disabled,
}: ChatInputProps) {
  const voice = useVoiceInput(value, onChange, disabled);
  return (
    <>
      <form
        className="chat-input"
        onSubmit={(event) => {
          event.preventDefault();
          onSend();
        }}
      >
        <label htmlFor={id} className="sr-only">
          Tin nhắn cho trợ lý
        </label>
        <input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={1000}
          placeholder="Hôm nay ăn gì nhỉ?"
          disabled={disabled || voice.listening}
          autoComplete="off"
        />
        <button
          type="button"
          className="voice-input-button"
          disabled={disabled}
          aria-pressed={voice.listening}
          aria-label={voice.listening ? "Dừng nghe" : "Nhập bằng giọng nói"}
          onClick={voice.toggle}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <rect x="9" y="2" width="6" height="12" rx="3" />
            <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" />
          </svg>
        </button>
        <button
          type="submit"
          disabled={disabled || voice.listening || !value.trim()}
          aria-label="Gửi tin nhắn"
        >
          ↑
        </button>
      </form>
      {voice.status && (
        <p className="voice-status" role="status">
          {voice.status}
        </p>
      )}
    </>
  );
}
