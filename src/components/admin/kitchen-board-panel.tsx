"use client";
import { useEffect, useRef, useState } from "react";
import { api, RequestError } from "@/lib/storefront-types";
import { nextOrderStatuses } from "@/lib/order-workflow";
import { kitchenStatuses, type KitchenBoard, type KitchenCard, type KitchenStatus } from "@/lib/types/kitchen";

const labels: Record<KitchenStatus, string> = {
  CONFIRMED: "Chờ chuẩn bị", PREPARING: "Đang chuẩn bị", READY: "Sẵn sàng nhận", DELIVERING: "Đang giao demo",
};
const actions: Record<KitchenStatus, string> = {
  CONFIRMED: "Bắt đầu chuẩn bị", PREPARING: "Món đã chuẩn bị xong", READY: "Đã giao món cho khách", DELIVERING: "Hoàn tất giao demo",
};
export function KitchenBoardPanel({ onExpired, onOpenOrder, locked }: {
  locked: boolean;
  onExpired: () => void;
  onOpenOrder: (id: string) => void;
}) {
  const [fulfillment, setFulfillment] = useState<KitchenBoard["fulfillment"]>("all");
  const [reload, setReload] = useState(0);
  const [state, setState] = useState<{ key: string; board?: KitchenBoard; error?: string }>({ key: "" });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [clock, setClock] = useState(0);
  const alive = useRef(false);
  const acting = useRef(false);
  const generation = useRef(0);
  const readController = useRef<AbortController | null>(null);
  const key = fulfillment + ":" + reload;
  useEffect(() => {
    alive.current = true;
    const timer = window.setInterval(() => { if (!document.hidden) setClock(Date.now()); }, 60000);
    return () => { alive.current = false; window.clearInterval(timer); };
  }, []);
  useEffect(() => {
    let active = true, fetching = false;
    let controller: AbortController | undefined;
    const load = async () => {
      if (fetching || acting.current || document.hidden) return;
      fetching = true;
      const version = ++generation.current;
      controller = new AbortController();
      readController.current = controller;
      const timeout = window.setTimeout(() => controller?.abort(), 20000);
      try {
        const board = await api<KitchenBoard>("/api/admin/kitchen?fulfillment=" + fulfillment, { signal: controller.signal });
        if (active && version === generation.current) {
          setState({ key, board });
          setClock(Date.now());
        }
      } catch (error) {
        if (!active || version !== generation.current) return;
        if (error instanceof RequestError && error.status === 401) onExpired();
        else setState({ key, error: error instanceof Error ? error.message : "Chưa tải được bảng bếp." });
      } finally {
        fetching = false;
        window.clearTimeout(timeout);
      }
    };
    const wake = () => { if (!document.hidden) void load(); };
    void load();
    const timer = window.setInterval(wake, 15000);
    window.addEventListener("focus", wake);
    document.addEventListener("visibilitychange", wake);
    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", wake);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [fulfillment, key, onExpired]);
  const board = state.key === key ? state.board : undefined;
  const error = state.key === key ? state.error : undefined;
  const advance = async (card: KitchenCard) => {
    if (acting.current || locked) return;
    const nextStatus = nextOrderStatuses(card).find(status => status !== "CANCELLED");
    if (!nextStatus) return;
    acting.current = true;
    setBusy(true);
    setActionError("");
    setNotice("");
    generation.current++;
    readController.current?.abort();
    try {
      await api("/api/admin/orders", { method: "PATCH", body: JSON.stringify({
        orderId: card.id, expectedStatus: card.status, nextStatus,
      }) });
      if (!alive.current) return;
      setNotice("Trạng thái đơn đã được ghi nhận. Bảng đang tải lại.");
      if (typeof BroadcastChannel !== "undefined") {
        const channel = new BroadcastChannel("kfc-storefront-state");
        channel.postMessage("changed");
        channel.close();
      }
    } catch (error) {
      if (!alive.current) return;
      if (error instanceof RequestError && error.status === 401) { onExpired(); return; }
      setActionError((error instanceof Error ? error.message : "Chưa cập nhật được đơn.") + " Bảng sẽ tải lại trạng thái; hãy kiểm tra trước khi thao tác tiếp.");
    } finally {
      acting.current = false;
      if (alive.current) { setBusy(false); setReload(value => value + 1); }
    }
  };
  return (
    <section className="kitchen-panel" aria-labelledby="kitchen-title">
      <div className="section-heading">
        <div><span className="eyebrow">MỖI THẺ MỘT ĐƠN · MỖI BƯỚC MỘT LẦN</span><h2 id="kitchen-title">Điều phối bếp</h2></div>
        <button className="button secondary" disabled={busy || locked} onClick={() => { setActionError(""); setReload(value => value + 1); }}>Làm mới bảng bếp</button>
      </div>
      <p className="small muted">Đơn đang xử lý trong 200 đơn gần nhất. Tự đồng bộ mỗi 15 giây khi trang hiển thị; thời gian tính từ lúc đặt, không phải cam kết phục vụ. Trạng thái nội bộ demo.</p>
      <label className="kitchen-filter">Hình thức trên bảng bếp
        <select value={fulfillment} disabled={busy || locked} onChange={event => { setActionError(""); setNotice(""); setFulfillment(event.target.value as KitchenBoard["fulfillment"]); }}>
          <option value="all">Tất cả hình thức</option><option value="pickup">Nhận tại cửa hàng</option><option value="delivery">Giao hàng</option>
        </select>
      </label>
      {notice && <p role="status" className="notice-box">{notice}</p>}
      {actionError && <p role="alert" className="error-box">{actionError}</p>}
      {error ? <p role="alert" className="error-box">{error}</p> : !board ? <p role="status">Đang tải bảng bếp…</p> : <>
        <p className="small muted">Nguồn: {board.sampledOrders}/{board.sampleLimit} đơn gần nhất · {board.cards.length} đơn trên bảng · cập nhật {new Date(board.generatedAt).toLocaleTimeString("vi-VN")}</p>
        {board.excludedActiveOrders > 0 && <p role="alert" className="error-box">Có {board.excludedActiveOrders} đơn đang xử lý thiếu dữ liệu hợp lệ, chưa đưa lên bảng. Hãy kiểm tra ở danh sách đơn.</p>}
        <section className="kitchen-preparation panel" aria-labelledby="prep-title">
          <div className="section-heading"><h3 id="prep-title">Cần chuẩn bị</h3><span className="eyebrow">CHỜ + ĐANG LÀM</span></div>
          {!board.preparation.length ? <p className="small muted">Không còn món chờ hoặc đang chuẩn bị trong bộ lọc này.</p> :
            <ul>{board.preparation.map(item => <li key={item.menuItemId}><strong>{item.name}</strong><span><b>{item.total}</b> phần · chờ {item.waiting} / đang làm {item.preparing}</span></li>)}</ul>}
        </section>
        <div className="kitchen-columns">
          {kitchenStatuses.map(status => <section key={status} className={"kitchen-column kitchen-" + status.toLowerCase()} aria-label={labels[status]}>
            <header><h3>{labels[status]}</h3><span>{board.counts[status]}</span></header>
            {!board.counts[status] && <p className="kitchen-empty">Chưa có đơn ở bước này.</p>}
            {board.cards.filter(card => card.status === status).map(card => <article className="kitchen-ticket" key={card.id} aria-label={"Đơn #" + card.id.slice(-8).toUpperCase()}>
              <div className="section-heading"><strong>#{card.id.slice(-8).toUpperCase()}</strong><span className="small">{card.fulfillment === "delivery" ? "Giao hàng" : "Đến lấy"}</span></div>
              <time dateTime={card.createdAt}>Từ lúc đặt: {clock ? Math.max(0, Math.floor((clock - Date.parse(card.createdAt)) / 60000)) : 0} phút</time>
              <ul>{card.items.map(item => <li key={item.menuItemId}><b>{item.quantity}×</b><span>{item.name}</span></li>)}</ul>
              {card.note && <p className="kitchen-note">Ghi chú: {card.note}</p>}
              <button className="button primary full-width" disabled={busy || locked} onClick={() => void advance(card)}>{actions[status]}</button>
              <button className="text-button" disabled={busy || locked} onClick={() => onOpenOrder(card.id)}>Mở chi tiết đơn</button>
            </article>)}
          </section>)}
        </div>
      </>}
    </section>
  );
}
