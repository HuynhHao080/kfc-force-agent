"use client";
import { useEffect, useRef, useState } from "react";
let activeUtterance: SpeechSynthesisUtterance | null = null;

export function ReadAloud({ content }: { content: string }) {
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState("");
  useEffect(
    () => () => {
      if (utterance.current && activeUtterance === utterance.current) {
        utterance.current.onend = null;
        utterance.current.onerror = null;
        window.speechSynthesis?.cancel();
        activeUtterance = null;
      }
    },
    [],
  );
  const toggle = () => {
    if (
      !("speechSynthesis" in window) ||
      !("SpeechSynthesisUtterance" in window)
    ) {
      setError("Trình duyệt chưa hỗ trợ đọc câu trả lời.");
      return;
    }
    if (speaking && activeUtterance === utterance.current) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel();
    const next = new SpeechSynthesisUtterance(
      content.replace(/https:\/\/\S+/g, "liên kết KFC").slice(0, 2000),
    );
    next.lang = "vi-VN";
    next.rate = 1;
    const voice = window.speechSynthesis
      .getVoices()
      .find((voice) => voice.lang.toLowerCase().startsWith("vi"));
    if (voice) next.voice = voice;
    next.onend = () => {
      setSpeaking(false);
      if (activeUtterance === next) activeUtterance = null;
    };
    next.onerror = (event) => {
      setSpeaking(false);
      if (!["canceled", "interrupted"].includes(event.error))
        setError(
          "Chưa đọc được câu trả lời. Giọng Việt phụ thuộc trình duyệt và thiết bị.",
        );
      if (activeUtterance === next) activeUtterance = null;
    };
    utterance.current = next;
    activeUtterance = next;
    setError("");
    setSpeaking(true);
    try {
      window.speechSynthesis.speak(next);
    } catch {
      activeUtterance = null;
      setSpeaking(false);
      setError("Chưa bật được giọng đọc trên thiết bị này.");
    }
  };
  return (
    <div className="chat-audio">
      <button
        type="button"
        aria-label={speaking ? "Dừng đọc câu trả lời" : "Đọc câu trả lời"}
        aria-pressed={speaking}
        onClick={toggle}
      >
        {speaking ? "■ Dừng đọc" : "♫ Nghe trả lời"}
      </button>
      {error && <span role="status">{error}</span>}
    </div>
  );
}
