"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  api,
  RequestError,
  money,
  type OrderDetail,
} from "@/lib/storefront-types";
import { orderStatusLabels, nextOrderStatuses } from "@/lib/order-workflow";
import type { OrderStatus } from "@/lib/types/order";
import type { MenuCategory, MenuItem } from "@/lib/types/menu";
import type { AdminDashboard } from "@/lib/admin-types";
import { MenuEditor } from "./menu-editor";
import { CategoryEditor } from "./category-editor";
import { CatalogAuditPanel } from "./catalog-audit-panel";
import { PromotionPanel } from "./promotion-panel";
import { SalesReportPanel } from "./sales-report-panel";
import { FeedbackPanel } from "./feedback-panel";
import { ShopSettingsPanel } from "./shop-settings-panel";
import { KitchenBoardPanel } from "./kitchen-board-panel";
import { CancelOrderDialog } from "./cancel-order-dialog";
import type { CatalogAuditEntry } from "@/lib/types/catalog-audit";
import {
  filterOrders,
  invalidDateRange,
  ordersCsv,
  summarizeOrders,
} from "@/lib/order-reporting";
const emptyDashboard: AdminDashboard = {
  orders: [],
  stats: {
    sampleLimit: 200,
    totalOrders: 0,
    activeOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    completedValue: 0,
    daily: [],
  },
};
export function AdminConsole() {
  const [auth, setAuth] = useState<{
    configured: boolean;
    authenticated: boolean;
  } | null>(null);
  const [dashboard, setDashboard] = useState(emptyDashboard);
  const [menu, setMenu] = useState<{
    items: MenuItem[];
    categories: MenuCategory[];
  }>({ items: [], categories: [] });
  const [tab, setTab] = useState<
    "orders" | "menu" | "reports" | "audit" | "promotions" | "kitchen" | "shop" | "feedback"
  >("orders");
  const [audit, setAudit] = useState<CatalogAuditEntry[]>([]);
  const [selected, setSelectedState] = useState<OrderDetail | null>(null);
  const selectedId = useRef<string | null>(null);
  const refreshVersion = useRef(0);
  const setSelected = useCallback((value: OrderDetail | null) => {
    selectedId.current = value?.id ?? null;
    setSelectedState(value);
  }, []);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [fulfillment, setFulfillment] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editor, setEditor] = useState<{ item: MenuItem | null } | null>(null);
  const [editorError, setEditorError] = useState("");
  const [categoryEditor, setCategoryEditor] = useState<{
    item: MenuCategory | null;
  } | null>(null);
  const [categoryError, setCategoryError] = useState("");
  const [cancellation, setCancellation] = useState<OrderDetail | null>(null);
  const [cancellationError, setCancellationError] = useState("");
  const working = useRef(false);
  const refresh = useCallback(async () => {
    const version = ++refreshVersion.current;
    const id = selectedId.current;
    const [orders, catalog, detail, history] = await Promise.all([
      api<AdminDashboard>("/api/admin/orders"),
      api<typeof menu>("/api/admin/menu"),
      id
        ? api<OrderDetail>(
            "/api/admin/orders?orderId=" + encodeURIComponent(id),
          ).catch((err) => {
            if (err instanceof RequestError && err.status === 404) return null;
            throw err;
          })
        : Promise.resolve(null),
      api<{ entries: CatalogAuditEntry[] }>("/api/admin/catalog-audit"),
    ]);
    if (version !== refreshVersion.current) return;
    setDashboard(orders);
    setMenu(catalog);
    setAudit(history.entries);
    if (id && selectedId.current === id) setSelected(detail);
  }, [setSelected]);
  useEffect(() => {
    let active = true;
    api<{ configured: boolean; authenticated: boolean }>("/api/admin/auth")
      .then(async (session) => {
        if (!active) return;
        setAuth(session);
        if (session.authenticated) await refresh();
      })
      .catch((err) => {
        if (active)
          setError(
            err instanceof Error
              ? err.message
              : "Không thể tải trang quản trị.",
          );
      });
    return () => {
      active = false;
    };
  }, [refresh]);
  const announce = () => {
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel("kfc-storefront-state");
      channel.postMessage("changed");
      channel.close();
    }
  };
  const clearStaffView = useCallback(() => {
    setCancellation(null);
    setCancellationError("");
    setAudit([]);
    refreshVersion.current++;
    setCategoryEditor(null);
    setCategoryError("");
    setAuth({ configured: true, authenticated: false });
    setSelected(null);
    setDashboard(emptyDashboard);
    setMenu({ items: [], categories: [] });
    setEditor(null);
    setEditorError("");
  }, [setSelected]);
  useEffect(() => {
    if (!auth?.authenticated) return;
    let stopped = false;
    let synchronizing = false;
    const sync = async () => {
      if (
        stopped ||
        synchronizing ||
        working.current ||
        editor ||
        categoryEditor ||
        cancellation ||
        document.hidden
      )
        return;
      synchronizing = true;
      try {
        await refresh();
      } catch (err) {
        if (stopped) return;
        if (err instanceof RequestError && err.status === 401) clearStaffView();
        setError(
          "Không thể đồng bộ dữ liệu quản trị. Vui lòng làm mới hoặc đăng nhập lại.",
        );
      } finally {
        synchronizing = false;
      }
    };
    const channel =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel("kfc-storefront-state")
        : null;
    if (channel)
      channel.onmessage = () => {
        void sync();
      };
    const wake = () => {
      if (!document.hidden) void sync();
    };
    const timer = window.setInterval(() => {
      void sync();
    }, 15000);
    window.addEventListener("focus", wake);
    document.addEventListener("visibilitychange", wake);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      channel?.close();
      window.removeEventListener("focus", wake);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [auth?.authenticated, refresh, clearStaffView, editor, categoryEditor, cancellation]);
  const run = async (operation: () => Promise<void>) => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await operation();
    } catch (err) {
      if (err instanceof RequestError && err.status === 401) {
        clearStaffView();
      }
      setError(
        err instanceof Error ? err.message : "Thao tác chưa thành công.",
      );
    } finally {
      working.current = false;
      setBusy(false);
    }
  };
  const changeStatus = (nextStatus: OrderStatus) =>
    run(async () => {
      if (!selected) return;
      setSelected(
        await api<OrderDetail>("/api/admin/orders", {
          method: "PATCH",
          body: JSON.stringify({
            orderId: selected.id,
            expectedStatus: selected.status,
            nextStatus,
          }),
        }),
      );
      announce();
      setNotice("Đã cập nhật trạng thái đơn demo.");
      await refresh().catch((err) => {
        if (err instanceof RequestError && err.status === 401) clearStaffView();
        setError(
          "Trạng thái đã được lưu. Chưa tải được danh sách mới; vui lòng làm mới dữ liệu.",
        );
      });
    });
  const cancelOrder = async (reason: string) => {
    if (working.current || !cancellation) return;
    working.current = true;
    setBusy(true);
    setCancellationError("");
    try {
      const result = await api<OrderDetail>("/api/admin/orders", {
        method: "PATCH",
        body: JSON.stringify({ orderId: cancellation.id, expectedStatus: cancellation.status,
          nextStatus: "CANCELLED", cancellationReason: reason }),
      });
      setSelected(result);
      setCancellation(null);
      setNotice("Đã huỷ đơn và lưu lý do hiển thị cho khách.");
      announce();
      await refresh().catch((err) => {
        if (err instanceof RequestError && err.status === 401) clearStaffView();
        setError("Đơn đã được huỷ. Chưa tải được dữ liệu mới; hãy làm mới trước khi thao tác tiếp.");
      });
    } catch (err) {
      if (err instanceof RequestError && err.status === 401) {
        clearStaffView();
        setError("Phiên quản trị đã hết hạn. Vui lòng đăng nhập lại.");
      } else setCancellationError(err instanceof Error ? err.message : "Chưa thể huỷ đơn. Hãy kiểm tra trạng thái trước khi thử lại.");
    } finally {
      working.current = false;
      setBusy(false);
    }
  };
  const saveMenu = async (data: object) => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setEditorError("");
    let committed = false;
    try {
      await api("/api/admin/menu", {
        method: editor?.item ? "PATCH" : "POST",
        body: JSON.stringify(data),
      });
      committed = true;
      setEditor(null);
      announce();
      setNotice("Đã lưu thực đơn.");
      await refresh();
    } catch (err) {
      if (err instanceof RequestError && err.status === 401) clearStaffView();
      if (committed) {
        setError(
          "Món đã được lưu. Chưa tải được thực đơn mới; vui lòng làm mới dữ liệu.",
        );
      } else {
        setEditorError(
          err instanceof Error ? err.message : "Không thể lưu món.",
        );
      }
    } finally {
      working.current = false;
      setBusy(false);
    }
  };
  const download = () => {
    const text = ordersCsv(visibleOrders);
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "kfc-orders-demo.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const saveCategory = async (data: object) => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setCategoryError("");
    setError("");
    let committed = false;
    try {
      await api("/api/admin/categories", {
        method: categoryEditor?.item ? "PATCH" : "POST",
        body: JSON.stringify(data),
      });
      committed = true;
      setCategoryEditor(null);
      announce();
      setNotice("Đã lưu danh mục.");
      await refresh();
    } catch (err) {
      if (err instanceof RequestError && err.status === 401) clearStaffView();
      if (committed)
        setError(
          "Danh mục đã được lưu. Chưa tải được dữ liệu mới; vui lòng làm mới.",
        );
      else
        setCategoryError(
          err instanceof Error ? err.message : "Không thể lưu danh mục.",
        );
    } finally {
      working.current = false;
      setBusy(false);
    }
  };
  const filters = { status: filter, search, fulfillment, from, to };
  const invalidRange = invalidDateRange(filters);
  const visibleOrders = filterOrders(dashboard.orders, filters);
  const stats =
    tab === "menu" || tab === "audit" || tab === "promotions" || tab === "kitchen" || tab === "shop" || tab === "feedback"
      ? dashboard.stats
      : summarizeOrders(visibleOrders);
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link href="/chat" className="admin-brand">
          KFC<span>OPERATIONS</span>
        </Link>
        <p className="admin-side-caption">Không gian vận hành</p>
        <nav aria-label="Quản trị">
          <button
            aria-current={tab === "orders" ? "page" : undefined}
            onClick={() => setTab("orders")}
          >
            01 <span>Đơn hàng</span>
          </button>
          <button
            aria-current={tab === "menu" ? "page" : undefined}
            onClick={() => setTab("menu")}
          >
            02 <span>Thực đơn</span>
          </button>
          <button
            aria-current={tab === "reports" ? "page" : undefined}
            onClick={() => setTab("reports")}
          >
            03 <span>Báo cáo</span>
          </button>
          <button
            aria-current={tab === "audit" ? "page" : undefined}
            onClick={() => setTab("audit")}
          >
            04 <span>Nhật ký</span>
          </button>
          <button
            aria-current={tab === "promotions" ? "page" : undefined}
            onClick={() => setTab("promotions")}
          >
            05 <span>Khuyến mãi</span>
          </button>
          <button aria-current={tab === "kitchen" ? "page" : undefined} onClick={() => setTab("kitchen")}>
            06 <span>Bảng bếp</span>
          </button>
          <button aria-current={tab === "shop" ? "page" : undefined} onClick={() => setTab("shop")}>
            07 <span>Cửa hàng</span>
          </button>
          <button aria-current={tab === "feedback" ? "page" : undefined} onClick={() => setTab("feedback")}>
            08 <span>Đánh giá</span>
          </button>
        </nav>
        <div className="admin-side-bottom">
          <span>GRADUATION PROJECT</span>
          <p>
            Vận hành nội bộ bản demo.
            <br />
            Không kết nối bếp hoặc giao vận thật.
          </p>
          <Link href="/chat">← Về trang đặt món</Link>
        </div>
      </aside>
      <main className="admin-main">
        <header className="admin-header">
          <div>
            <span className="eyebrow">KFC FORCE AGENT / QUẢN TRỊ</span>
            <h1>
              {tab === "feedback" ? "Sau bữa ăn, lắng nghe khách." : tab === "shop" ? "Mở cửa đúng lúc. Nhận đơn đúng điều kiện." : tab === "kitchen" ? "Nhịp bếp. Theo từng đơn." : tab === "orders"
                ? "Bếp sẵn sàng. Đơn lên thôi."
                : tab === "menu"
                  ? "Thực đơn, theo cách của bạn."
                  : tab === "audit"
                    ? "Mọi thay đổi, đều có dấu vết."
                    : tab === "promotions"
                      ? "Ưu đãi đúng lúc. Bữa ngon thêm vui."
                      : "Con số kể chuyện bữa ngon."}
            </h1>
          </div>
          <span className="status-badge">HỆ THỐNG DEMO</span>
        </header>
        {error && (
          <div className="error-box page-alert" role="alert">
            <span>{error}</span>
            <button
              className="text-button"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const session = await api<{
                    configured: boolean;
                    authenticated: boolean;
                  }>("/api/admin/auth");
                  setAuth(session);
                  if (session.authenticated) await refresh();
                })
              }
            >
              Tải lại dữ liệu
            </button>
          </div>
        )}
        {notice && (
          <div className="notice-box" role="status">
            {notice}
          </div>
        )}
        {!auth && !error && (
          <p role="status" className="muted">
            Đang kiểm tra phiên quản trị…
          </p>
        )}
        {auth && !auth.authenticated && (
          <section className="panel admin-login">
            <span className="eyebrow">CHỈ DÀNH CHO NGƯỜI QUẢN TRỊ</span>
            <h2>Đăng nhập vận hành</h2>
            <p className="muted">
              Quản lý đơn, món và dữ liệu demo từ một nơi.
            </p>
            {!auth.configured && (
              <div className="notice-box">
                Chưa thiết lập mật khẩu. Chạy <code>npm run admin:setup</code>{" "}
                trên máy chủ, rồi tải lại trang. Không có mật khẩu mặc định.
              </div>
            )}
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const password = String(
                  new FormData(event.currentTarget).get("password"),
                );
                run(async () => {
                  await api("/api/admin/auth", {
                    method: "POST",
                    body: JSON.stringify({ password }),
                  });
                  setAuth({ configured: true, authenticated: true });
                  await refresh();
                });
              }}
            >
              <label>
                Mật khẩu quản trị
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  maxLength={128}
                  disabled={busy || !auth.configured}
                />
              </label>
              <button
                type="submit"
                className="button primary full-width"
                disabled={busy || !auth.configured}
              >
                {busy ? "Đang đăng nhập…" : "Đăng nhập quản trị"}
              </button>
            </form>
            <Link className="text-button" href="/chat">
              Tiếp tục đặt món với tư cách khách →
            </Link>
          </section>
        )}
        {auth?.authenticated && (
          <>
            <div className="admin-session-bar">
              <p>
                Phạm vi thống kê: tối đa {dashboard.stats.sampleLimit} đơn gần
                nhất.
              </p>
              <div>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await refresh();
                    })
                  }
                >
                  Làm mới
                </button>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await api("/api/admin/auth", { method: "DELETE" });
                      clearStaffView();
                    })
                  }
                >
                  Đăng xuất
                </button>
              </div>
            </div>
            {(tab === "orders" || tab === "reports") && (
              <section
                className="panel order-report-filters"
                aria-label="Lọc đơn và báo cáo"
              >
                <div className="section-heading">
                  <h2>Lọc đơn & báo cáo</h2>
                  <button
                    className="text-button"
                    onClick={() => {
                      setSearch("");
                      setFilter("all");
                      setFulfillment("all");
                      setFrom("");
                      setTo("");
                    }}
                  >
                    Xoá bộ lọc
                  </button>
                </div>
                <div className="order-filter-grid">
                  <label>
                    Tìm đơn
                    <input
                      value={search}
                      maxLength={100}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Mã đơn, tên hoặc điện thoại…"
                    />
                  </label>
                  <label>
                    Trạng thái
                    <select
                      value={filter}
                      onChange={(event) => setFilter(event.target.value)}
                    >
                      <option value="all">Tất cả trạng thái</option>
                      {Object.entries(orderStatusLabels).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Hình thức nhận
                    <select
                      value={fulfillment}
                      onChange={(event) => setFulfillment(event.target.value)}
                    >
                      <option value="all">Tất cả hình thức</option>
                      <option value="pickup">Nhận tại cửa hàng</option>
                      <option value="delivery">Giao hàng</option>
                    </select>
                  </label>
                  <label>
                    Từ ngày
                    <input
                      type="date"
                      value={from}
                      onChange={(event) => setFrom(event.target.value)}
                    />
                  </label>
                  <label>
                    Đến ngày
                    <input
                      type="date"
                      value={to}
                      onChange={(event) => setTo(event.target.value)}
                    />
                  </label>
                </div>
                {invalidRange && (
                  <p className="error-box" role="alert">
                    Khoảng ngày không hợp lệ. Ngày bắt đầu phải trước hoặc bằng
                    ngày kết thúc.
                  </p>
                )}
                <p className="small muted" role="status">
                  Đang xem {visibleOrders.length}/{dashboard.orders.length} đơn
                  gần nhất. Bộ lọc áp dụng cho danh sách, thống kê và CSV; ngày
                  tính theo giờ Việt Nam.
                </p>
              </section>
            )}
            <section className="admin-stats" aria-label="Tổng quan đơn hàng">
              {[
                ["Đơn ghi nhận", stats.totalOrders, "Tất cả trạng thái"],
                ["Đang xử lý", stats.activeOrders, "Chưa hoàn tất / huỷ"],
                ["Đã hoàn tất", stats.completedOrders, "Đi hết luồng demo"],
                [
                  "Giá trị hoàn tất",
                  money(stats.completedValue),
                  "Giá trị đơn demo, không phải tiền thu",
                ],
              ].map(([label, value, hint]) => (
                <article key={label} className="panel">
                  <span>{label}</span>
                  <strong>{value}</strong>
                  <small>{hint}</small>
                </article>
              ))}
            </section>
            {tab === "orders" && (
              <section className="admin-orders">
                <div className="admin-order-list">
                  <div className="section-heading">
                    <h2>Hàng đợi đơn</h2>
                    <span className="count-badge">{visibleOrders.length}</span>
                  </div>
                  {!visibleOrders.length && (
                    <div className="panel empty-state">
                      <h3>Chưa có đơn phù hợp.</h3>
                      <p className="muted">
                        Đặt một đơn từ giao diện khách để bắt đầu demo.
                      </p>
                    </div>
                  )}
                  {visibleOrders.map((order) => (
                    <button
                      className={`order-card ${selected?.id === order.id ? "selected" : ""}`}
                      disabled={busy}
                      key={order.id}
                      onClick={() =>
                        run(async () =>
                          setSelected(
                            await api<OrderDetail>(
                              `/api/admin/orders?orderId=${order.id}`,
                            ),
                          ),
                        )
                      }
                    >
                      <span>
                        <strong>
                          #{order.id.slice(-8).toUpperCase()} ·{" "}
                          {order.customerName}
                        </strong>
                        <small>
                          {new Date(order.createdAt).toLocaleString("vi-VN")} ·{" "}
                          {order.fulfillment === "delivery"
                            ? "Giao hàng"
                            : "Đến lấy"}
                        </small>
                      </span>
                      <span>
                        <span className="status-badge">
                          {orderStatusLabels[order.status]}
                        </span>
                        <strong>{money(order.total)}</strong>
                      </span>
                    </button>
                  ))}
                </div>
                <article className="panel admin-order-detail">
                  {!selected ? (
                    <div className="empty-state">
                      <span className="eyebrow">CHỌN MỘT ĐƠN</span>
                      <h3>
                        Chi tiết và bước xử lý tiếp theo sẽ hiển thị ở đây.
                      </h3>
                    </div>
                  ) : (
                    <>
                      <div className="section-heading">
                        <h2>#{selected.id.slice(-8).toUpperCase()}</h2>
                        <span className="status-badge">
                          {orderStatusLabels[selected.status]}
                        </span>
                      </div>
                      <p className="small muted">
                        {selected.customerName} · {selected.phone}
                      </p>
                      <ul className="admin-detail-items">
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
                        <span>Phí giao</span>
                        <strong>{money(selected.deliveryFee)}</strong>
                      </div>
                      <div className="cart-total">
                        <strong>Tổng cộng</strong>
                        <strong>{money(selected.total)}</strong>
                      </div>
                      <div className="order-contact">
                        <strong>
                          {selected.fulfillment === "delivery"
                            ? "Giao hàng demo"
                            : "Nhận tại cửa hàng demo"}
                        </strong>
                        <p>
                          {String(
                            selected.shippingAddress?.address ??
                              "Khách tự đến lấy",
                          )}
                        </p>
                        {selected.note && <p>Ghi chú: {selected.note}</p>}
                      </div>
                      <div className="admin-transition-actions">
                        {nextOrderStatuses(selected).map((status) => (
                          <button
                            key={status}
                            className={`button ${status === "CANCELLED" ? "secondary" : "primary"}`}
                            disabled={busy}
                            onClick={() => {
                              if (status === "CANCELLED") {
                                refreshVersion.current++;
                                setCancellationError("");
                                setCancellation(selected);
                              } else void changeStatus(status);
                            }}
                          >
                            {status === "PREPARING"
                              ? "Bắt đầu chuẩn bị"
                              : status === "READY"
                                ? "Sẵn sàng cho khách lấy"
                                : status === "DELIVERING"
                                  ? "Bắt đầu giao demo"
                                  : status === "COMPLETED"
                                    ? "Xác nhận hoàn tất"
                                    : "Huỷ đơn demo"}
                          </button>
                        ))}
                      </div>
                      <ol
                        className="order-events"
                        aria-label="Lịch sử vận hành"
                      >
                        {selected.events.map((event) => (
                          <li key={event.id}>
                            <strong>
                              {orderStatusLabels[event.type as OrderStatus] ??
                                event.type}
                              {event.metadata?.actor === "admin"
                                ? " · Quản trị"
                                : ""}
                            </strong>
                            {event.type === "CANCELLED" && typeof event.metadata?.cancellationReason === "string" && (
                              <p>Lý do huỷ: {event.metadata.cancellationReason}</p>
                            )}
                            <time dateTime={event.createdAt}>
                              {new Date(event.createdAt).toLocaleString(
                                "vi-VN",
                              )}
                            </time>
                          </li>
                        ))}
                      </ol>
                    </>
                  )}
                </article>
              </section>
            )}
            {tab === "menu" && (
              <section>
                <section
                  className="category-admin-section"
                  aria-labelledby="admin-categories-title"
                >
                  <div className="section-heading">
                    <h2 id="admin-categories-title">Phân loại thực đơn</h2>
                    <button
                      className="button secondary"
                      disabled={busy}
                      onClick={() => {
                        setCategoryError("");
                        setCategoryEditor({ item: null });
                      }}
                    >
                      + Thêm danh mục
                    </button>
                  </div>
                  <p className="small muted admin-section-description">
                    Sắp xếp nhóm món trên trang khách. Chuyển hết món sang nhóm
                    khác trước khi tắt danh mục.
                  </p>
                  <div className="category-admin-grid">
                    {menu.categories.map((category) => (
                      <article className="panel" key={category.id}>
                        <span
                          className={
                            "status-badge " +
                            (category.isActive ? "" : "cancelled")
                          }
                        >
                          {category.isActive ? "Đang dùng" : "Đã tắt"}
                        </span>
                        <h3>{category.name}</h3>
                        {category.description && (
                          <p className="small muted">{category.description}</p>
                        )}
                        <div className="section-heading">
                          <span className="small muted">
                            Thứ tự {category.displayOrder} ·{" "}
                            {
                              menu.items.filter(
                                (item) => item.categoryId === category.id,
                              ).length
                            }{" "}
                            món
                          </span>
                          <button
                            className="text-button"
                            disabled={busy}
                            onClick={() => {
                              setCategoryError("");
                              setCategoryEditor({ item: category });
                            }}
                          >
                            Sửa danh mục {category.name}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
                <div className="section-heading">
                  <h2>Danh mục món ăn</h2>
                  <button
                    className="button primary"
                    disabled={busy}
                    onClick={() => {
                      setEditorError("");
                      setEditor({ item: null });
                    }}
                  >
                    + Thêm món mới
                  </button>
                </div>
                <p className="muted small admin-section-description">
                  Giữ món cũ trong dữ liệu; tắt hiển thị hoặc đánh dấu hết món
                  khi cần.
                </p>
                <div className="admin-catalog">
                  {menu.items.map((item) => (
                    <article key={item.id} className="panel">
                      <span
                        className={`status-badge ${!item.isActive || !item.isAvailable ? "cancelled" : ""}`}
                      >
                        {!item.isActive
                          ? "Đã ẩn"
                          : item.isAvailable
                            ? "Đang bán"
                            : "Hết món"}
                      </span>
                      <h3>{item.name}</h3>
                      <p>{item.description}</p>
                      <div className="section-heading">
                        <strong>{money(item.price)}</strong>
                        <button
                          disabled={busy}
                          className="text-button"
                          onClick={() => {
                            setEditorError("");
                            setEditor({ item });
                          }}
                        >
                          Chỉnh sửa {item.name}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}
            {tab === "reports" && (
              <section className="panel admin-reports">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">DỮ LIỆU THẬT TRONG BẢN DEMO</span>
                    <h2>Đơn theo ngày đặt</h2>
                  </div>
                  <button
                    className="button secondary"
                    onClick={download}
                    disabled={invalidRange || !visibleOrders.length}
                  >
                    Xuất CSV ({visibleOrders.length})
                  </button>
                </div>
                <p className="small muted">
                  Tối đa 14 ngày có dữ liệu trong {dashboard.stats.sampleLimit}{" "}
                  đơn gần nhất. Giá trị chỉ cộng đơn đã hoàn tất, không phản ánh
                  giao dịch thanh toán thật.
                </p>
                {!stats.daily.length && (
                  <div className="empty-state">
                    <h3>Chưa có dữ liệu báo cáo.</h3>
                  </div>
                )}
                <div
                  className="daily-chart"
                  role="img"
                  aria-label="Biểu đồ số đơn theo ngày; bảng dữ liệu đầy đủ bên dưới"
                >
                  {stats.daily.map((day) => (
                    <div key={day.date}>
                      <strong>{day.count}</strong>
                      <span
                        style={{
                          height: `${Math.max(4, (day.count / Math.max(1, ...stats.daily.map((point) => point.count))) * 120)}px`,
                        }}
                      />
                      <small>{day.date.slice(5)}</small>
                    </div>
                  ))}
                </div>
                <div className="table-scroll">
                  <table>
                    <caption className="sr-only">
                      Thống kê theo ngày đặt
                    </caption>
                    <thead>
                      <tr>
                        <th>Ngày</th>
                        <th>Số đơn</th>
                        <th>Giá trị đơn hoàn tất</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.daily.map((day) => (
                        <tr key={day.date}>
                          <td>{day.date}</td>
                          <td>{day.count}</td>
                          <td>{money(day.value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="small muted">
                  CSV không chứa tên, số điện thoại hoặc địa chỉ khách hàng.
                </p>
              </section>
            )}
            {tab === "reports" && (
              <SalesReportPanel
                filters={filters}
                basisRevision={dashboard.revision}
                onExpired={clearStaffView}
              />
            )}
            {tab === "feedback" && <FeedbackPanel onExpired={clearStaffView} onChanged={announce} />}
            {tab === "shop" && <ShopSettingsPanel onExpired={clearStaffView} onChanged={announce} />}
            {tab === "kitchen" && <KitchenBoardPanel onExpired={clearStaffView} locked={busy}
              onOpenOrder={(id) => void run(async () => {
                const detail = await api<OrderDetail>("/api/admin/orders?orderId=" + encodeURIComponent(id));
                setSelected(detail);
                setFilter("all"); setSearch(""); setFulfillment("all"); setFrom(""); setTo("");
                setTab("orders");
              })} />}
            {tab === "audit" && <CatalogAuditPanel entries={audit} />}
            {tab === "promotions" && (
              <PromotionPanel onExpired={clearStaffView} onChanged={announce} />
            )}
          </>
        )}
        <footer className="admin-footer">
          KFC Force Agent · Hệ thống quản trị phục vụ khóa luận · Mọi trạng thái
          là nội bộ demo
        </footer>
      </main>
      {cancellation && (
        <CancelOrderDialog order={cancellation} busy={busy} error={cancellationError}
          onClose={() => { setCancellation(null); setCancellationError(""); }}
          onConfirm={(reason) => void cancelOrder(reason)} />
      )}
      {editor && (
        <MenuEditor
          item={editor.item}
          categories={menu.categories}
          busy={busy}
          error={editorError}
          onClose={() => setEditor(null)}
          onSave={saveMenu}
        />
      )}
      {categoryEditor && (
        <CategoryEditor
          category={categoryEditor.item}
          itemCount={
            menu.items.filter(
              (item) => item.categoryId === categoryEditor.item?.id,
            ).length
          }
          busy={busy}
          error={categoryError}
          onClose={() => setCategoryEditor(null)}
          onSave={saveCategory}
        />
      )}
    </div>
  );
}
