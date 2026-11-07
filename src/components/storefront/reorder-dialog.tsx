"use client";
import { useEffect, useRef } from "react";
import type { ReorderPreview } from "@/lib/types/reorder";
import { money } from "@/lib/storefront-types";
export function ReorderDialog({
  preview,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  preview: ReorderPreview;
  busy: boolean;
  error: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const alert = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  useEffect(() => {
    if (error) alert.current?.focus();
  }, [error]);
  return (
    <dialog
      ref={dialog}
      className="checkout-dialog"
      aria-labelledby="reorder-title"
      onClose={onClose}
      onCancel={(e) => {
        if (busy) e.preventDefault();
      }}
    >
      <div className="section-heading">
        <div>
          <span className="eyebrow">BỮA QUEN, THÊM LẦN NỮA</span>
          <h2 id="reorder-title">
            Đặt lại đơn #{preview.orderId.slice(-8).toUpperCase()}
          </h2>
        </div>
        <button
          className="icon-button"
          aria-label="Đóng đặt lại"
          disabled={busy}
          onClick={() => dialog.current?.close()}
        >
          ×
        </button>
      </div>
      <p className="small muted">
        Món được thêm vào giỏ trống theo giá đang bán. Mã giảm giá, phí giao,
        ghi chú và thông tin nhận hàng cũ không được áp dụng lại. Bạn vẫn phải
        checkout và xác nhận để tạo đơn mới.
      </p>
      <div className="checkout-summary">
        {preview.items.map((item) => (
          <div key={item.menuItemId}>
            <span>
              {item.quantity} × {item.name}
              {(item.unitPrice !== item.previousUnitPrice ||
                item.name !== item.previousName) && (
                <small className="reorder-change">
                  Đơn cũ: {item.previousName} · {money(item.previousUnitPrice)}
                  /phần; hiện tại {money(item.unitPrice)}/phần.
                </small>
              )}
            </span>
            <strong>{money(item.subtotal)}</strong>
          </div>
        ))}
        <div className="total-row">
          <strong>Tiền món theo giá hiện tại</strong>
          <strong>{money(preview.subtotal)}</strong>
        </div>
      </div>
      <p className="small muted">
        Bản xem trước có hiệu lực đến{" "}
        {new Date(preview.expiresAt).toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        })}
        . Nếu giỏ, món hoặc giá thay đổi, hãy đóng và xem lại.
      </p>
      {error && (
        <p ref={alert} tabIndex={-1} role="alert" className="error-box">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => dialog.current?.close()}
        >
          Chưa thêm món
        </button>
        <button className="button primary" disabled={busy} onClick={onConfirm}>
          {busy ? "Đang thêm vào giỏ…" : "Xác nhận thêm lại vào giỏ"}
        </button>
      </div>
    </dialog>
  );
}
