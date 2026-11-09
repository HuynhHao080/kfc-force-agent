"use client";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MenuCategory, MenuItem } from "@/lib/types/menu";
import type { Order } from "@/lib/types/order";
import type { PendingConfirmation } from "@/lib/agent/confirmation";
import type { ChatResponse } from "@/lib/types/domain";
import {
  api,
  RequestError,
  type StorefrontSnapshot,
  money,
  type Basket,
  type ChatTurn,
  type OrderDetail,
} from "@/lib/storefront-types";
import { AddressBookDialog } from "./address-book-dialog";
import type { AddressBook } from "@/lib/types/address-book";
import type { CheckoutQuote } from "@/lib/types/promotion";
import { AccountDialog } from "./account-dialog";
import { AccountSettingsDialog } from "./account-settings-dialog";
import type { ShopView } from "@/lib/types/shop";
import { shopDayLabels } from "@/lib/shop-settings";
import type { CustomerProfile } from "@/lib/types/account";
import { CartPanel } from "./cart-panel";
import { CheckoutDialog, type CheckoutInput } from "./checkout-dialog";
import { OrderPanel } from "./order-panel";
import { FeedbackDialog } from "./feedback-dialog";
import type { FeedbackView, OrderFeedback } from "@/lib/types/feedback";
import { ReorderDialog } from "./reorder-dialog";
import type { ReorderPreview } from "@/lib/types/reorder";
import { ChatWindow } from "@/components/chat/chat-window";

