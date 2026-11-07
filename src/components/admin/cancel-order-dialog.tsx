"use client";
import { useEffect, useRef, useState } from "react";
import type { OrderDetail } from "@/lib/storefront-types";
import { money } from "@/lib/storefront-types";

export function CancelOrderDialog({ order, busy, error, onClose, onConfirm }: {
  order: OrderDetail;
  busy: boolean;
  error: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const alert = useRef<HTMLParagraphElement>(null);
  const [reason, setReason] = useState("");
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => { if (error) alert.current?.focus(); }, [error]);
  return (
    <dialog ref={dialog} className="checkout-dialog" aria-labelledby="cancel-order-title"
      onClose={onClose} onCancel={(event) => { if (busy) event.preventDefault(); }}>
      <form onSubmit={(event) => { event.preventDefault(); if (!busy) onConfirm(reason.trim()); }}>
        <div className="section-heading">
          <h2 id="cancel-order-title">Huỷ đơn #{order.id.slice(-8).toUpperCase()}</h2>
          <button type="button" className="icon-button" aria-label="Đóng huỷ đơn"
            disabled={busy} onClick={() => dialog.current?.close()}>×</button>
        </div>
        <p>{order.customerName} · {money(order.total)}</p>
        <p className="small muted">Chỉ huỷ đơn chưa bắt đầu chuẩn bị. Lý do bên dưới sẽ hiển thị cho khách trong lịch sử đơn; hãy nhập nội dung phù hợp để khách đọc.</p>
        <fieldset className="checkout-fields" disabled={busy}>
          <label>Lý do huỷ hiển thị cho khách
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} required
              minLength={5} maxLength={300} placeholder="Ví dụ: Cửa hàng tạm ngừng phục vụ, mong bạn thông cảm." />
          </label>
          <p className="small muted">{reason.length}/300 ký tự</p>
          <label className="checkbox-label">
            <input type="checkbox" required /> Tôi xác nhận huỷ đúng đơn này và thông báo lý do cho khách.
          </label>
        </fieldset>
        {error && <p ref={alert} role="alert" tabIndex={-1} className="error-box">{error}</p>}
        <div className="admin-transition-actions">
          <button type="button" className="button secondary" disabled={busy} onClick={() => dialog.current?.close()}>Giữ đơn</button>
          <button type="submit" className="button primary" disabled={busy || reason.trim().length < 5}>
            {busy ? "Đang huỷ…" : "Xác nhận huỷ đơn"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
