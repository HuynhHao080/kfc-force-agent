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
import { MenuImage } from "./menu-image";
import { ProductDialog } from "./product-dialog";
import { KfcHandoffDialog } from "./kfc-handoff-dialog";
import { ClearCartDialog } from "./clear-cart-dialog";
import type { CartReview } from "@/lib/types/cart-review";
import { CheckoutDialog, type CheckoutInput } from "./checkout-dialog";
import { OrderPanel } from "./order-panel";
import { FeedbackDialog } from "./feedback-dialog";
import type { FeedbackView, OrderFeedback } from "@/lib/types/feedback";
import { ReorderDialog } from "./reorder-dialog";
import type { ReorderPreview } from "@/lib/types/reorder";
import { AssistantPanel } from "./assistant-panel";
import { matchesMenuQuery } from "@/lib/menu-search";
import type { FavoritesView } from "@/lib/types/favorites";
import { CatalogFreshness } from "./catalog-freshness";

const welcome: ChatTurn = {
  role: "assistant",
  content:
    "Chào bạn! Mình giúp bạn tìm món, xem giá và chuẩn bị danh sách mua. Bạn muốn tìm món gì?",
};
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
  const [product, setProduct] = useState<MenuItem | null>(null);
  const [menuSort, setMenuSort] = useState("default");
  const [purchaseMode, setPurchaseMode] = useState<"kfc-assistant" | "internal">("internal");
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [handoffReview, setHandoffReview] = useState<CartReview | null>(null);
  const [clearCartDraft, setClearCartDraft] = useState<{ signature: string; count: number; total: number } | null>(null);
  const [maximumPrice, setMaximumPrice] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<FavoritesView | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [catalogVersion, setCatalogVersion] = useState<string>();
  const [conversationOwner, setConversationOwner] = useState<string | null>(null);
  const [basket, setBasket] = useState<Basket>({ cart: null, items: [] });
  const [orders, setOrders] = useState<Order[]>([]);
  const [selected, setSelected] = useState<OrderDetail | null>(null);
  const [messages, setMessages] = useState<ChatTurn[]>([welcome]);
  const [pending, setPending] = useState<PendingConfirmation | null>(null);
  const [readOnlyLlm, setReadOnlyLlm] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [noticeVersion, setNoticeVersion] = useState(0);
  const [noticeLeaving, setNoticeLeaving] = useState(false);
  const [noticeHovered, setNoticeHovered] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [feedbackDraft, setFeedbackDraft] = useState<{ orderId: string; feedback: OrderFeedback | null } | null>(null);
  const [reorder, setReorder] = useState<ReorderPreview | null>(null);
  const [reorderError, setReorderError] = useState("");
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"menu" | "orders">("menu");
  const [cartOpen, setCartOpen] = useState(false);
  const [mobileAssistantOpen, setMobileAssistantOpen] = useState(false);
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
  const mobileAssistantDialog = useRef<HTMLDialogElement>(null);
  const mobileAssistantTrigger = useRef<HTMLButtonElement>(null);
  const categoryList = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 800px)");
    const closeOnDesktop = () => {
      if (!mobile.matches) mobileAssistantDialog.current?.close();
    };
    mobile.addEventListener("change", closeOnDesktop);
    return () => mobile.removeEventListener("change", closeOnDesktop);
  }, []);
  useEffect(() => {
    if (mobileAssistantOpen) mobileAssistantDialog.current?.querySelector("input")?.focus();
  }, [mobileAssistantOpen]);
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
          purchaseMode: loadedPurchaseMode,
          shop: loadedShop,
          session,
          menu,
          basket: loadedBasket,
          history,
          addressBook: loadedAddresses,
          favorites: loadedFavorites,
          catalogVersion: loadedCatalogVersion,
        }) => {
          if (!active) return;
          owner.current = ownerId;
          setConversationOwner(ownerId);
          setPurchaseMode(loadedPurchaseMode ?? "internal");
          applyShop(loadedShop);
          setAddressBook(loadedAddresses);
          setFavorites(loadedFavorites ?? null);
          setCatalogVersion(loadedCatalogVersion);
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
    setConversationOwner(null);
    setCheckoutOpen(false);
    setReorder(null);
    setFeedbackDraft(null);
    setReorderError("");
    setProduct(null);
    setHandoffOpen(false);
    setHandoffReview(null);
    setClearCartDraft(null);
    mobileAssistantDialog.current?.close();
    setSettingsOpen(false);
    setAddressesOpen(false);
    setAddressBook(null);
    setFavorites(null);
    setFavoritesOnly(false);
    setCompareIds([]);
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
    setConversationOwner(snapshot.ownerId);
    setPurchaseMode(snapshot.purchaseMode ?? "internal");
    applyShop(snapshot.shop);
    setAddressBook(snapshot.addressBook);
    setFavorites(snapshot.favorites ?? null);
    setCatalogVersion(snapshot.catalogVersion);
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
    if (!notice || noticeHovered) return;
    const leaveTimer = window.setTimeout(() => setNoticeLeaving(true), 4_500);
    const removeTimer = window.setTimeout(() => setNotice(""), 5_050);
    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(removeTimer);
    };
  }, [notice, noticeHovered, noticeVersion]);
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
    if (purchaseMode === "kfc-assistant") return;
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
  }, [purchaseMode]);
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
      if (err instanceof RequestError && (err.code === "CART_CHANGED" || err.code === "FAVORITES_CHANGED")) await refresh().catch(() => {});
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
    onSaved?: () => void,
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
      if (message) {
        setNoticeLeaving(false);
        setNotice(message);
        setNoticeVersion(version => version + 1);
      }
      onSaved?.();
    });
  const prepareHandoff = () => run(async () => {
    const readReview = (signature: string) => customerRequest<CartReview>("/api/cart/review", {
      method: "POST", headers: { "X-KFC-Cart-Signature": signature },
    });
    let review: CartReview;
    try {
      review = await readReview(basket.signature ?? "empty");
    } catch (err) {
      if (!(err instanceof RequestError) || err.code !== "CART_CHANGED") throw err;
      // The review is a read. Refresh once after a concurrent edit or reprice.
      // Destructive cart operations always retain their original signature.
      const latest = await customerRequest<Basket>("/api/cart");
      setBasket(latest);
      review = await readReview(latest.signature ?? "empty");
    }
    setBasket(review.basket);
    setHandoffReview(review);
    setCartOpen(false);
    setHandoffOpen(true);
  });
  const clearBasket = () => run(async () => {
    if (!clearCartDraft) return;
    let updated: Basket;
    try {
      updated = await customerRequest<Basket>("/api/cart", {
        method: "DELETE",
        headers: { "X-KFC-Cart-Signature": clearCartDraft.signature },
      });
    } catch (err) {
      if (!(err instanceof RequestError) || err.status >= 500) {
        await refresh().catch(() => {});
        throw new Error("Chưa nhận được kết quả xóa giỏ. Hãy kiểm tra giỏ hiện tại trước khi thử lại.");
      }
      throw err;
    }
    setBasket(updated);
    setPending(null);
    checkoutKey.current = null;
    setCheckoutAttempt(null);
    setClearCartDraft(null);
    setNotice("Đã xóa toàn bộ giỏ hàng.");
    setCartOpen(true);
    requestAnimationFrame(() => cartTriggerRef.current?.focus());
  });
  const sendMessage = (message: string, confirmation?: PendingConfirmation, selectedProduct?: { itemId: string; quantity: number }) =>
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
            selectedProduct,
          }),
        });
        setMessages((previous) => [
          ...previous,
          { role: "assistant", content: response.reply, products: response.products },
        ]);
        setPending(response.pendingConfirmation ?? null);
        setReadOnlyLlm(response.ai?.mode === "read_only");
        checkoutKey.current = null;
        setCheckoutAttempt(null);
        await refresh();
      } catch (err) {
        if (!(err instanceof RequestError) || err.status >= 500) {
          setPending(null);
          await refresh().catch(() => {});
          throw new Error(
            "Phản hồi chat bị gián đoạn. Kiểm tra giỏ và đề xuất hiện tại trước khi gửi lại yêu cầu.",
          );
        }
        throw err;
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
      (!favoritesOnly || favorites?.itemIds.includes(item.id)) &&
      (category === "all" || item.categoryId === category) &&
      (!maximumPrice || item.price <= Number(maximumPrice)) &&
      matchesMenuQuery(item, query, { allowNamePrefix: true }),
  );
  if (menuSort === "price-asc") filtered.sort((a, b) => a.price - b.price || a.name.localeCompare(b.name, "vi"));
  if (menuSort === "price-desc") filtered.sort((a, b) => b.price - a.price || a.name.localeCompare(b.name, "vi"));
  if (menuSort === "name") filtered.sort((a, b) => a.name.localeCompare(b.name, "vi"));
  const revealKey = filtered.map(item => item.id).join("|");
  const count = basket.items.reduce((sum, item) => sum + item.quantity, 0);
  const disabled = busy || !ready;
  const purchaseAssistant = purchaseMode === "kfc-assistant";
  const compared = items.filter(item => compareIds.includes(item.id));
  const favoriteCount = items.filter(item => favorites?.itemIds.includes(item.id)).length;
  const heroArtwork = [
    { name: "kfc-burger", src: "/images/burger-1.svg", depth: 0.48 },
    { name: "kfc-combo", src: "/images/combo-1.svg", depth: 0.72 },
    { name: "kfc-pepsi", src: "/images/pepsi-1.svg", depth: 1 },
  ];
  const toggleFavorite = (item: MenuItem) => run(async () => {
    if (!favorites) return;
    const saved = !favorites.itemIds.includes(item.id);
    const updated = await customerRequest<FavoritesView>("/api/favorites", {
      method: "PUT",
      body: JSON.stringify({ itemId: item.id, saved, revision: favorites.revision }),
    });
    setFavorites(updated);
    setNotice(saved ? `Đã lưu ${item.name} vào món yêu thích.` : `Đã bỏ lưu ${item.name}.`);
  });
  const basketQuantities: Record<string, number> = {};
  for (const line of basket.items) {
    basketQuantities[line.menuItemId] = (basketQuantities[line.menuItemId] ?? 0) + line.quantity;
  }
  const openAssistant = () => {
    if (window.matchMedia("(max-width: 800px)").matches) {
      setCartOpen(false);
      setMobileAssistantOpen(true);
      mobileAssistantDialog.current?.showModal();
    } else {
      document.getElementById("desktop-assistant")?.scrollIntoView({ behavior: "smooth", block: "center" });
      document.getElementById("desktop-assistant-message")?.focus({ preventScroll: true });
    }
  };
  useEffect(() => {
    if (!ready || tab !== "menu") return;

    const elements = document.querySelectorAll<HTMLElement>(".storefront .scroll-reveal");
    if (!("IntersectionObserver" in window)) {
      elements.forEach(element => element.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });

    elements.forEach(element => {
      if (element.classList.contains("is-visible")) return;
      observer.observe(element);
    });

    return () => observer.disconnect();
  }, [error, filtersOpen, notice, ready, revealKey, tab]);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
        !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    const reset = (element: HTMLElement) => {
      element.style.removeProperty("--tilt-x");
      element.style.removeProperty("--tilt-y");
    };
    const cards = document.querySelectorAll<HTMLElement>(".storefront .menu-card");
    const hero = document.querySelector<HTMLElement>(".storefront .hero");
    const tracked = [...cards, ...(hero ? [hero] : [])];
    const cleanups = tracked.map(element => {
      const onMove = (event: PointerEvent) => {
        const bounds = element.getBoundingClientRect();
        const x = (event.clientX - bounds.left) / bounds.width - 0.5;
        const y = (event.clientY - bounds.top) / bounds.height - 0.5;
        element.style.setProperty("--tilt-x", `${(x * 8).toFixed(2)}deg`);
        element.style.setProperty("--tilt-y", `${(-y * 7).toFixed(2)}deg`);
      };
      const onLeave = () => reset(element);
      element.addEventListener("pointermove", onMove);
      element.addEventListener("pointerleave", onLeave);
      return () => {
        element.removeEventListener("pointermove", onMove);
        element.removeEventListener("pointerleave", onLeave);
        reset(element);
      };
    });

    return () => cleanups.forEach(cleanup => cleanup());
  }, [ready, revealKey, tab]);
  useEffect(() => {
    if (!ready || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const artwork = document.querySelector<HTMLElement>(".storefront .hero-art");
    const pieces = [...document.querySelectorAll<HTMLElement>(".storefront .hero-food-piece")];
    if (!artwork || !pieces.length) return;

    let frame = 0;
    const positions = new Map<HTMLElement, { x: number; y: number; rotateX: number; rotateY: number }>();
    const updateParallax = () => {
      frame = 0;
      const bounds = artwork.getBoundingClientRect();
      const viewport = Math.max(window.innerHeight, 1);
      const progress = Math.max(-1, Math.min(1, ((viewport * 0.58) - (bounds.top + bounds.height / 2)) / (viewport * 0.72)));
      let stillEasing = false;

      pieces.forEach(piece => {
        const depth = Number(piece.dataset.scrollDepth) || 0.5;
        const target = {
          x: progress * depth * 14,
          y: progress * depth * -34,
          rotateX: progress * depth * -9,
          rotateY: progress * depth * 14,
        };
        const current = positions.get(piece) ?? { x: 0, y: 0, rotateX: 0, rotateY: 0 };
        const next = {
          x: current.x + (target.x - current.x) * 0.16,
          y: current.y + (target.y - current.y) * 0.16,
          rotateX: current.rotateX + (target.rotateX - current.rotateX) * 0.16,
          rotateY: current.rotateY + (target.rotateY - current.rotateY) * 0.16,
        };
        const settled = Math.abs(target.y - next.y) < 0.15 && Math.abs(target.rotateY - next.rotateY) < 0.08;
        positions.set(piece, settled ? target : next);
        piece.style.setProperty("--scroll-x", `${(settled ? target.x : next.x).toFixed(2)}px`);
        piece.style.setProperty("--scroll-y", `${(settled ? target.y : next.y).toFixed(2)}px`);
        piece.style.setProperty("--scroll-rotate-x", `${(settled ? target.rotateX : next.rotateX).toFixed(2)}deg`);
        piece.style.setProperty("--scroll-rotate-y", `${(settled ? target.rotateY : next.rotateY).toFixed(2)}deg`);
        if (!settled) stillEasing = true;
      });

      if (stillEasing) frame = window.requestAnimationFrame(updateParallax);
    };
    const requestParallax = () => {
      if (!frame) frame = window.requestAnimationFrame(updateParallax);
    };

    window.addEventListener("scroll", requestParallax, { passive: true });
    window.addEventListener("resize", requestParallax);
    requestParallax();

    return () => {
      window.removeEventListener("scroll", requestParallax);
      window.removeEventListener("resize", requestParallax);
      if (frame) window.cancelAnimationFrame(frame);
      pieces.forEach(piece => {
        piece.style.removeProperty("--scroll-x");
        piece.style.removeProperty("--scroll-y");
        piece.style.removeProperty("--scroll-rotate-x");
        piece.style.removeProperty("--scroll-rotate-y");
      });
    };
  }, [ready]);
  const dismissPending = () => run(async () => {
    if (!pending) return;
    await customerRequest(`/api/chat?confirmationId=${encodeURIComponent(pending.id)}`, { method: "DELETE" });
    setPending(null);
  });
  return (
    <div className={purchaseAssistant ? "storefront purchase-storefront" : "storefront"}>
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
            {purchaseAssistant && <button type="button" onClick={openAssistant}>Trợ lý chọn món</button>}
            {!purchaseAssistant && <button
              className={tab === "orders" ? "active" : ""}
              aria-current={tab === "orders" ? "page" : undefined}
              onClick={() => setTab("orders")}
            >
              <span className="nav-icon" aria-hidden="true">▤</span> Đơn của tôi{" "}
              {orders.length > 0 && (
                <span className="nav-count">{orders.length}</span>
              )}
            </button>}
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
                  purchaseAssistant={purchaseAssistant}
                  menu={items}
                  onClear={() => { setError(""); setClearCartDraft({ signature: basket.signature ?? "empty", count, total: basket.cart?.total ?? 0 }); setCartOpen(false); }}
                  checkoutDisabled={
                    !purchaseAssistant && (!shop ||
                    (!shop.availability.canPickup &&
                      !shop.availability.canDelivery))
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
                    if (purchaseAssistant) void prepareHandoff();
                    else { setCartOpen(false); setCheckoutOpen(true); }
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
        <div className="customer-toolbar scroll-reveal">
          <span>
            {profile
              ? `Xin chào, ${profile.fullName}`
              : purchaseAssistant ? "Phiên khách" : "Bạn đang đặt món với phiên khách"}
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
                {!purchaseAssistant && <button
                  className="text-button"
                  disabled={busy || !ready || !addressBook}
                  onClick={() => setAddressesOpen(true)}
                >
                  Sổ địa chỉ
                </button>}
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
            {!purchaseAssistant && <Link href="/admin" className="text-button">
              Trang quản trị ↗
            </Link>}
          </div>
        </div>
        <section className={purchaseAssistant ? "hero hero-purchase" : "hero"}>
          <div className="hero-copy">
            <span className="eyebrow light">{purchaseAssistant ? "Thực đơn KFC Việt Nam" : "GIÒN TỪ MIẾNG ĐẦU · NGON ĐẾN MIẾNG CUỐI"}</span>
            <h1>
              {purchaseAssistant ? <>Chọn món KFC<span className="hero-title-continuation">cho bữa hôm nay.</span></> : <>Bụng đói?<br /><em>Có KFC đây.</em></>}
            </h1>
            <p>
              {purchaseAssistant ? "Tìm món bạn thích. Chuẩn bị giỏ cùng trợ lý." : <>Chọn món bạn mê, thêm chút giòn vui.<br />Bữa ngon chỉ cách vài lần chạm.</>}
            </p>
            <div className="hero-actions">
              <a
                className="button cream"
                href="#menu-title"
                onClick={() => setTab("menu")}
              >
                Chọn món ngay <span aria-hidden="true">↗</span>
              </a>
              {!purchaseAssistant && <span className="hero-stamp">GIÒN<br /><b>HẾT Ý!</b></span>}
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            {purchaseAssistant && items[0] ? <MenuImage imageUrl={items[0].imageUrl} alt={items[0].name} width={560} height={380} priority /> :
              <div className="hero-food-collage">
                {heroArtwork.map((item, index) => (
                  <div className={`hero-food-piece hero-food-piece-${index + 1}`} data-scroll-depth={item.depth} key={item.name}>
                    <Image src={item.src} alt="" width={560} height={560} priority={index === 0} />
                  </div>
                ))}
              </div>}
            {!purchaseAssistant && <span className="hero-caption">GOOD FOOD. GOOD MOOD.</span>}
          </div>
        </section>
        {!purchaseAssistant && <section className="shop-public panel scroll-reveal" aria-label="Thông tin cửa hàng">
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
        </section>}
        <div className="service-strip scroll-reveal">
          {purchaseAssistant ? <>
            <span><i className="green-dot" aria-hidden="true"/> Thực đơn từ KFC Việt Nam</span>
            <a href="https://kfcvietnam.com.vn/menu" target="_blank" rel="noopener noreferrer">Đặt món tại KFC ↗</a>
          </> : <>
          <span>
            <i className="green-dot" /> {purchaseAssistant ? "Trợ lý mua hàng KFC" : "Bản demo đặt món"}
          </span>
          <span>{purchaseAssistant ? "Thực đơn, hình ảnh và giá từ KFC Việt Nam" : "Nhận tại cửa hàng hoặc giao tận nơi"}</span>
          <span>{purchaseAssistant ? "Hoàn tất đặt hàng trên kfcvietnam.com.vn" : "Chưa gửi nhà hàng · Chưa thu tiền"}</span>
          </>}
        </div>
        {error && (
          <div role="alert" className="error-box page-alert scroll-reveal">
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
          <div
            className={`notice-box storefront-notice scroll-reveal${noticeLeaving ? " is-leaving" : ""}`}
            onMouseEnter={() => {
              setNoticeHovered(true);
              setNoticeLeaving(false);
            }}
            onMouseLeave={() => setNoticeHovered(false)}
            onFocus={() => {
              setNoticeHovered(true);
              setNoticeLeaving(false);
            }}
            onBlur={event => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setNoticeHovered(false);
              }
            }}
          >
            <span className="storefront-notice-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="m5 12.5 4.2 4.2L19 7" />
              </svg>
            </span>
            <span className="storefront-notice-message" role="status">{notice}</span>
            <button type="button" aria-label="Ẩn thông báo" onClick={() => setNotice("")}>
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="m7 7 10 10M17 7 7 17" />
              </svg>
            </button>
          </div>
        )}
        <div className="content-grid">
          <div className="catalog-column">
            {tab === "menu" ? (
              <section aria-labelledby="menu-title">
                <div className="section-heading catalog-heading scroll-reveal">
                  <div>
                    <h2 id="menu-title" className="icon-heading">
                      {category === "all" ? "Thực đơn" : categories.find(entry => entry.id === category)?.name ?? "Thực đơn"}
                    </h2>
                  </div>
                  <span className="muted small">
                    {ready ? `${filtered.length} / ${items.length} món` : "Đang lên món…"}
                  </span>
                </div>
                {purchaseAssistant && <div className="scroll-reveal"><CatalogFreshness version={catalogVersion}
                  capturedAt={(items[0]?.metadata?.source as { fetchedAt?: string } | undefined)?.fetchedAt}
                  paused={disabled || checkoutOpen || accountOpen || settingsOpen || addressesOpen || handoffOpen || !!product}
                  onUpdate={refresh} /></div>}
                <div className="menu-tools scroll-reveal">
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
                </div>
                <div className="menu-preferences scroll-reveal">
                <button type="button" className="catalog-filter-toggle" aria-label="Bộ lọc và sắp xếp"
                  aria-expanded={filtersOpen} aria-controls="catalog-filter-fields" onClick={() => setFiltersOpen(open => !open)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="white"/><circle cx="15" cy="17" r="3" fill="white"/></svg>
                  Bộ lọc <span aria-hidden="true">{filtersOpen ? "−" : "+"}</span>
                  {(maximumPrice || menuSort !== "default") && <strong aria-label="Đang áp dụng bộ lọc">{Number(!!maximumPrice) + Number(menuSort !== "default")}</strong>}
                </button>
                <button type="button" className="favorites-filter" aria-pressed={favoritesOnly}
                  disabled={!ready} onClick={() => setFavoritesOnly(value => !value)}>
                  <span aria-hidden="true">♥</span> Món yêu thích <strong>{favoriteCount}</strong>
                </button>
                </div>
                {filtersOpen && <div className="catalog-filter-fields scroll-reveal" id="catalog-filter-fields">
                <label className="menu-sort">Sắp xếp
                  <select value={menuSort} onChange={event => setMenuSort(event.target.value)}>
                    <option value="default">Theo thực đơn</option>
                    <option value="price-asc">Giá tăng dần</option>
                    <option value="price-desc">Giá giảm dần</option>
                    <option value="name">Tên món A–Z</option>
                  </select>
                </label>
                <label className="menu-budget"><span>Giá tối đa mỗi món</span>
                  <span className="catalog-price-field">
                  <input type="number" min={1000} max={5000000} step={1000} placeholder="Không giới hạn" value={maximumPrice}
                    onChange={event => setMaximumPrice(event.target.value)} />
                  <span>đ</span>
                  {maximumPrice && <button className="text-button" onClick={() => setMaximumPrice("")}>Bỏ giới hạn</button>}
                  </span>
                </label>
                </div>}
                <div className="category-navigation scroll-reveal">
                <button type="button" className="category-scroll" aria-label="Cuộn danh mục sang trái" onClick={() => categoryList.current?.scrollBy({ left: -240, behavior: "smooth" })}>‹</button>
                <div
                  ref={categoryList}
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
                <button type="button" className="category-scroll" aria-label="Cuộn danh mục sang phải" onClick={() => categoryList.current?.scrollBy({ left: 240, behavior: "smooth" })}>›</button>
                </div>
                {(query || maximumPrice || category !== "all" || favoritesOnly || menuSort !== "default") && <div className="active-filters scroll-reveal">
                  <span role="status">{filtered.length} món phù hợp{query ? ` với “${query}”` : ""}</span>
                  <button className="text-button" onClick={() => { setQuery(""); setCategory("all"); setMaximumPrice(""); setFavoritesOnly(false); setMenuSort("default"); }}>Xoá bộ lọc</button>
                </div>}
                {favoritesOnly && !profile && <p className="muted small">Món yêu thích được lưu theo phiên trình duyệt hiện tại. Đăng nhập để dùng danh sách riêng của tài khoản.</p>}
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
                    <h3>{favoritesOnly && !favoriteCount ? "Bạn chưa lưu món nào đang có trên thực đơn." : "Chưa tìm thấy món phù hợp."}</h3>
                    <p className="muted">
                      {favoritesOnly && !favoriteCount ? "Chạm biểu tượng trái tim trên món bạn thích để tìm lại nhanh ở đây." : "Thử tên món khác hoặc xem lại tất cả món nhé."}
                    </p>
                    <button
                      className="button secondary"
                      onClick={() => {
                        setQuery("");
                        setCategory("all");
                        setMaximumPrice("");
                        setFavoritesOnly(false);
                        setMenuSort("default");
                      }}
                    >
                      Xem tất cả món
                    </button>
                  </div>
                )}
                {compared.length > 0 && <section className="comparison-panel panel" aria-labelledby="comparison-title">
                  <div className="section-heading"><h3 id="comparison-title">So sánh món ({compared.length}/3)</h3>
                    <button className="text-button" onClick={() => setCompareIds([])}>Bỏ so sánh</button></div>
                  <div className="comparison-grid">
                    {compared.map(item => <article key={item.id}>
                      <h4>{item.name}</h4><strong>{money(item.price)}</strong>
                      {item.description && <p>{item.description}</p>}
                      <button className="text-button" onClick={() => { setError(""); setProduct(item); }}>Chi tiết món</button>
                      <button className="text-button" aria-label={`Bỏ so sánh ${item.name}`} onClick={() => setCompareIds(ids => ids.filter(id => id !== item.id))}>Bỏ chọn</button>
                    </article>)}
                  </div>
                </section>}
                <div className="menu-grid">
                  {filtered.map((item, index) => (
                    <article
                      className="menu-card scroll-reveal"
                      key={item.id}
                      style={{ transitionDelay: `${Math.min(index, 8) * 45}ms` }}
                    >
                      <button type="button" className="favorite-button"
                        aria-label={`${favorites?.itemIds.includes(item.id) ? "Bỏ lưu" : "Lưu yêu thích"} ${item.name}`}
                        aria-pressed={favorites?.itemIds.includes(item.id) ?? false}
                        disabled={disabled || !favorites} onClick={() => toggleFavorite(item)}>
                        <svg className="favorite-heart" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
                        </svg>
                      </button>
                      <button type="button" className={`food-art product-photo-trigger food-${index % 3}`} aria-label={`Ảnh và thông tin ${item.name}`} onClick={() => { setError(""); setProduct(item); }}>
                        <span className="food-art-label" aria-hidden="true">
                          {categories.find(entry => entry.id === item.categoryId)?.name ?? "KFC"}
                        </span>
                        <span className="food-art-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                        <MenuImage
                          imageUrl={item.imageUrl}
                          alt={item.name}
                          width={300}
                          height={210}
                        />
                        {!!basketQuantities[item.id] && <span className="item-in-basket">{basketQuantities[item.id]} trong giỏ</span>}
                      </button>
                      <div className="menu-card-body">
                        <h3><button className="product-title-button" onClick={() => { setError(""); setProduct(item); }} aria-label={`Xem chi tiết ${item.name}`}>{item.name}</button></h3>
                        <p>
                          {item.description ??
                            ""}
                        </p>
                        <label className="compare-choice">
                          <input type="checkbox" checked={compareIds.includes(item.id)}
                            disabled={!compareIds.includes(item.id) && compared.length >= 3}
                            onChange={event => setCompareIds(ids => event.target.checked ? [...ids, item.id] : ids.filter(id => id !== item.id))} />
                          So sánh món
                        </label>
                        <div className="menu-card-footer">
                          <strong>{money(item.price)}</strong>
                          <button
                            disabled={disabled}
                            className="add-button"
                            aria-label={`${(basketQuantities[item.id] ?? 0) >= 1 ? "Thêm" : "Chọn"} ${item.name}`}
                            onClick={() =>
                              mutateCart(
                                "/api/cart",
                                "POST",
                                { menuItemId: item.id, quantity: 1 },
                                `Đã thêm ${item.name} vào giỏ.`,
                              )
                            }
                          >
                            + <span>{(basketQuantities[item.id] ?? 0) >= 1 ? "Thêm món" : "Chọn món"}</span>
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
          <aside className="sidebar desktop-assistant scroll-reveal">
            <AssistantPanel key={conversationOwner ?? "loading"} id="desktop-assistant" messages={messages} pending={pending} busy={chatBusy} readOnlyLlm={readOnlyLlm}
              onChooseProduct={id => { const item = items.find(item => item.id === id); if (item) sendMessage(`Thêm 1 ${item.name}`, undefined, { itemId: id, quantity: 1 }); }}
              onViewProduct={id => { const item = items.find(item => item.id === id); if (item) setProduct(item); }}
              disabled={disabled || mobileAssistantOpen || !!clearCartDraft || handoffOpen} onSend={sendMessage} onConfirm={() => sendMessage("Xác nhận", pending ?? undefined)}
              onDismiss={dismissPending} />
          </aside>
        </div>
        <footer className="site-footer scroll-reveal">
          <strong>IT’S FINGER LICKIN’ GOOD.</strong>
          <p>{purchaseAssistant ? "KFC Force Agent · Trợ lý lựa chọn món độc lập · Đặt hàng tại KFC Việt Nam" : "Project học tập KFC Force Agent · Giá và thực đơn minh hoạ"}</p>
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
      {product && <ProductDialog key={product.id} item={items.find(item => item.id === product.id) ?? { ...product, isAvailable: false }}
        busy={busy} error={error} onClose={() => setProduct(null)}
        onAdd={quantity => void mutateCart("/api/cart", "POST", { menuItemId: product.id, quantity },
          `Đã thêm ${quantity} ${product.name} vào giỏ.`, () => setProduct(null))} />}
      {handoffOpen && handoffReview && <KfcHandoffDialog review={handoffReview} busy={busy}
        stale={handoffReview.basket.signature !== basket.signature} error={error}
        onRefresh={() => void prepareHandoff()}
        onEdit={() => { setHandoffOpen(false); setCartOpen(true); cartTriggerRef.current?.focus(); }}
        onClose={() => { setHandoffOpen(false); cartTriggerRef.current?.focus(); }} />}
      {clearCartDraft && <ClearCartDialog count={clearCartDraft.count} total={clearCartDraft.total}
        busy={busy} error={error} stale={clearCartDraft.signature !== (basket.signature ?? "empty")}
        onConfirm={() => void clearBasket()}
        onClose={() => { setClearCartDraft(null); setCartOpen(true); cartTriggerRef.current?.focus(); }} />}
      {purchaseAssistant && <>
        <nav className="mobile-shopping-nav" aria-label="Điều hướng mua hàng">
          <button type="button" onClick={() => { setTab("menu"); document.getElementById("menu-title")?.scrollIntoView({ behavior: "smooth" }); }}>
            <span aria-hidden="true">☷</span> Thực đơn
          </button>
          <button ref={mobileAssistantTrigger} type="button" aria-haspopup="dialog" aria-expanded={mobileAssistantOpen} onClick={openAssistant}>
            <span aria-hidden="true">✦</span> Trợ lý{pending && <i aria-label="Có đề xuất chờ xác nhận" />}
          </button>
          <button type="button" className="mobile-basket-button" aria-expanded={cartOpen} onClick={() => { setCartOpen(true); cartTriggerRef.current?.focus(); }}>
            <span>Giỏ hàng{count ? ` (${count})` : ""}</span>
            <strong>{money(basket.cart?.total ?? 0)}</strong>
          </button>
        </nav>
        <dialog ref={mobileAssistantDialog} className="mobile-assistant-dialog" aria-labelledby="mobile-assistant-title"
          onClose={() => {
            setMobileAssistantOpen(false);
            if (window.matchMedia("(max-width: 800px)").matches) mobileAssistantTrigger.current?.focus({ preventScroll: true });
          }}
          onKeyDown={event => {
            if (event.key !== "Tab") return;
            const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href], summary, [tabindex="0"]')]
              .filter(element => element.getClientRects().length > 0);
            const first = controls[0];
            const last = controls.at(-1);
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }}>
          {mobileAssistantOpen && <AssistantPanel key={conversationOwner ?? "loading"} id="mobile-assistant" messages={messages} pending={pending} busy={chatBusy} readOnlyLlm={readOnlyLlm}
            onChooseProduct={id => { const item = items.find(item => item.id === id); if (item) sendMessage(`Thêm 1 ${item.name}`, undefined, { itemId: id, quantity: 1 }); }}
            onViewProduct={id => { const item = items.find(item => item.id === id); if (item) setProduct(item); }}
            disabled={disabled || !!clearCartDraft || handoffOpen} onSend={sendMessage} onConfirm={() => sendMessage("Xác nhận", pending ?? undefined)}
            onDismiss={dismissPending} onClose={() => mobileAssistantDialog.current?.close()} />}
        </dialog>
      </>}
    </div>
  );
}
