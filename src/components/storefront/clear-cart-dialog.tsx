"use client";
import { useEffect, useRef } from "react";
import { money } from "@/lib/storefront-types";

export function ClearCartDialog({
  count,
  total,
  busy,
  stale,
  error,
  onClose,
  onConfirm,
}: {
  count: number;
  total: number;
  busy: boolean;
  stale: boolean;
  error: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="checkout-dialog clear-cart-dialog"
      aria-labelledby="clear-cart-title"
      onClose={onClose}
      onCancel={(event) => {
        if (busy) event.preventDefault();
      }}
    >
      <h2 id="clear-cart-title">Xóa toàn bộ giỏ hàng?</h2>
      <p>
        Bạn đang chọn {count} phần, tạm tính {money(total)}.
      </p>
      {stale && (
        <p className="error-box" role="alert">
          Giỏ đã thay đổi. Hãy đóng hộp thoại và xem lại giỏ hiện tại trước khi
          xóa.
        </p>
      )}
      {error && !stale && (
        <p className="error-box" role="alert">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <button
          type="button"
          className="button secondary"
          disabled={busy}
          onClick={() => dialog.current?.close()}
        >
          {stale ? "Xem giỏ hiện tại" : "Giữ lại giỏ"}
        </button>
        <button
          type="button"
          className="button primary"
          disabled={busy || stale}
          onClick={onConfirm}
        >
          {busy ? "Đang xóa…" : "Xác nhận xóa giỏ"}
        </button>
      </div>
    </dialog>
  );
}
