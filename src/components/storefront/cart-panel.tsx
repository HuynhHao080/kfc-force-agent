"use client";
import type { Basket } from "@/lib/storefront-types";
import { money } from "@/lib/storefront-types";
export function CartPanel({
  basket,
  busy,
  onQuantity,
  onRemove,
  onCheckout,
  checkoutDisabled = false,
}: {
  basket: Basket;
  busy: boolean;
  checkoutDisabled?: boolean;
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
      <div className="section-heading">
        <h2 id="cart-title">
          Giỏ của bạn<span className="count-badge">{count}</span>
        </h2>
        <span className="eyebrow">VỪA ĐỦ NGON</span>
      </div>
      {!basket.items.length ? (
        <div className="empty-cart">
          <span aria-hidden="true">⌑</span>
          <h3>Đói bụng rồi đúng không?</h3>
          <p>
            Chọn món yêu thích.
            <br />
            Bữa ngon bắt đầu từ đây.
          </p>
        </div>
      ) : (
        <ul className="cart-lines">
          {basket.items.map((item) => (
            <li key={item.id}>
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
            </li>
          ))}
        </ul>
      )}
      <div className="cart-total">
        <span>Tạm tính</span>
        <strong>{money(basket.cart?.total ?? 0)}</strong>
      </div>
      <p className="small muted">Phí giao hàng hiển thị tại bước xác nhận.</p>
      <button
        disabled={busy || checkoutDisabled || !basket.items.length}
        className="button primary full-width"
        onClick={onCheckout}
      >
        Tiếp tục đặt món <span aria-hidden="true">↗</span>
      </button>
    </section>
  );
}