const welcome: ChatTurn = {
  role: "assistant",
  content:
    "Chào bạn! Mình giúp bạn tìm món và chuẩn bị giỏ hàng nhé. Thử nói: “Thêm 2 Pepsi vào giỏ hàng”.",
};
const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase();
async function bootstrap() {
  return api<StorefrontSnapshot>("/api/storefront");
}
export function Storefront() {
  const [shop, setShop] = useState<ShopView | null>(null);
  const shopReadVersion = useRef(0);
  const applyShop = useCallback((value: ShopView) => { shopReadVersion.current++; setShop(value); }, []);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addressesOpen, setAddressesOpen] = useState(false);
  const [addressBook, setAddressBook] = useState<AddressBook | null>(null);
  const selectedId = useRef<string | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [basket, setBasket] = useState<Basket>({ cart: null, items: [] });
  const [orders, setOrders] = useState<Order[]>([]);
  const [selected, setSelected] = useState<OrderDetail | null>(null);
  const [messages, setMessages] = useState<ChatTurn[]>([welcome]);
  const [pending, setPending] = useState<PendingConfirmation | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [feedbackDraft, setFeedbackDraft] = useState<{ orderId: string; feedback: OrderFeedback | null } | null>(null);
  const [reorder, setReorder] = useState<ReorderPreview | null>(null);
  const [reorderError, setReorderError] = useState("");
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"menu" | "orders">("menu");
  const [cartOpen, setCartOpen] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const boot = useRef<ReturnType<typeof bootstrap> | null>(null);
  const working = useRef(false);
  const owner = useRef<string | null>(null);
  const refreshVersion = useRef(0);
  const changes = useRef<BroadcastChannel | null>(null);
  const checkoutKey = useRef<string | null>(null);
  const [checkoutAttempt, setCheckoutAttempt] = useState<{ idempotencyKey: string; cartId: string } | null>(null);
  const cancelDialog = useRef<HTMLDialogElement>(null);
  const cartMenuRef = useRef<HTMLDivElement>(null);
  const cartTriggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!cartOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !cartMenuRef.current?.contains(event.target)
      ) {
        setCartOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCartOpen(false);
        cartTriggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [cartOpen]);
  useEffect(() => {
    let active = true;
    boot.current ??= bootstrap();
    boot.current
      .then(
        ({
          ownerId,
          shop: loadedShop,
          session,
          menu,
          basket: loadedBasket,
          history,
          addressBook: loadedAddresses,
        }) => {
          if (!active) return;
          owner.current = ownerId;
          applyShop(loadedShop);
          setAddressBook(loadedAddresses);
          setProfile(session.profile);
          setItems(menu.items);
          setCategories(menu.categories);
          setBasket(loadedBasket ?? { cart: null, items: [] });
          setOrders(history.orders);
          setMessages(session.messages.length ? session.messages : [welcome]);
          setPending(session.pendingConfirmation ?? null);
          setReady(true);
        },
      )
      .catch((err) => {
        if (active)
          setError(
            err instanceof Error ? err.message : "Không thể tải dữ liệu.",
          );
      });
    return () => {
      active = false;
    };
  }, [applyShop]);
  useEffect(() => {
    if (cancelId) cancelDialog.current?.showModal();
  }, [cancelId]);
  const clearIdentityView = useCallback(() => {
    refreshVersion.current++;
    owner.current = null;
    setCheckoutOpen(false);
    setReorder(null);
    setFeedbackDraft(null);
    setReorderError("");
    setSettingsOpen(false);
    setAddressesOpen(false);
    setAddressBook(null);
    setCancelId(null);
    cancelDialog.current?.close();
    selectedId.current = null;
    checkoutKey.current = null;
    setCheckoutAttempt(null);
    setProfile(null);
    setSelected(null);
    setBasket({ cart: null, items: [] });
    setOrders([]);
    setMessages([welcome]);
    setPending(null);
    setTab("menu");
    setReady(false);
  }, []);
  const refresh = useCallback(async () => {
    const version = ++refreshVersion.current;
    const detailId = selectedId.current;
    const snapshot = await api<StorefrontSnapshot>(
      "/api/storefront" +
        (detailId ? "?orderId=" + encodeURIComponent(detailId) : ""),
    );
    const { session, menu, history, detail } = snapshot;
    const updated = snapshot.basket ?? { cart: null, items: [] };
    // An older response must not restore private state after switching identity.
    if (version !== refreshVersion.current) return;
    if (owner.current && owner.current !== snapshot.ownerId)
      clearIdentityView();
    owner.current = snapshot.ownerId;
    applyShop(snapshot.shop);
    setAddressBook(snapshot.addressBook);
    setBasket(updated);
    setOrders(history.orders);
    setProfile(session.profile);
    setItems(menu.items);
    setCategories(menu.categories);
    setPending(session.pendingConfirmation ?? null);
    setMessages(session.messages.length ? session.messages : [welcome]);
    if (detail && selectedId.current === detail.id) setSelected(detail);
    else if (detailId && selectedId.current === detailId && !detail) {
      selectedId.current = null;
      setSelected(null);
    }
    setReady(true);
  }, [clearIdentityView, applyShop]);
  useEffect(() => {
    const sync = () => {
      if (
        working.current ||
        !ready ||
        checkoutOpen ||
        reorder ||
        feedbackDraft ||
        accountOpen ||
        settingsOpen ||
        addressesOpen
      )
        return;
      refresh().catch(() =>
        setError(
          "Không thể đồng bộ dữ liệu mới. Vui lòng kiểm tra kết nối rồi tải lại trang.",
        ),
      );
    };
    const onVisibility = () => {
      if (!document.hidden) sync();
    };
    const channel =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel("kfc-storefront-state")
        : null;
    changes.current = channel;
    if (channel) channel.onmessage = sync;
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", onVisibility);
      channel?.close();
      if (changes.current === channel) changes.current = null;
    };
  }, [
    refresh,
    ready,
    checkoutOpen,
    reorder,
    feedbackDraft,
    accountOpen,
    settingsOpen,
    addressesOpen,
  ]);
  useEffect(() => {
    if (!pending) return;
    const timer = window.setTimeout(
      () => {
        setPending(null);
        setNotice(
          "Đề xuất đã hết hạn. Vui lòng gửi lại yêu cầu để xác nhận thay đổi mới.",
        );
      },
      Math.max(0, Date.parse(pending.expiresAt) - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [pending]);
  useEffect(() => {
    let active = true, fetching = false;
    let controller: AbortController | undefined;
    const syncShop = async () => {
      if (fetching || document.hidden) return;
      fetching = true;
      const version = ++shopReadVersion.current;
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 20000);
      try {
        const view = await api<ShopView>("/api/shop", { signal: controller.signal });
        if (active && version === shopReadVersion.current) setShop(view);
      } catch {
        if (active && version === shopReadVersion.current) setShop(null);
      } finally { fetching = false; window.clearTimeout(timeout); }
    };
    const wake = () => { void syncShop(); };
    const timer = window.setInterval(wake, 30000);
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("kfc-shop-settings") : null;
    if (channel) channel.onmessage = wake;
    window.addEventListener("focus", wake);
    document.addEventListener("visibilitychange", wake);
    return () => { active = false; controller?.abort(); window.clearInterval(timer); channel?.close();
      window.removeEventListener("focus", wake); document.removeEventListener("visibilitychange", wake); };
  }, []);
  const customerRequest = <T,>(url: string, options?: RequestInit) => {
    const headers = new Headers(options?.headers);
    if (owner.current) headers.set("X-KFC-Owner", owner.current);
    return api<T>(url, { ...options, headers });
  };
  const run = async (operation: () => Promise<void>) => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await operation();
    } catch (err) {
      if (
        err instanceof RequestError &&
        (err.status === 401 || err.code === "IDENTITY_CHANGED")
      ) {
        clearIdentityView();
        await refresh().catch(() => {});
      }
      if (err instanceof RequestError && err.code === "CART_CHANGED") await refresh().catch(() => {});
      setError(
        err instanceof Error
          ? err.message
          : "Thao tác chưa thành công. Vui lòng thử lại.",
      );
    } finally {
      working.current = false;
      setBusy(false);
      changes.current?.postMessage("changed");
    }
  };
  const prepareReorder = (orderId: string) =>
    run(async () => {
      setReorderError("");
      setReorder(
        await customerRequest<ReorderPreview>("/api/orders/reorder", {
          method: "POST",
          body: JSON.stringify({ orderId }),
        }),
      );
    });
  const confirmReorder = async () => {
    if (working.current || !reorder) return;
    working.current = true;
    setBusy(true);
    setReorderError("");
    try {
      const result = await customerRequest<Basket & { replayed: boolean }>(
        "/api/orders/reorder",
        {
          method: "PUT",
          body: JSON.stringify({
            confirmationToken: reorder.confirmationToken,
            confirm: true,
          }),
        },
      );
      setBasket(result);
      setPending(null);
      checkoutKey.current = null;
      setCheckoutAttempt(null);
      setReorder(null);
      setTab("menu");
      setNotice(
        result.replayed
          ? "Yêu cầu đặt lại này đã được xử lý trước đó. Đây là giỏ hiện tại, không thêm món lần nữa."
          : "Đã thêm lại món vào giỏ theo giá hiện tại. Chưa tạo đơn mới; hãy kiểm tra giỏ và checkout.",
      );
      await refresh().catch(() =>
        setError(
          "Món đã thêm vào giỏ. Chưa tải được dữ liệu mới; hãy làm mới trước khi thao tác tiếp.",
        ),
      );
    } catch (err) {
      if (
        err instanceof RequestError &&
        (err.status === 401 || err.code === "IDENTITY_CHANGED")
      ) {
        clearIdentityView();
        setError(
          "Phiên đã thay đổi. Hãy xem lại tài khoản trước khi thao tác.",
        );
        await refresh().catch(() => {});
      } else
        setReorderError(
          err instanceof Error
            ? err.message
            : "Chưa thể đặt lại. Hãy kiểm tra giỏ trước khi thử lại.",
        );
    } finally {
      working.current = false;
      setBusy(false);
      changes.current?.postMessage("changed");
    }
  };
  const mutateCart = (
    url: string,
    method: string,
    body?: object,
    message?: string,
  ) =>
    run(async () => {
      let updated: Basket;
      try {
        updated = await customerRequest<Basket>(url, {
          method,
          headers: { "X-KFC-Cart-Signature": basket.signature ?? "empty" },
          body: body ? JSON.stringify(body) : undefined,
        });
      } catch (err) {
        if (!(err instanceof RequestError) || err.status >= 500)
          throw new Error("Chưa xác định được thao tác giỏ đã lưu hay chưa. Hãy tải lại trang và kiểm tra số lượng trước khi sửa tiếp.");
        throw err;
      }
      setBasket(updated);
      setPending(null);
      checkoutKey.current = null;
      setCheckoutAttempt(null);
      if (message) setNotice(message);
    });
  const sendMessage = (message: string, confirmation?: PendingConfirmation) =>
    run(async () => {
      setMessages((previous) => [
        ...previous,
        { role: "user", content: message },
      ]);
      setChatBusy(true);
      try {
        const response = await customerRequest<ChatResponse>("/api/chat", {
          method: "POST",
          body: JSON.stringify({
            message,
            confirm: !!confirmation,
            confirmationId: confirmation?.id,
          }),
        });
        setMessages((previous) => [
          ...previous,
          { role: "assistant", content: response.reply },
        ]);
        setPending(response.pendingConfirmation ?? null);
        checkoutKey.current = null;
        setCheckoutAttempt(null);
        await refresh();
      } finally {
        setChatBusy(false);
      }
    });
  const finishCheckout = async (order: OrderDetail, recovered = false) => {
    selectedId.current = order.id;
    setSelected(order);
    setCheckoutOpen(false);
    setCheckoutError("");
    setPending(null);
    setTab("orders");
    requestAnimationFrame(() => document.getElementById("orders-title")?.focus());
    setNotice(recovered
      ? "Đã tìm thấy đơn từ yêu cầu vừa gửi. Hãy kiểm tra thông tin đã lưu trong chi tiết đơn."
      : "Đã ghi nhận đơn demo của bạn. Bạn có thể xem lại thông tin bên dưới.");
    checkoutKey.current = null;
    setCheckoutAttempt(null);
    await refresh().catch(() => setError("Đơn đã được lưu. Chưa tải được dữ liệu mới; hãy làm mới trước khi thao tác tiếp."));
  };
  const recoverCheckout = async (attempt: { idempotencyKey: string; cartId: string }) => {
    const result = await customerRequest<{ order: OrderDetail | null }>("/api/checkout/status", {
      method: "POST", body: JSON.stringify(attempt),
    });
    if (!result.order) return false;
    await finishCheckout(result.order, true);
    return true;
  };
  const checkoutIdentityChanged = (err: unknown) =>
    err instanceof RequestError && (err.status === 401 || err.code === "IDENTITY_CHANGED");
  const checkCheckout = async () => {
    if (working.current || !checkoutAttempt) return;
    working.current = true;
    setBusy(true);
    setCheckoutError("");
    try {
      if (!await recoverCheckout(checkoutAttempt)) {
        setCheckoutError("Chưa tìm thấy đơn cho yêu cầu này. Hãy kiểm tra giỏ và thông tin trước khi gửi lại.");
        await refresh().catch(() => {});
      }
    } catch (err) {
      if (checkoutIdentityChanged(err)) {
        clearIdentityView();
        setError("Phiên đặt món đã thay đổi. Hãy xem lại tài khoản và lịch sử đơn.");
        await refresh().catch(() => {});
      } else setCheckoutError("Chưa kiểm tra được kết quả. Hãy kiểm tra kết nối rồi thử kiểm tra lại; yêu cầu kiểm tra không tạo đơn.");
    } finally {
      working.current = false;
      setBusy(false);
      changes.current?.postMessage("changed");
    }
  };
  const submitOrder = async (input: CheckoutInput) => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setCheckoutError("");
    checkoutKey.current ??= crypto.randomUUID();
    const attempt = { idempotencyKey: checkoutKey.current, cartId: input.cartId };
    setCheckoutAttempt(attempt);
    try {
      const order = await customerRequest<OrderDetail>("/api/orders", {
        method: "POST",
        body: JSON.stringify({ ...input, idempotencyKey: attempt.idempotencyKey }),
      });
      await finishCheckout(order);
    } catch (err) {
      if (checkoutIdentityChanged(err)) {
        clearIdentityView();
        setError("Phiên đặt món đã thay đổi. Hãy xem lại giỏ trước khi đặt đơn.");
      } else {
        if (!(err instanceof RequestError) || err.status >= 500 || err.code === "IDEMPOTENCY_CONFLICT") {
          try {
            if (await recoverCheckout(attempt)) return;
          } catch (recoveryError) {
            if (checkoutIdentityChanged(recoveryError)) {
              clearIdentityView();
              setError("Phiên đặt món đã thay đổi. Hãy xem lại tài khoản và lịch sử đơn.");
              await refresh().catch(() => {});
              return;
            }
          }
        }
        setCheckoutError(err instanceof Error ? err.message : "Chưa thể đặt đơn. Vui lòng kiểm tra kết quả trước khi thử lại.");
      }
      await refresh().catch(() => {});
    } finally {
      working.current = false;
      setBusy(false);
      changes.current?.postMessage("changed");
    }
  };
  const filtered = items.filter(
    (item) =>
      (category === "all" || item.categoryId === category) &&
      normalize(`${item.name} ${item.description ?? ""}`).includes(
        normalize(query),
      ),
  );
  const count = basket.items.reduce((sum, item) => sum + item.quantity, 0);
  const disabled = busy || !ready;
  return (
    <div className="storefront">
      <a href="#main-content" className="skip-link">
        Đến nội dung chính
      </a>
      <header className="site-header">
        <div className="header-inner">
          <Link
            href="/"
            className="wordmark"
            aria-label="KFC Force Agent, trang chủ"
          >
            <span className="brand-stripes" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <strong>
              KFC<span>FORCE AGENT</span>
            </strong>
          </Link>
          <nav aria-label="Điều hướng chính">
            <button
              className={tab === "menu" ? "active" : ""}
              aria-current={tab === "menu" ? "page" : undefined}
              onClick={() => setTab("menu")}
            >
              <span className="nav-icon" aria-hidden="true">☷</span> Thực đơn
            </button>
            <button
              className={tab === "orders" ? "active" : ""}
              aria-current={tab === "orders" ? "page" : undefined}
              onClick={() => setTab("orders")}
            >
              <span className="nav-icon" aria-hidden="true">▤</span> Đơn của tôi{" "}
              {orders.length > 0 && (
                <span className="nav-count">{orders.length}</span>
              )}
            </button>
          </nav>
          <div className="cart-menu" ref={cartMenuRef}>
            <button
              ref={cartTriggerRef}
              className="header-cart"
              type="button"
              aria-expanded={cartOpen}
              aria-controls="cart-dropdown"
              onClick={() => setCartOpen((open) => !open)}
            >
              <svg
                className="cart-icon"
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
              >
                <path
                  d="M3 4h2l2.2 10.1a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 1.9-1.4L21 8H6"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="10" cy="20" r="1.4" fill="currentColor" />
                <circle cx="18" cy="20" r="1.4" fill="currentColor" />
              </svg>
              <span className="header-cart-label">Giỏ hàng</span>
              <b aria-live="polite">{count}</b>
            </button>
            {cartOpen && (
              <div
                className="cart-dropdown"
                id="cart-dropdown"
                role="region"
                aria-label="Giỏ hàng"
              >
                <CartPanel
                  basket={basket}
                  busy={disabled}
                  checkoutDisabled={
                    !shop ||
                    (!shop.availability.canPickup &&
                      !shop.availability.canDelivery)
                  }
                  onQuantity={(id, quantity) =>
                    mutateCart("/api/cart", "PATCH", {
                      itemId: id,
                      quantity,
                    })
                  }
                  onRemove={(id) =>
                    mutateCart(
                      `/api/cart?itemId=${encodeURIComponent(id)}`,
                      "DELETE",
                    )
                  }
                  onCheckout={() => {
                    setCheckoutError("");
                    setCartOpen(false);
                    setCheckoutOpen(true);
                  }}
                  onClose={() => {
                    setCartOpen(false);
                    cartTriggerRef.current?.focus();
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </header>
      <main id="main-content" className="main-shell">
        <div className="customer-toolbar">
          <span>
            {profile
              ? `Xin chào, ${profile.fullName}`
              : "Bạn đang đặt món với phiên khách"}
          </span>
          <div>
            {profile ? (
              <>
                <button
                  className="text-button"
                  disabled={busy || !ready}
                  onClick={() => setSettingsOpen(true)}
                >
                  Tài khoản của tôi
                </button>
                <button
                  className="text-button"
                  disabled={busy || !ready || !addressBook}
                  onClick={() => setAddressesOpen(true)}
                >
                  Sổ địa chỉ
                </button>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await customerRequest("/api/auth/session", {
                        method: "DELETE",
                      });
                      clearIdentityView();
                      setNotice("Đã đăng xuất tài khoản.");
                      await refresh();
                    })
                  }
                >
                  Đăng xuất
                </button>
              </>
            ) : (
              <button
                className="text-button"
                disabled={!ready || busy}
                onClick={() => setAccountOpen(true)}
              >
                Đăng nhập / Đăng ký
              </button>
            )}
            <Link href="/admin" className="text-button">
              Trang quản trị ↗
            </Link>
          </div>
        </div>
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow light">
              GIÒN TỪ MIẾNG ĐẦU · NGON ĐẾN MIẾNG CUỐI
            </span>
            <h1>
              Bụng đói?
              <br />
              <em>Có KFC đây.</em>
            </h1>
            <p>
              Chọn món bạn mê, thêm chút giòn vui.
              <br />
              Bữa ngon chỉ cách vài lần chạm.
            </p>
            <a
              className="button cream"
              href="#menu-title"
              onClick={() => setTab("menu")}
            >
              Chọn món ngay <span aria-hidden="true">↗</span>
            </a>
          </div>
          <div className="hero-art" aria-hidden="true">
            <span className="hero-stamp">
              GIÒN
              <br />
              <b>HẾT Ý!</b>
            </span>
            <Image
              src="/images/feast.svg"
              alt=""
              width={560}
              height={380}
              priority
            />
            <span className="hero-caption">GOOD FOOD. GOOD MOOD.</span>
          </div>
        </section>
        <section className="shop-public panel" aria-label="Thông tin cửa hàng">
          {!shop ? <p role="status">Chưa kiểm tra được điều kiện nhận đơn. Hãy làm mới trước khi đặt món.</p> : <>
            <div className="section-heading"><strong>{shop.settings.name}</strong><span className="status-badge">{shop.availability.canPickup || shop.availability.canDelivery ? "Đang nhận đơn" : "Tạm ngừng"}</span></div>
            <p role="status">{shop.availability.message}</p>
            {shop.settings.announcement && <p className="notice-box">{shop.settings.announcement}</p>}
            <details><summary>Địa chỉ, liên hệ và giờ nhận món</summary>
              <p>{shop.settings.address}{shop.settings.phone ? " · " + shop.settings.phone : ""}</p>
              <p>Giao hàng: {money(shop.settings.deliveryFee)} · Tiền món tối thiểu: {money(shop.settings.minimumSubtotal)}</p>
              <p>{shop.settings.scheduleEnabled ? "Giờ Việt Nam (UTC+7), đóng đúng giờ kết thúc:" : "Bản demo chưa bật giới hạn theo lịch giờ."}</p>
              {shop.settings.scheduleEnabled && <ul>{shop.settings.hours.map(day => <li key={day.day}>{shopDayLabels[day.day]}: {day.closed ? "Nghỉ" : day.opensAt + "–" + day.closesAt}</li>)}</ul>}
            </details>
          </>}
        </section>
        <div className="service-strip">
          <span>
            <i className="green-dot" /> Bản demo đặt món
          </span>
          <span>Nhận tại cửa hàng hoặc giao tận nơi</span>
          <span>Chưa gửi nhà hàng · Chưa thu tiền</span>
        </div>
        {error && (
          <div role="alert" className="error-box page-alert">
            <span>{error}</span>
            {!ready ? (
              <button
                className="text-button"
                onClick={() => window.location.reload()}
              >
                Tải lại
              </button>
            ) : (
              <div className="error-actions">
                <button
                  disabled={busy}
                  className="text-button"
                  onClick={() => run(refresh)}
                >
                  Làm mới dữ liệu
                </button>
                <button className="text-button" onClick={() => setError("")}>
                  Đóng
                </button>
              </div>
            )}
          </div>
        )}
        {notice && (
          <div role="status" className="notice-box">
            {notice}
          </div>
        )}
        <div className="content-grid">
          <div className="catalog-column">
            {tab === "menu" ? (
              <section aria-labelledby="menu-title">
                <div className="section-heading catalog-heading">
                  <div>
                    <span className="eyebrow">HÔM NAY BẠN THÈM GÌ?</span>
                    <h2 id="menu-title" className="icon-heading">
                      <span className="section-title-icon" aria-hidden="true">🍗</span>
                      Chọn món. Chọn vui.
                    </h2>
                  </div>
                  <span className="muted small">
                    {ready ? `${items.length} món để yêu` : "Đang lên món…"}
                  </span>
                </div>
                <label className="search-box">
                  <span aria-hidden="true">⌕</span>
                  <span className="sr-only">Tìm món ăn</span>
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Tìm gà rán, burger, Pepsi…"
                  />
                </label>
                <div
                  className="category-list"
                  role="group"
                  aria-label="Danh mục món"
                >
                  <button
                    aria-pressed={category === "all"}
                    onClick={() => setCategory("all")}
                  >
                    Tất cả món
                  </button>
                  {categories.map((entry) => (
                    <button
                      key={entry.id}
                      aria-pressed={category === entry.id}
                      onClick={() => setCategory(entry.id)}
                    >
                      {entry.name}
                    </button>
                  ))}
                </div>
                {!ready && (
                  <div
                    className="menu-grid"
                    aria-label="Đang tải thực đơn"
                    aria-busy="true"
                  >
                    {[1, 2, 3, 4].map((index) => (
                      <div key={index} className="menu-skeleton" />
                    ))}
                  </div>
                )}
                {ready && !filtered.length && (
                  <div className="panel empty-state">
                    <h3>Chưa tìm thấy món phù hợp.</h3>
                    <p className="muted">
                      Thử tên món khác hoặc xem lại tất cả món nhé.
                    </p>
                    <button
                      className="button secondary"
                      onClick={() => {
                        setQuery("");
                        setCategory("all");
                      }}
                    >
                      Xem tất cả món
                    </button>
                  </div>
                )}
                <div className="menu-grid">
                  {filtered.map((item, index) => (
                    <article
                      className="menu-card"
                      key={item.id}
                      style={{ animationDelay: `${index * 40}ms` }}
                    >
                      <div className={`food-art food-${index % 3}`}>
                        <Image
                          src={
                            item.imageUrl?.replace(/\.png$/, ".svg") ??
                            "/images/fried-chicken.svg"
                          }
                          alt={item.name}
                          width={300}
                          height={210}
                        />
                        {item.name.includes("Combo") && (
                          <span className="food-tag">MỘT MÌNH VẪN VUI</span>
                        )}
                      </div>
                      <div className="menu-card-body">
                        <h3>{item.name}</h3>
                        <p>
                          {item.description ??
                            "Một phần ngon, trọn vị yêu thích."}
                        </p>
                        <div className="menu-card-footer">
                          <strong>{money(item.price)}</strong>
                          <button
                            disabled={disabled}
                            className="add-button"
                            aria-label={`Thêm ${item.name}`}
                            onClick={() =>
                              mutateCart(
                                "/api/cart",
                                "POST",
                                { menuItemId: item.id, quantity: 1 },
                                `Đã thêm ${item.name} vào giỏ.`,
                              )
                            }
                          >
                            +<span> Thêm món</span>
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : (
              <OrderPanel
                onReorder={prepareReorder}
                onFeedback={(order) => setFeedbackDraft({ orderId: order.id, feedback: order.feedback ?? null })}
                orders={orders}
                selected={selected}
                busy={disabled}
                onMenu={() => setTab("menu")}
                onSelect={(id) =>
                  run(async () => {
                    const order = await customerRequest<OrderDetail>(
                      `/api/orders?orderId=${encodeURIComponent(id)}`,
                    );
                    selectedId.current = order.id;
                    setSelected(order);
                  })
                }
                onCancel={setCancelId}
              />
            )}
          </div>
          <aside className="sidebar">
            <section
              className="panel assistant-panel"
              aria-labelledby="assistant-title"
            >
              <div className="assistant-heading">
                <span className="assistant-avatar" aria-hidden="true">
                  ✦
                </span>
                <div>
                  <h2 id="assistant-title">Ăn gì? Để mình lo.</h2>
                  <p>Trợ lý chọn món của bạn</p>
                </div>
                <span className="green-dot" />
              </div>
              <ChatWindow
                messages={messages}
                onSendMessage={sendMessage}
                isLoading={chatBusy}
                disabled={disabled}
              />
              {pending && (
                <div className="pending-action">
                  <p>Kiểm tra thay đổi trước khi xác nhận:</p>
                  <ul>
                    {pending.summary.map((line, index) => (
                      <li key={index}>{line}</li>
                    ))}
                  </ul>
                  <p className="small muted">
                    Có hiệu lực đến{" "}
                    {new Date(pending.expiresAt).toLocaleTimeString("vi-VN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    .
                  </p>
                  <div>
                    <button
                      disabled={disabled}
                      className="button primary"
                      onClick={() => sendMessage("Xác nhận", pending)}
                    >
                      Xác nhận thao tác
                    </button>
                    <button
                      disabled={disabled}
                      className="text-button"
                      onClick={() =>
                        run(async () => {
                          await customerRequest(
                            `/api/chat?confirmationId=${encodeURIComponent(pending.id)}`,
                            { method: "DELETE" },
                          );
                          setPending(null);
                        })
                      }
                    >
                      Bỏ qua
                    </button>
                  </div>
                </div>
              )}
              <div className="quick-prompts">
                <button
                  disabled={disabled}
                  onClick={() => sendMessage("Cho mình xem thực đơn")}
                >
                  Xem thực đơn ↗
                </button>
                <button
                  disabled={disabled}
                  onClick={() => sendMessage("Xem giỏ hàng")}
                >
                  Kiểm tra giỏ ↗
                </button>
              </div>
            </section>
          </aside>
        </div>
        <footer className="site-footer">
          <strong>IT’S FINGER LICKIN’ GOOD.</strong>
          <p>Project học tập KFC Force Agent · Giá và thực đơn minh hoạ</p>
          <span className="brand-stripes" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </footer>
      </main>
      {addressesOpen && profile && addressBook && (
        <AddressBookDialog
          initial={addressBook}
          profile={profile}
          onClose={() => setAddressesOpen(false)}
          onChanged={(book) => {
            setAddressBook(book);
            changes.current?.postMessage("changed");
          }}
          onExpired={() => {
            clearIdentityView();
            setNotice("Phiên tài khoản đã thay đổi. Vui lòng đăng nhập lại.");
            void refresh().catch(() => {});
          }}
        />
      )}
      {settingsOpen && profile && (
        <AccountSettingsDialog
          profile={profile}
          onClose={() => setSettingsOpen(false)}
          onSaved={(updated) => {
            setProfile(updated);
            changes.current?.postMessage("changed");
          }}
          onSessionEnded={(message) => {
            setSettingsOpen(false);
            clearIdentityView();
            setNotice(message);
            changes.current?.postMessage("changed");
            void refresh().catch(() =>
              setError("Chưa tải được phiên khách. Vui lòng tải lại trang."),
            );
          }}
        />
      )}
      {accountOpen && (
        <AccountDialog
          onClose={() => setAccountOpen(false)}
          onSuccess={async () => {
            clearIdentityView();
            setAccountOpen(false);
            changes.current?.postMessage("changed");
            setNotice(
              "Đã đăng nhập. Giỏ và lịch sử hiện tại thuộc tài khoản của bạn.",
            );
            await refresh().catch(() =>
              setError(
                "Đã đăng nhập nhưng chưa tải được dữ liệu tài khoản. Vui lòng tải lại trang.",
              ),
            );
          }}
        />
      )}
      {reorder && (
        <ReorderDialog
          preview={reorder}
          busy={busy}
          error={reorderError}
          onClose={() => {
            setReorder(null);
            setReorderError("");
          }}
          onConfirm={() => void confirmReorder()}
        />
      )}
      {feedbackDraft && <FeedbackDialog key={feedbackDraft.orderId} orderId={feedbackDraft.orderId} initial={feedbackDraft.feedback}
        onClose={() => { setFeedbackDraft(null); void refresh().catch(() => setError("Chưa tải được đánh giá mới. Hãy làm mới khi có kết nối.")); }}
        onLoad={() => customerRequest<FeedbackView>("/api/orders/feedback?orderId=" + encodeURIComponent(feedbackDraft.orderId))}
        onSave={(fields) => customerRequest<OrderFeedback>("/api/orders/feedback", { method: "POST", body: JSON.stringify({ orderId: feedbackDraft.orderId, ...fields }) })}
        onExpired={() => { clearIdentityView(); setError("Phiên đánh giá đã thay đổi. Hãy đăng nhập hoặc tải lại lịch sử đơn."); void refresh().catch(() => {}); }}
        onSaved={(feedback) => {
          const id = feedbackDraft.orderId;
          setSelected(previous => previous?.id === id ? { ...previous, feedback } : previous);
          setOrders(previous => previous.map(order => order.id === id ? { ...order, feedback } : order));
          setFeedbackDraft(null); setNotice("Đã lưu đánh giá riêng cho cửa hàng."); changes.current?.postMessage("changed");
          void refresh().catch(() => setError("Đánh giá đã lưu. Chưa tải được dữ liệu mới; hãy làm mới khi có kết nối."));
        }} />}
      {checkoutOpen && (
        <CheckoutDialog
          basket={basket}
          profile={profile}
          savedAddresses={addressBook?.addresses ?? []}
          shop={shop}
          onQuote={(input) => {
            setCheckoutError("");
            return customerRequest<CheckoutQuote>("/api/checkout/quote", {
              method: "POST",
              body: JSON.stringify(input),
            }).catch(async (err) => {
              if (
                err instanceof RequestError &&
                (err.status === 401 || err.code === "IDENTITY_CHANGED")
              ) {
                clearIdentityView();
                void refresh().catch(() => {});
              }
              if (err instanceof RequestError && err.code === "SHOP_CHANGED") await refresh().catch(() => {});
              throw err;
            });
          }}
          busy={busy}
          error={checkoutError}
          onClose={() => setCheckoutOpen(false)}
          onSubmit={(input) => void submitOrder(input)}
          onCheckOrder={checkoutAttempt ? () => void checkCheckout() : undefined}
        />
      )}
      <dialog
        ref={cancelDialog}
        className="confirm-dialog"
        aria-labelledby="cancel-title"
        onClose={() => {
          setCancelId(null);
          document.getElementById("orders-title")?.focus();
        }}
      >
        <h2 id="cancel-title">Bạn muốn huỷ đơn này?</h2>
        <p className="muted">
          Đơn sẽ được giữ trong lịch sử với trạng thái đã huỷ.
        </p>
        <div className="dialog-actions">
          <button
            disabled={busy}
            className="button secondary"
            onClick={() => cancelDialog.current?.close()}
          >
            Giữ đơn
          </button>
          <button
            disabled={busy}
            className="button primary"
            onClick={() =>
              run(async () => {
                if (!cancelId) return;
                setSelected(
                  await customerRequest<OrderDetail>("/api/orders", {
                    method: "PATCH",
                    body: JSON.stringify({ orderId: cancelId, confirm: true }),
                  }),
                );
                await refresh();
                cancelDialog.current?.close();
                setNotice("Đã huỷ đơn demo.");
              })
            }
          >
            Xác nhận huỷ
          </button>
        </div>
      </dialog>
    </div>
  );
}
