"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, RequestError } from "@/lib/storefront-types";
import type { ConversationDetail, ConversationSummary } from "@/lib/channels/staff-service";

const time = (value?: string) => (value ? new Date(value).toLocaleString("vi-VN") : "—");
const author = (entry: ConversationDetail["messages"][number]) =>
  entry.role === "user" ? "Khách" : entry.sender === "staff" ? "Nhân viên" : "AI";

/**
 * Hội thoại WhatsApp (issue #16, giai đoạn 6): nhân viên xem lịch sử, tiếp quản (AI ngừng trả lời), nhắn khách
 * trong cửa sổ 24 giờ và trả lại AI. Đồng bộ 10 giây; mọi thao tác gửi kèm revision đang thấy, nên khi người khác
 * vừa thao tác, server từ chối và màn hình tải lại.
 */
export function ConversationsPanel({ onExpired, onChanged }: { onExpired: () => void; onChanged: (message: string) => void }) {
  const [list, setList] = useState<ConversationSummary[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [draft, setDraft] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false), [reload, setReload] = useState(0);
  const working = useRef(false);

  const fail = useCallback((err: unknown, fallback: string) => {
    if (err instanceof RequestError && err.status === 401) onExpired();
    else setError(err instanceof Error ? err.message : fallback);
  }, [onExpired]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (document.hidden) return;
      try {
        const data = await api<{ conversations: ConversationSummary[] }>("/api/admin/conversations");
        if (!active) return;
        setList(data.conversations);
        if (selected) {
          const next = await api<ConversationDetail>("/api/admin/conversations?" + new URLSearchParams({ customerId: selected }));
          if (active) setDetail(next);
        }
      } catch (err) {
        if (active) fail(err, "Chưa tải được hội thoại.");
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 10000);
    return () => { active = false; window.clearInterval(timer); };
  }, [selected, reload, fail]);

  const act = async (operation: () => Promise<unknown>, done: string) => {
    if (working.current) return;
    working.current = true; setBusy(true); setError("");
    try {
      await operation();
      onChanged(done);
    } catch (err) {
      fail(err, "Chưa thực hiện được thao tác.");
    } finally {
      working.current = false; setBusy(false); setReload((value) => value + 1);
    }
  };
  const handoff = (action: "takeover" | "release") => detail && act(() => api("/api/admin/conversations", {
    method: "PATCH", body: JSON.stringify({ customerId: detail.conversation.customerId, action, expectedRevision: detail.conversation.revision }),
  }), action === "takeover" ? "Đã tiếp quản hội thoại; AI ngừng trả lời khách này." : "Đã trả lại hội thoại cho AI.");
  const send = () => detail && act(async () => {
    await api("/api/admin/conversations", { method: "POST", body: JSON.stringify({ customerId: detail.conversation.customerId, message: draft }) });
    setDraft("");
  }, "Đã gửi tin cho khách.");

  const current = detail && detail.conversation.customerId === selected ? detail.conversation : null;
  return <section className="conversations-panel" aria-labelledby="conversations-title">
    <div className="section-heading"><div><span className="eyebrow">WHATSAPP · NHÂN VIÊN TIẾP QUẢN</span><h2 id="conversations-title">Hội thoại</h2></div>
      <button className="button secondary" onClick={() => setReload((value) => value + 1)}>Làm mới</button></div>
    <p className="small muted">50 hội thoại có tin gần nhất. Khi tiếp quản, AI ngừng trả lời và đề xuất giỏ đang chờ bị huỷ. WhatsApp chỉ cho nhắn tin thường trong 24 giờ kể từ tin gần nhất của khách. Đồng bộ 10 giây.</p>
    {error && <p role="alert" className="error-box">{error}</p>}
    {!list ? <p role="status">Đang tải hội thoại…</p> : !list.length ? <p className="notice-box">Chưa có hội thoại WhatsApp nào.</p> :
      <div className="conversations-layout">
        <ul className="conversation-list" aria-label="Danh sách hội thoại">{list.map((item) => <li key={item.customerId}>
          <button aria-current={item.customerId === selected ? "true" : undefined} onClick={() => { setSelected(item.customerId); setDetail(null); setDraft(""); setError(""); }}>
            <strong>{item.profileName ?? "Khách WhatsApp"}</strong><span className="small muted">{item.contact}</span>
            <span className={item.mode === "HUMAN" ? "conversation-mode human" : "conversation-mode"}>{item.mode === "HUMAN" ? "Nhân viên" : "AI"}</span>
            <time dateTime={item.lastInboundAt} className="small muted">{time(item.lastInboundAt)}{item.withinWindow ? "" : " · quá 24 giờ"}</time>
          </button></li>)}</ul>
        <div className="panel conversation-detail">
          {!selected ? <p className="muted">Chọn một hội thoại để xem.</p> : !current ? <p role="status">Đang tải…</p> : <>
            <div className="section-heading"><div><strong>{current.profileName ?? "Khách WhatsApp"}</strong> <span className="small muted">{current.contact}</span></div>
              {current.mode === "AI"
                ? <button className="button primary" disabled={busy} onClick={() => void handoff("takeover")}>Tiếp quản</button>
                : <button className="button secondary" disabled={busy} onClick={() => void handoff("release")}>Trả lại AI</button>}</div>
            <p className="small muted">{current.mode === "HUMAN" ? `Đang do ${current.takenOverBy} tiếp quản từ ${time(current.takenOverAt)}.` : "AI đang trả lời khách."}</p>
            <ol className="conversation-messages">{detail!.messages.map((entry, index) => <li key={index} className={"from-" + (entry.role === "user" ? "customer" : entry.sender ?? "ai")}>
              <span className="small muted">{author(entry)} · {time(entry.createdAt)}</span><p>{entry.content}</p></li>)}</ol>
            {current.mode === "HUMAN" && (current.withinWindow
              ? <form onSubmit={(event) => { event.preventDefault(); void send(); }}>
                  <label>Tin nhắn cho khách<textarea value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={1000} disabled={busy} required /></label>
                  <button type="submit" className="button primary" disabled={busy || !draft.trim()}>{busy ? "Đang gửi…" : "Gửi cho khách"}</button>
                </form>
              : <p className="notice-box">Đã quá 24 giờ từ tin gần nhất của khách: chờ khách nhắn lại mới gửi được tin thường.</p>)}
            {!!detail!.events.length && <details><summary className="small">Nhật ký tiếp quản</summary><ul className="small">{detail!.events.map((event, index) =>
              <li key={index}>{event.type === "TAKEOVER" ? "Tiếp quản" : "Trả lại AI"} · {event.by} · {time(event.at)}</li>)}</ul></details>}
          </>}
        </div>
      </div>}
  </section>;
}
