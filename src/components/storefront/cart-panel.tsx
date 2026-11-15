"use client";
import type { Basket } from "@/lib/storefront-types";
import { money } from "@/lib/storefront-types";
import type { MenuItem } from "@/lib/types/menu";
import { MenuImage } from "./menu-image";
export function CartPanel({
  basket,
  busy,
  onQuantity,
  onRemove,
  onCheckout,
  onClose,
  checkoutDisabled = false,
  purchaseAssistant = false,
  menu = [],
  onClear,
}: {
  basket: Basket;
  busy: boolean;
  checkoutDisabled?: boolean;
  purchaseAssistant?: boolean;
  menu?: MenuItem[];
  onClear?: () => void;
  onClose?: () => void;
  onQuantity: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
  onCheckout: () => void;
}) {
  const count = basket.items.reduce((sum, item) => sum + item.quantity, 0);
  return (
    <section
      className="panel cart-panel"
      id="gio-hang"
      aria-labelledby="cart-title"
    >
      <div className="section-heading cart-panel-heading">
        <h2 id="cart-title">
          <svg
            className="cart-heading-icon"
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
          Giỏ hàng
          <span
            className="count-badge"
            aria-live="polite"
            aria-label={`${count} món trong giỏ`}
          >
            {count}
          </span>
        </h2>
        <div className="cart-heading-actions">
          {onClear && basket.items.length > 0 && (
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={onClear}
              aria-label="Xóa toàn bộ giỏ"
            >
              Xóa giỏ
            </button>
          )}
          {onClose && (
            <button
              className="cart-close"
              type="button"
              aria-label="Đóng giỏ hàng"
              onClick={onClose}
            >
              ×
            </button>
          )}
        </div>
      </div>
      {!basket.items.length ? (
        <div className="empty-cart">
          <span aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
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
          </span>
          <h3>Giỏ hàng đang trống</h3>
          <p>
            Chọn món trong thực đơn hoặc nhờ trợ lý tìm giúp.
          </p>
        </div>
      ) : (
        <ul className="cart-lines">
          {basket.items.map((item) => (
            <li key={item.id}>
              <div
                className={purchaseAssistant ? "cart-product-line" : undefined}
              >
                {purchaseAssistant && (
                  <MenuImage
                    imageUrl={
                      menu.find((product) => product.id === item.menuItemId)
                        ?.imageUrl
                    }
                    alt={item.nameSnapshot}
                    width={70}
                    height={70}
                  />
                )}
                <div className="cart-product-details">
                  <div className="cart-line-heading">
                    <strong>{item.nameSnapshot}</strong>
                    <button
                      className="text-button"
                      disabled={busy}
                      aria-label={`Xoá ${item.nameSnapshot}`}
                      onClick={() => onRemove(item.id)}
                    >
                      Xoá
                    </button>
                  </div>
                  <div className="cart-line-bottom">
                    <div className="stepper">
                      <button
                        disabled={busy || item.quantity <= 1}
                        aria-label={`Giảm ${item.nameSnapshot}`}
                        onClick={() => onQuantity(item.id, item.quantity - 1)}
                      >
                        −
                      </button>
                      <span aria-label="Số lượng">{item.quantity}</span>
                      <button
                        disabled={busy || item.quantity >= 100}
                        aria-label={`Tăng ${item.nameSnapshot}`}
                        onClick={() => onQuantity(item.id, item.quantity + 1)}
                      >
                        +
                      </button>
                    </div>
                    <strong>{money(item.subtotal)}</strong>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="cart-total">
        <span>Tạm tính</span>
        <strong>{money(basket.cart?.total ?? 0)}</strong>
      </div>
      <p className="small muted">
        {purchaseAssistant
          ? "Giá tham khảo từ thực đơn KFC. Giá cuối cùng và phí giao hàng được KFC xác nhận."
          : "Phí giao hàng hiển thị tại bước xác nhận."}
      </p>
      <button
        disabled={busy || checkoutDisabled || !basket.items.length}
        className="button primary full-width"
        onClick={onCheckout}
      >
        {purchaseAssistant ? "Mua trên KFC Việt Nam" : "Tiếp tục đặt món"}{" "}
        <span aria-hidden="true">↗</span>
      </button>
    </section>
  );
}
