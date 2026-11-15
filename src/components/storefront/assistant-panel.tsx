"use client";

import type { PendingConfirmation } from "@/lib/agent/confirmation";
import type { ChatTurn } from "@/lib/storefront-types";
import { ChatWindow } from "@/components/chat/chat-window";

export function AssistantPanel({
  id,
  messages,
  pending,
  busy,
  disabled,
  onSend,
  onConfirm,
  onDismiss,
  onClose,
  onChooseProduct,
  onViewProduct,
}: {
  id: string;
  messages: ChatTurn[];
  pending: PendingConfirmation | null;
  busy: boolean;
  disabled: boolean;
  onSend: (message: string) => void;
  onConfirm: () => void;
  onDismiss: () => void;
  onClose?: () => void;
  onChooseProduct?: (id: string) => void;
  onViewProduct?: (id: string) => void;
}) {
  return (
    <section
      id={id}
      className="panel assistant-panel"
      aria-labelledby={`${id}-title`}
      tabIndex={-1}
    >
      <div className="assistant-heading">
        <span className="assistant-avatar" aria-hidden="true">
          ✦
        </span>
        <div>
          <h2 id={`${id}-title`}>Trợ lý chọn món</h2>
          <p>
            {busy ? "Đang xử lý yêu cầu…" : "Hỏi bằng chữ hoặc giọng nói"}
          </p>
        </div>
        {onClose ? (
          <button
            type="button"
            className="icon-button"
            aria-label="Đóng trợ lý"
            onClick={onClose}
          >
            ×
          </button>
        ) : (
          <span className="green-dot" aria-hidden="true" />
        )}
      </div>
      <ChatWindow
        inputId={`${id}-message`}
        messages={messages}
        onSendMessage={onSend}
        isLoading={busy}
        disabled={disabled}
        onChooseProduct={onChooseProduct}
        onViewProduct={onViewProduct}
      />
      {pending && (
        <div className="pending-action">
          <p>Thay đổi đang chờ bạn xác nhận</p>
          <ul>
            {pending.summary.map((line, index) => (
              <li key={index}>{line}</li>
            ))}
          </ul>
          <p className="small muted">
            Có hiệu lực đến{" "}
            {new Intl.DateTimeFormat("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Asia/Ho_Chi_Minh",
            }).format(new Date(pending.expiresAt))}
          </p>
          <div>
            <button
              className="button primary"
              disabled={disabled}
              onClick={onConfirm}
            >
              Xác nhận thao tác
            </button>
            <button
              className="text-button"
              disabled={disabled}
              onClick={onDismiss}
            >
              Bỏ qua
            </button>
          </div>
        </div>
      )}
      <div className="quick-prompts">
        <button
          disabled={disabled}
          onClick={() => onSend("Cho mình xem thực đơn")}
        >
          Xem thực đơn ↗
        </button>
        <button disabled={disabled} onClick={() => onSend("Xem giỏ hàng")}>
          Kiểm tra giỏ ↗
        </button>
      </div>
    </section>
  );
}
