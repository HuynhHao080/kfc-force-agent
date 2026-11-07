"use client";
import { useEffect, useRef, useState } from "react";
import { api, RequestError } from "@/lib/storefront-types";
import type { FeedbackInbox, OrderFeedback } from "@/lib/types/feedback";
type Entry = FeedbackInbox["entries"][number];
function ReplyDialog({ entry, onClose, onExpired, onSaved }: { entry: Entry; onClose: () => void; onExpired: () => void; onSaved: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), alert = useRef<HTMLParagraphElement>(null), alive = useRef(false), working = useRef(false);
  const [message, setMessage] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => { alive.current = true; dialog.current?.showModal(); return () => { alive.current = false; }; }, []);
  useEffect(() => { if (error) alert.current?.focus(); }, [error]);
  const submit = async () => {
    if (working.current) return;
    working.current = true; setBusy(true); setError("");
    try {
      await api<OrderFeedback>("/api/admin/feedback", { method: "POST", body: JSON.stringify({ orderId: entry.orderId, revision: entry.feedback.revision, message }) });
      if (alive.current) onSaved();
    } catch (err) {
      if (!alive.current) return;
      if (err instanceof RequestError && err.status === 401) onExpired();
      else setError(err instanceof Error ? err.message : "Chưa gửi được phản hồi.");
    } finally { working.current = false; if (alive.current) setBusy(false); }
  };
  return <dialog ref={dialog} className="checkout-dialog" aria-labelledby="feedback-reply-title" onClose={onClose} onCancel={event => { if (busy) event.preventDefault(); }}>
    <form onSubmit={event => { event.preventDefault(); void submit(); }}>
      <div className="section-heading"><h2 id="feedback-reply-title">Trả lời đơn #{entry.orderId.slice(-8).toUpperCase()}</h2>
        <button type="button" className="icon-button" aria-label="Đóng phản hồi" disabled={busy} onClick={() => dialog.current?.close()}>×</button></div>
      <div className="feedback-quote"><strong>{entry.feedback.rating}/5 điểm</strong><p>{entry.feedback.comment || "Khách không viết nhận xét."}</p></div>
      <p className="small muted">Câu trả lời gửi riêng cho chủ đơn. Mỗi đánh giá có một câu trả lời, được giữ nguyên sau khi gửi.</p>
      <fieldset disabled={busy} className="checkout-fields"><label>Nội dung phản hồi cho khách
        <textarea value={message} onChange={event => setMessage(event.target.value)} minLength={5} maxLength={1000} required /></label>
        <span className="small muted">{message.length}/1.000 ký tự</span></fieldset>
      {error && <p ref={alert} role="alert" tabIndex={-1} className="error-box">{error}</p>}
      <div className="admin-transition-actions"><button type="button" className="text-button" disabled={busy} onClick={() => dialog.current?.close()}>Đóng và tải lại danh sách</button>
        <button type="submit" className="button primary" disabled={busy || message.trim().length < 5}>{busy ? "Đang gửi…" : "Gửi phản hồi cho khách"}</button></div>
    </form>
  </dialog>;
}
export function FeedbackPanel({ onExpired, onChanged }: { onExpired: () => void; onChanged: () => void }) {
  const [rating, setRating] = useState("all"), [response, setResponse] = useState("all"), [reload, setReload] = useState(0);
  const [state, setState] = useState<{ key: string; inbox?: FeedbackInbox; error?: string }>({ key: "" });
  const [draft, setDraft] = useState<Entry | null>(null), [notice, setNotice] = useState("");
  const key = rating + ":" + response + ":" + reload, editing = !!draft;
  useEffect(() => {
    if (editing) return;
    let active = true, fetching = false;
    let controller: AbortController | undefined;
    const load = async () => {
      if (fetching || document.hidden) return;
      fetching = true; controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 20000);
      try {
        const inbox = await api<FeedbackInbox>("/api/admin/feedback?" + new URLSearchParams({ rating, response }), { signal: controller.signal });
        if (active) setState({ key, inbox });
      } catch (err) {
        if (!active) return;
        if (err instanceof RequestError && err.status === 401) onExpired();
        else setState({ key, error: err instanceof Error ? err.message : "Chưa tải được đánh giá." });
      } finally { fetching = false; window.clearTimeout(timeout); }
    };
    const wake = () => { void load(); };
    void load();
    const timer = window.setInterval(wake, 15000);
    window.addEventListener("focus", wake); document.addEventListener("visibilitychange", wake);
    return () => { active = false; controller?.abort(); window.clearInterval(timer); window.removeEventListener("focus", wake); document.removeEventListener("visibilitychange", wake); };
  }, [editing, key, rating, response, onExpired]);
  const inbox = state.key === key ? state.inbox : undefined, error = state.key === key ? state.error : undefined;
  return <section className="feedback-panel" aria-labelledby="feedback-panel-title">
    <div className="section-heading"><div><span className="eyebrow">SAU BỮA ĂN · LẮNG NGHE KHÁCH</span><h2 id="feedback-panel-title">Đánh giá & phản hồi</h2></div>
      <button className="button secondary" onClick={() => setReload(value => value + 1)}>Làm mới đánh giá</button></div>
    <p className="small muted">Tối đa 200 đánh giá được cập nhật gần nhất, kể cả từ đơn cũ. Nội dung riêng cho chủ đơn và quản trị; không công khai trên thực đơn. Đồng bộ 15 giây, tạm dừng khi soạn trả lời.</p>
    <div className="feedback-filters"><label>Điểm đánh giá<select value={rating} onChange={event => setRating(event.target.value)}><option value="all">Tất cả điểm</option>{[1, 2, 3, 4, 5].map(value => <option value={value} key={value}>{value} điểm</option>)}</select></label>
      <label>Tình trạng phản hồi<select value={response} onChange={event => setResponse(event.target.value)}><option value="all">Tất cả phản hồi</option><option value="pending">Chờ trả lời</option><option value="replied">Đã trả lời</option></select></label></div>
    {notice && <p role="status" className="notice-box">{notice}</p>}
    {error ? <p role="alert" className="error-box">{error}</p> : !inbox ? <p role="status">Đang tải đánh giá…</p> : <>
      <div className="feedback-metrics"><p><strong>{inbox.matchedFeedbacks}/{inbox.sampledFeedbacks}</strong><span>Đánh giá khớp bộ lọc</span></p><p><strong>{inbox.averageRating === null ? "—" : inbox.averageRating.toFixed(1) + "/5"}</strong><span>Điểm trung bình bộ lọc</span></p><p><strong>{inbox.unanswered}</strong><span>Chưa trả lời trong bộ lọc</span></p></div>
      {!inbox.entries.length && <p className="notice-box">Chưa có đánh giá khớp bộ lọc.</p>}
      <div className="feedback-list">{inbox.entries.map(entry => <article className="panel feedback-entry" key={entry.orderId} aria-label={"Đánh giá đơn #" + entry.orderId.slice(-8).toUpperCase()}>
        <div className="section-heading"><strong>#{entry.orderId.slice(-8).toUpperCase()}</strong><span className="feedback-score">★ {entry.feedback.rating}/5</span></div>
        <time dateTime={entry.feedback.updatedAt}>{new Date(entry.feedback.updatedAt).toLocaleString("vi-VN")}</time>
        <p>{entry.feedback.comment || "Khách không viết nhận xét."}</p>
        {entry.feedback.reply ? <div className="feedback-reply"><strong>Cửa hàng đã trả lời</strong><p>{entry.feedback.reply.message}</p></div> :
          <button className="button primary" onClick={() => setDraft(entry)}>Trả lời đánh giá</button>}
      </article>)}</div>
    </>}
    {draft && <ReplyDialog entry={draft} onClose={() => { setDraft(null); setReload(value => value + 1); }} onExpired={onExpired} onSaved={() => {
      setDraft(null); setReload(value => value + 1); setNotice("Đã lưu câu trả lời riêng cho khách."); onChanged();
    }} />}
  </section>;
}
