"use client";
import { useEffect, useRef, useState } from "react";
import { RequestError } from "@/lib/storefront-types";
import type { FeedbackView, OrderFeedback } from "@/lib/types/feedback";
export function FeedbackDialog({ orderId, initial, onLoad, onSave, onSaved, onClose, onExpired }: {
  orderId: string; initial: OrderFeedback | null;
  onLoad: () => Promise<FeedbackView>;
  onSave: (input: { rating: number; comment: string; revision?: string }) => Promise<OrderFeedback>;
  onSaved: (feedback: OrderFeedback) => void; onClose: () => void; onExpired: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null), alert = useRef<HTMLParagraphElement>(null);
  const alive = useRef(false), working = useRef(false);
  const [base, setBase] = useState(initial), [rating, setRating] = useState(initial?.rating ?? 0), [comment, setComment] = useState(initial?.comment ?? "");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [eligible, setEligible] = useState(true);
  useEffect(() => { alive.current = true; dialog.current?.showModal(); return () => { alive.current = false; }; }, []);
  useEffect(() => { if (error) alert.current?.focus(); }, [error]);
  const run = async (operation: () => Promise<void>) => {
    if (working.current) return;
    working.current = true; setBusy(true); setError("");
    try { await operation(); }
    catch (err) {
      if (!alive.current) return;
      if (err instanceof RequestError && (err.status === 401 || err.code === "IDENTITY_CHANGED")) onExpired();
      else setError(err instanceof Error ? err.message : "Chưa lưu được đánh giá.");
    } finally { working.current = false; if (alive.current) setBusy(false); }
  };
  const locked = !eligible || !!base?.reply;
  return <dialog ref={dialog} className="checkout-dialog" aria-labelledby="feedback-dialog-title" onClose={onClose} onCancel={event => { if (busy) event.preventDefault(); }}>
    <form onSubmit={event => { event.preventDefault(); if (locked || !rating) return; void run(async () => {
      const saved = await onSave({ rating, comment, ...(base ? { revision: base.revision } : {}) });
      if (alive.current) onSaved(saved);
    }); }}>
      <div className="section-heading"><h2 id="feedback-dialog-title">Đánh giá đơn #{orderId.slice(-8).toUpperCase()}</h2>
        <button type="button" className="icon-button" aria-label="Đóng đánh giá" disabled={busy} onClick={() => dialog.current?.close()}>×</button></div>
      <p className="small muted">Đánh giá riêng cho cửa hàng, chỉ bạn và quản trị xem. Có thể sửa trước khi cửa hàng trả lời.</p>
      <fieldset disabled={busy || locked} className="checkout-fields"><legend>Trải nghiệm của bạn</legend>
        <div className="feedback-stars" role="radiogroup" aria-label="Điểm đánh giá">
          {[1, 2, 3, 4, 5].map(value => <label key={value} className={rating === value ? "selected" : ""}>
            <input type="radio" name="rating" value={value} checked={rating === value} required onChange={() => setRating(value)} aria-label={value + " điểm"} />
            <span aria-hidden="true">★</span><small>{value}</small></label>)}
        </div>
        <label>Nhận xét riêng (không bắt buộc)<textarea value={comment} onChange={event => setComment(event.target.value)} maxLength={1000} placeholder="Món ăn và trải nghiệm nhận món của bạn thế nào?" /></label>
        <span className="small muted">{comment.length}/1.000 ký tự</span>
      </fieldset>
      {base?.reply && <div className="feedback-reply"><strong>Cửa hàng đã trả lời</strong><p>{base.reply.message}</p><small>Đánh giá và câu trả lời được giữ nguyên.</small></div>}
      {!eligible && <p className="notice-box">Chỉ đánh giá đơn đã hoàn tất.</p>}
      {error && <p ref={alert} role="alert" tabIndex={-1} className="error-box">{error}</p>}
      <div className="admin-transition-actions">
        <button type="button" className="text-button" disabled={busy} onClick={() => void run(async () => {
          const view = await onLoad(); if (!alive.current) return;
          setEligible(view.eligible); setBase(view.feedback); setRating(view.feedback?.rating ?? 0); setComment(view.feedback?.comment ?? "");
        })}>Tải lại đánh giá · bỏ bản nháp</button>
        <button type="submit" className="button primary" disabled={busy || locked || !rating}>{busy ? "Đang xử lý…" : "Lưu đánh giá riêng"}</button>
      </div>
    </form>
  </dialog>;
}
