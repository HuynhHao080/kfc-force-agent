"use client";
import { useEffect, useRef, useState } from "react";

interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult:
    | ((event: {
        results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
      }) => void)
    | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type VoiceWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};

export function useVoiceInput(
  value: string,
  onChange: (value: string) => void,
  disabled: boolean,
) {
  const recognition = useRef<Recognition | null>(null);
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState("");
  useEffect(() => {
    if (disabled) recognition.current?.abort();
  }, [disabled]);
  useEffect(() => {
    const stopWhenHidden = () => {
      if (document.hidden) recognition.current?.abort();
    };
    document.addEventListener("visibilitychange", stopWhenHidden);
    return () => {
      document.removeEventListener("visibilitychange", stopWhenHidden);
      const current = recognition.current;
      if (current) {
        current.onresult = null;
        current.onerror = null;
        current.onend = null;
        current.abort();
        recognition.current = null;
      }
    };
  }, []);
  const toggle = () => {
    if (disabled) return;
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const browser = window as VoiceWindow;
    const Constructor =
      browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (!Constructor || !window.isSecureContext) {
      setStatus(
        "Nhận giọng nói cần trình duyệt hỗ trợ và HTTPS hoặc localhost. Bạn có thể nhập tin nhắn ở ô bên cạnh.",
      );
      return;
    }
    const current = new Constructor();
    recognition.current = current;
    current.lang = "vi-VN";
    current.continuous = false;
    current.interimResults = false;
    current.onresult = (event) => {
      const transcript = Array.from(event.results)
        .filter((result) => result.isFinal)
        .map((result) => result[0].transcript)
        .join(" ")
        .trim();
      if (!transcript) return;
      onChange(
        [value.trim(), transcript].filter(Boolean).join(" ").slice(0, 1000),
      );
      setStatus("Đã điền lời nói. Bạn có thể sửa lại rồi bấm gửi.");
    };
    current.onerror = (event) => {
      setListening(false);
      const errors: Record<string, string> = {
        "not-allowed":
          "Micro chưa được cấp quyền. Hãy cho phép micro trong trình duyệt rồi thử lại.",
        "service-not-allowed":
          "Dịch vụ nhận giọng nói chưa được trình duyệt cho phép.",
        "audio-capture":
          "Chưa tìm thấy micro hoạt động. Hãy kiểm tra thiết bị.",
        "no-speech": "Mình chưa nghe rõ. Bấm micro để nói lại nhé.",
        network:
          "Dịch vụ nhận giọng nói chưa kết nối được. Bạn có thể nhập tin nhắn.",
        "language-not-supported":
          "Trình duyệt chưa hỗ trợ nhận giọng nói tiếng Việt.",
      };
      setStatus(
        errors[event.error] ??
          "Nhận giọng nói đã dừng. Bạn có thể nhập tin nhắn hoặc thử lại.",
      );
    };
    current.onend = () => {
      if (recognition.current !== current) return;
      setListening(false);
      setStatus(previous => previous.startsWith("Đang nghe") ? "Đã dừng nghe. Bấm micro để nói tiếp." : previous);
      recognition.current = null;
    };
    try {
      current.start();
      setListening(true);
      setStatus(
        "Đang nghe tiếng Việt… Nhận dạng có thể dùng dịch vụ của trình duyệt.",
      );
    } catch {
      recognition.current = null;
      setListening(false);
      setStatus("Chưa bật được micro. Kiểm tra quyền micro rồi thử lại.");
    }
  };
  return { listening, status, toggle };
}
