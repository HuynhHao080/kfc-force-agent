"use client";
import Link from "next/link";
import { useState } from "react";
import { filterOrders } from "@/lib/order-reporting";
import { orderStatusLabels } from "@/lib/order-workflow";
import type { Order } from "@/lib/types/order";
import type { OrderDetail } from "@/lib/storefront-types";
import { money } from "@/lib/storefront-types";
const labels: Record<string, string> = orderStatusLabels;
export function OrderPanel({
  orders,
  selected: currentSelection,
  busy,
  onSelect,
  onCancel,
  onMenu,
  onReorder,
  onFeedback,
}: {
  orders: Order[];
  selected: OrderDetail | null;
  busy: boolean;
  onSelect: (id: string) => void;
  onCancel: (id: string) => void;
  onMenu: () => void;
  onReorder: (id: string) => void;
  onFeedback: (order: OrderDetail) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const visibleOrders = filterOrders(orders, {
    search: query,
    status,
    fulfillment: "all",
    from: "",
    to: "",
  });
  const selected = visibleOrders.some(
    (order) => order.id === currentSelection?.id,
  )
    ? currentSelection
    : null;
  return (
    <section className="orders-section" aria-labelledby="orders-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">MỖI BỮA NGON, MỘT KỶ NIỆM</span>
          <h2 id="orders-title" className="icon-heading" tabIndex={-1}>
            <span className="section-title-icon" aria-hidden="true">🧾</span>
            Đơn của tôi
          </h2>
        </div>
        <button className="text-button" onClick={onMenu}>
          ← Chọn thêm món
        </button>
      </div>
      {!orders.length && (
        <div className="panel empty-state">
          <h3>Bữa ngon đầu tiên đang chờ bạn.</h3>
          <p className="muted">
            Đơn hàng sẽ xuất hiện ở đây sau khi bạn xác nhận.
          </p>
          <button className="button primary" onClick={onMenu}>
            Khám phá thực đơn
          </button>
        </div>
      )}
      {!!orders.length && (
        <div
          className="checkout-fields order-history-filters"
          role="search"
          aria-label="Lọc lịch sử đơn"
        >
          <label>
            Tìm đơn của tôi
            <input
              type="search"
              value={query}
              maxLength={100}
              placeholder="Mã đơn hoặc tên người nhận"
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label>
            Trạng thái đơn
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">Tất cả trạng thái</option>
              {Object.entries(labels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="text-button"
            disabled={!query && status === "all"}
            onClick={() => {
              setQuery("");
              setStatus("all");
            }}
          >
            Xoá bộ lọc đơn
          </button>
          <p className="small muted" role="status">
            Hiển thị {visibleOrders.length}/{orders.length} đơn của bạn.
          </p>
        </div>
      )}
      {!!orders.length && !visibleOrders.length && (
        <p className="notice-box">
          Không có đơn khớp bộ lọc. Hãy đổi mã tìm hoặc trạng thái.
        </p>
      )}
      <div className="order-list">
        {visibleOrders.map((order) => (
          <button
            key={order.id}
            className={`order-card ${selected?.id === order.id ? "selected" : ""}`}
            disabled={busy}
            onClick={() => onSelect(order.id)}
          >
            <span>
              <strong>Đơn #{order.id.slice(-8).toUpperCase()}</strong>
              <small>{new Date(order.createdAt).toLocaleString("vi-VN")}</small>
            </span>
            <span>
              <span
                className={`status-badge ${order.status === "CANCELLED" ? "cancelled" : ""}`}
              >
                {labels[order.status]}
              </span>
              <strong>{money(order.total)}</strong>
            </span>
          </button>
        ))}
      </div>
      {selected && (
        <article className="panel order-detail">
          <div className="section-heading">
            <h3>Chi tiết #{selected.id.slice(-8).toUpperCase()}</h3>
            <span
              className={`status-badge ${selected.status === "CANCELLED" ? "cancelled" : ""}`}
            >
              {labels[selected.status]}
            </span>
          </div>
          <p className="muted small">Đơn demo · Chưa gửi đến nhà hàng</p>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => onReorder(selected.id)}
          >
            Đặt lại món trong đơn này
          </button>
          <Link
            className="text-button"
            href={"/orders/" + encodeURIComponent(selected.id) + "/receipt"}
            target="_blank"
            rel="noopener noreferrer"
            prefetch={false}
          >
            Xem / In phiếu đơn ↗
          </Link>
          <ul>
            {selected.items.map((item) => (
              <li key={item.id}>
                <span>
                  {item.quantity} × {item.nameSnapshot}
                </span>
                <strong>{money(item.subtotal)}</strong>
              </li>
            ))}
          </ul>
          {selected.discount > 0 && (
            <div className="cart-total">
              <span>Giảm giá {selected.promotion?.code ?? ""}</span>
              <strong>−{money(selected.discount)}</strong>
            </div>
          )}
          <div className="cart-total">
            <span>Phí giao hàng</span>
            <strong>{money(selected.deliveryFee)}</strong>
          </div>
          <div className="cart-total">
            <strong>Tổng cộng</strong>
            <strong>{money(selected.total)}</strong>
          </div>
          {selected.store && <p className="notice-box">{selected.store.name} · {selected.store.address}{selected.store.phone ? " · " + selected.store.phone : ""}</p>}
          <div className="order-contact">
            <strong>{selected.customerName}</strong>
            <p>{selected.phone}</p>
            <p>
              {selected.fulfillment === "delivery"
                ? String(selected.shippingAddress?.address ?? "")
                : "Tự đến lấy tại cửa hàng demo"}
            </p>
            {selected.note && <p>Ghi chú: {selected.note}</p>}
          </div>
          <ol className="order-events" aria-label="Lịch sử trạng thái">
            {selected.events.map((event) => (
              <li key={event.id}>
                <strong>{labels[event.type] ?? event.type}</strong>
                {event.type === "CANCELLED" && typeof event.metadata?.cancellationReason === "string" && (
                  <p>Lý do huỷ: {event.metadata.cancellationReason}</p>
                )}
                <time dateTime={event.createdAt}>
                  {new Date(event.createdAt).toLocaleString("vi-VN")}
                </time>
              </li>
            ))}
          </ol>
          {selected.status === "COMPLETED" && <section className="order-feedback" aria-label="Đánh giá riêng của bạn">
            <h3>Trải nghiệm sau bữa ăn</h3>
            {selected.feedback ? <>
              <p className="feedback-score">★ {selected.feedback.rating}/5</p>
              <p>{selected.feedback.comment || "Bạn chưa viết nhận xét."}</p>
              {selected.feedback.reply && <div className="feedback-reply"><strong>Cửa hàng trả lời</strong><p>{selected.feedback.reply.message}</p></div>}
            </> : <p className="small muted">Chia sẻ đánh giá riêng với cửa hàng sau khi nhận món.</p>}
            {!selected.feedback?.reply && <button className="button secondary" disabled={busy} onClick={() => onFeedback(selected)}>
              {selected.feedback ? "Sửa đánh giá riêng" : "Đánh giá đơn đã nhận"}
            </button>}
          </section>}
          {selected.status === "CONFIRMED" && (
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => onCancel(selected.id)}
            >
              Huỷ đơn này
            </button>
          )}
        </article>
      )}
    </section>
  );
}
