"use client";
import { useEffect, useRef, useState } from "react";
import type { ShopView } from "@/lib/types/shop";
import type { Basket } from "@/lib/storefront-types";
import { money } from "@/lib/storefront-types";
import type { Address } from "@/lib/types/user";
import type { CustomerProfile } from "@/lib/types/account";
import { formatSavedAddress } from "@/lib/address-format";
import type { AppliedPromotion, CheckoutQuote } from "@/lib/types/promotion";

export interface CheckoutInput {
  cartId: string;
  cartSignature: string;
  customerName: string;
  phone: string;
  fulfillment: "pickup" | "delivery";
  address: string;
  note: string;
  expectedTotal: number;
  confirm: true;
  shopRevision?: string;
  promotionCode?: string;
  promotionRevision?: string;
}
export function CheckoutDialog({
  basket,
  profile,
  savedAddresses,
  shop,
  busy,
  error,
  onClose,
  onSubmit,
  onQuote,
  onCheckOrder,
}: {
  basket: Basket;
  profile: CustomerProfile | null;
  savedAddresses: Address[];
  shop: ShopView | null;
  busy: boolean;
  error: string;
  onCheckOrder?: () => void;
  onClose: () => void;
  onSubmit: (input: CheckoutInput) => void;
  onQuote: (input: {
    cartId: string;
    cartSignature: string;
    fulfillment: "pickup" | "delivery";
    promotionCode: string;
    shopRevision?: string;
  }) => Promise<CheckoutQuote>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const initialAddress = savedAddresses.find((entry) => entry.isDefault);
  const startsWithDelivery = !!shop && !shop.availability.canPickup && shop.availability.canDelivery;
  const [selectedAddress, setSelectedAddress] = useState(
    initialAddress?.id ?? "",
  );
  const [customerName, setCustomerName] = useState(startsWithDelivery && initialAddress ? initialAddress.recipientName : profile?.fullName ?? "");
  const [phone, setPhone] = useState(startsWithDelivery && initialAddress ? initialAddress.phone : "");
  const [address, setAddress] = useState(
    initialAddress ? formatSavedAddress(initialAddress) : "",
  );
  const appliedDelivery = useRef(startsWithDelivery);
  const [code, setCode] = useState("");
  const quoteContext = `${basket.cart?.id ?? ""}:${basket.signature ?? ""}:${shop?.settings.revision ?? ""}:${shop?.availability.canPickup}:${shop?.availability.canDelivery}`;
  const [appliedQuote, setAppliedQuote] = useState<{ promotion: AppliedPromotion; context: string } | null>(null);
  const applied = appliedQuote?.context === quoteContext ? appliedQuote.promotion : null;
  const setApplied = (promotion: AppliedPromotion | null) =>
    setAppliedQuote(promotion ? { promotion, context: quoteContext } : null);
  const [applying, setApplying] = useState(false);
  const applyingRef = useRef(false);
  const [promotionError, setPromotionError] = useState("");
  const applyAddress = (id: string) => {
    setSelectedAddress(id);
    const selected = savedAddresses.find((entry) => entry.id === id);
    if (selected) {
      setCustomerName(selected.recipientName);
      setPhone(selected.phone);
      setAddress(formatSavedAddress(selected));
    } else setAddress("");
  };
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">(
    startsWithDelivery ? "delivery" : "pickup",
  );
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const deliveryFee = shop?.settings.deliveryFee ?? 15000;
  const allowed = !!shop && (fulfillment === "pickup" ? shop.availability.canPickup : shop.availability.canDelivery) && (basket.cart?.subtotal ?? 0) >= shop.settings.minimumSubtotal;
  const total =
    (basket.cart?.subtotal ?? 0) -
    (applied?.discount ?? 0) +
    (fulfillment === "delivery" ? deliveryFee : 0);
  const applyPromotion = async () => {
    if (applyingRef.current || busy) return;
    applyingRef.current = true;
    setApplying(true);
    setPromotionError("");
    setApplied(null);
    try {
      const quote = await onQuote({
        cartId: basket.cart?.id ?? "",
        cartSignature: basket.signature ?? "",
        fulfillment,
        promotionCode: code.trim().toUpperCase(),
        shopRevision: shop?.settings.revision,
      });
      setApplied(quote.promotion);
      setCode(quote.promotion?.code ?? "");
    } catch (e) {
      setPromotionError(
        e instanceof Error ? e.message : "Chưa áp dụng được mã.",
      );
    } finally {
      applyingRef.current = false;
      setApplying(false);
    }
  };
  return (
    <dialog
      ref={dialog}
      className="checkout-dialog"
      aria-labelledby="checkout-title"
      onCancel={(event) => {
        if (busy || applying) event.preventDefault();
      }}
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (busy || !allowed || applyingRef.current || (code.trim() && !applied)) return;
          const form = new FormData(event.currentTarget);
          onSubmit({
            cartId: basket.cart?.id ?? "",
            cartSignature: basket.signature ?? "",
            customerName: String(form.get("customerName")),
            phone: String(form.get("phone")),
            fulfillment,
            address: String(form.get("address") ?? ""),
            note: String(form.get("note") ?? ""),
            expectedTotal: total,
            confirm: true,
            shopRevision: shop?.settings.revision,
            ...(applied
              ? {
                  promotionCode: applied.code,
                  promotionRevision: applied.revision,
                }
              : {}),
          });
        }}
      >
        <div className="section-heading">
          <div>
            <span className="eyebrow">BƯỚC CUỐI CÙNG</span>
            <h2 id="checkout-title">Chốt đơn, lên món!</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Đóng thanh toán"
            disabled={busy || applying}
            onClick={() => dialog.current?.close()}
          >
            ×
          </button>
        </div>
        <p className="muted small">
          Đơn demo được lưu trong ứng dụng. Chưa gửi đến nhà hàng, chưa thu
          tiền.
        </p>
        <fieldset disabled={busy || applying || !basket.items.length} className="checkout-fields">
          <legend className="sr-only">Thông tin nhận món</legend>
          <label>
            Họ và tên
            <input
              name="customerName"
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              autoComplete="name"
              required
              minLength={2}
              maxLength={100}
              placeholder="Nguyễn Minh Anh"
            />
          </label>
          <label>
            Số điện thoại
            <input
              name="phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              type="tel"
              autoComplete="tel"
              required
              pattern="(0|\+84)[0-9]{9}"
              placeholder="0901234567"
            />
          </label>
          <div
            className="fulfillment-toggle"
            role="group"
            aria-label="Cách nhận món"
          >
            <button
              type="button"
              disabled={!shop?.availability.canPickup}
              aria-pressed={fulfillment === "pickup"}
              onClick={() => setFulfillment("pickup")}
            >
              Tự đến lấy · miễn phí
            </button>
            <button
              type="button"
              disabled={!shop?.availability.canDelivery}
              aria-pressed={fulfillment === "delivery"}
              onClick={() => {
                setFulfillment("delivery");
                if (!appliedDelivery.current) {
                  appliedDelivery.current = true;
                  if (selectedAddress) applyAddress(selectedAddress);
                }
              }}
            >
              Giao tận nơi · {money(deliveryFee)}
            </button>
          </div>
          {fulfillment === "delivery" && (
            <>
              {!!savedAddresses.length && (
                <label>
                  Địa chỉ đã lưu
                  <select
                    value={selectedAddress}
                    onChange={(event) => applyAddress(event.target.value)}
                  >
                    <option value="">Nhập địa chỉ khác</option>
                    {savedAddresses.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.label}
                        {entry.isDefault ? " · Mặc định" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                Địa chỉ giao hàng
                <textarea
                  name="address"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  autoComplete="street-address"
                  required
                  minLength={10}
                  maxLength={300}
                  placeholder="Số nhà, đường, phường/xã, tỉnh/thành phố"
                />
              </label>
            </>
          )}
          {fulfillment === "pickup" && shop && <p className="notice-box">Nhận món tại: {shop.settings.address}{shop.settings.phone ? " · " + shop.settings.phone : ""}</p>}
          <label>
            Ghi chú <span className="muted">(không bắt buộc)</span>
            <textarea
              name="note"
              maxLength={300}
              placeholder="Bạn muốn dặn thêm điều gì?"
            />
          </label>
          <div className="promotion-checkout">
            <label>
              Mã giảm giá
              <input
                value={code}
                maxLength={24}
                autoCapitalize="characters"
                placeholder="Nhập mã được cung cấp"
                onChange={(e) => {
                  setCode(e.target.value);
                  setApplied(null);
                  setPromotionError("");
                }}
              />
            </label>
            <div className="address-book-actions">
              <button
                type="button"
                className="text-button"
                disabled={!code.trim() || !allowed}
                onClick={() => void applyPromotion()}
              >
                Áp dụng mã
              </button>
              {!!code && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setCode("");
                    setApplied(null);
                    setPromotionError("");
                  }}
                >
                  Bỏ mã giảm giá
                </button>
              )}
            </div>
            {promotionError && (
              <p className="error-box" role="alert">
                {promotionError}
              </p>
            )}
            {applied && (
              <p role="status" className="notice-box">
                {applied.code} · {applied.title}: giảm {money(applied.discount)}{" "}
                tiền món.
              </p>
            )}
            {code.trim() && !applied && !promotionError && (
              <p className="small muted">
                {appliedQuote && appliedQuote.context !== quoteContext
                  ? "Giỏ đã thay đổi. Hãy áp dụng lại hoặc bỏ mã trước khi xác nhận đơn."
                  : "Áp dụng hoặc bỏ mã trước khi xác nhận đơn."}
              </p>
            )}
          </div>
          {basket.items.length ? <div className="checkout-summary">
            {basket.items.map((item) => (
              <div key={item.id}>
                <span>
                  {item.quantity} × {item.nameSnapshot}
                </span>
                <strong>{money(item.subtotal)}</strong>
              </div>
            ))}
            {applied && (
              <div>
                <span>Giảm giá · {applied.code}</span>
                <strong>−{money(applied.discount)}</strong>
              </div>
            )}
            <div>
              <span>Phí giao hàng</span>
              <strong>{money(fulfillment === "delivery" ? deliveryFee : 0)}</strong>
            </div>
            <div className="total-row">
              <strong>Tổng thanh toán</strong>
              <strong>{money(total)}</strong>
            </div>
          </div> : <p role="status" className="notice-box">
            {onCheckOrder
              ? "Giỏ hiện tại đang trống. Hãy kiểm tra đơn vừa gửi để xem kết quả đã lưu."
              : "Giỏ hiện tại đang trống. Hãy đóng cửa sổ và chọn món trước khi đặt đơn."}
          </p>}
          <p className="small muted">
            Thanh toán khi nhận món. Đơn demo không phát sinh giao dịch.
          </p>
          <label className="checkbox-label">
            <input
              key={quoteContext + total + fulfillment + (applied?.revision ?? "")}
              type="checkbox"
              required
            />{" "}
            Tôi đã kiểm tra món và thông tin nhận hàng.
          </label>
        </fieldset>
        {!allowed && <p role="status" className="notice-box">{!shop ? "Chưa kiểm tra được cửa hàng. Hãy làm mới dữ liệu." :
          !shop.availability.open ? shop.availability.message : !(fulfillment === "pickup" ? shop.availability.canPickup : shop.availability.canDelivery) ? "Hình thức nhận món này đang tạm tắt. Hãy chọn hình thức khác nếu có." :
          "Tiền món tối thiểu: " + money(shop.settings.minimumSubtotal)}</p>}
        {error && (
          <p role="alert" className="error-box">
            {error}
          </p>
        )}
        {onCheckOrder && error && (
          <button type="button" className="text-button" disabled={busy || applying} onClick={onCheckOrder}>
            Kiểm tra đơn vừa gửi
          </button>
        )}
        <button
          type="submit"
          disabled={
            busy ||
            applying ||
            !allowed ||
            !basket.items.length ||
            (!!code.trim() && !applied)
          }
          className="button primary full-width"
        >
          {busy ? "Đang xử lý…" : !basket.items.length ? "Giỏ hiện tại đang trống" : `Xác nhận đặt đơn · ${money(total)}`}
        </button>
      </form>
    </dialog>
  );
}
