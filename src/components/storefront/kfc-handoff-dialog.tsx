"use client";
import { useEffect, useRef, useState } from "react";
import type { CartReview } from "@/lib/types/cart-review";
import { money } from "@/lib/storefront-types";
import { officialKfcSources } from "@/lib/catalog/official-sources";
import { shoppingListText } from "@/lib/cart-review";
import { MenuImage } from "./menu-image";

export function KfcHandoffDialog({
  review,
  busy,
  stale,
  error,
  onClose,
  onRefresh,
  onEdit,
}: {
  review: CartReview;
  busy: boolean;
  stale: boolean;
  error: string;
  onClose: () => void;
  onRefresh: () => void;
  onEdit: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const textArea = useRef<HTMLTextAreaElement>(null);
  const [clipboardStatus, setClipboardStatus] = useState<{
    text: string;
    message: string;
  } | null>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const text = shoppingListText(review);
  const message = clipboardStatus?.text === text ? clipboardStatus.message : "";
  const unavailable = review.items.filter((item) => !item.available).length;
  return (
    <dialog
      ref={dialog}
      className="checkout-dialog shopping-review-dialog"
      aria-labelledby="handoff-title"
      onClose={onClose}
      onCancel={(event) => {
        if (busy) event.preventDefault();
      }}
    >
      <div className="section-heading">
        <h2 id="handoff-title">Mua trên KFC Việt Nam</h2>
        <button
          className="icon-button"
          aria-label="Đóng danh sách mua"
          disabled={busy}
          onClick={() => dialog.current?.close()}
        >
          ×
        </button>
      </div>
      <p className="handoff-intro">
        Sao chép danh sách bên dưới, mở KFC và chọn lại các món. Chọn nhà hàng,
        địa chỉ nhận và thanh toán trên website KFC.
      </p>
      <div className="shopping-review-status">
        <span>
          {unavailable
            ? `${unavailable} loại món cần xem lại`
            : "Đã kiểm tra thực đơn hiện tại"}
        </span>
        <button
          type="button"
          className="text-button"
          disabled={busy}
          onClick={onRefresh}
        >
          {busy ? "Đang kiểm tra…" : "Kiểm tra lại"}
        </button>
      </div>
      <p className="small muted shopping-review-time">
        Kiểm tra lúc{" "}
        <time dateTime={review.checkedAt}>
          {new Date(review.checkedAt).toLocaleString("vi-VN", {
            timeZone: "Asia/Ho_Chi_Minh",
          })}
        </time>
      </p>
      {stale && (
        <p className="error-box" role="alert">
          Giỏ đã thay đổi. Hãy kiểm tra lại danh sách trước khi tiếp tục.
        </p>
      )}
      {error && (
        <p className="error-box" role="alert">
          {error}
        </p>
      )}
      <ul className="shopping-review-items">
        {review.basket.items.map((line) => {
          const product = review.items.find(
            (item) => item.cartItemId === line.id,
          );
          return (
            <li key={line.id}>
              <MenuImage
                imageUrl={product?.imageUrl}
                alt={line.nameSnapshot}
                width={72}
                height={72}
              />
              <div>
                <strong>{line.nameSnapshot}</strong>
                <span>
                  {line.quantity} × {money(line.unitPrice)}
                </span>
                {!product?.available && (
                  <span className="shopping-item-warning">
                    Hiện không được niêm yết trên nguồn đã kiểm tra
                  </span>
                )}
              </div>
              <b>{money(line.subtotal)}</b>
            </li>
          );
        })}
      </ul>
      <div className="shopping-review-total">
        <span>Tạm tính tham khảo</span>
        <strong>{money(review.basket.cart?.total ?? 0)}</strong>
      </div>
      <details className="shopping-review-text">
        <summary>Danh sách dạng văn bản</summary>
        <label className="handoff-list">
          Danh sách món đã chọn
          <textarea
            ref={textArea}
            readOnly
            value={text}
            rows={Math.min(review.basket.items.length + 4, 10)}
          />
        </label>
      </details>
      <p className="small muted handoff-intro">
        Giá, khuyến mãi và tình trạng món được xác nhận theo nhà hàng tại thời
        điểm đặt.
      </p>
      <p className="small handoff-intro">
        <a
          className="text-button"
          href={officialKfcSources.restaurants}
          target="_blank"
          rel="noopener noreferrer"
        >
          Tìm nhà hàng KFC ↗
        </a>
      </p>
      {message && (
        <p className="notice-box" role="status">
          {message}
        </p>
      )}
      <div className="dialog-actions">
        <button
          className="button secondary"
          disabled={busy || stale}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setClipboardStatus({
                text,
                message: "Đã sao chép danh sách món.",
              });
            } catch {
              const details = textArea.current?.closest("details");
              if (details) details.open = true;
              textArea.current?.focus();
              textArea.current?.select();
              setClipboardStatus({
                text,
                message:
                  "Danh sách đã được chọn. Nhấn Ctrl+C hoặc dùng lệnh Sao chép trên điện thoại.",
              });
            }
          }}
        >
          Sao chép danh sách
        </button>
        <button
          type="button"
          className="button secondary"
          disabled={busy || stale}
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob([text], { type: "text/plain;charset=utf-8" }),
            );
            const link = document.createElement("a");
            link.href = url;
            link.download = "danh-sach-kfc.txt";
            link.click();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
        >
          Tải danh sách
        </button>
        <button
          type="button"
          className="text-button"
          disabled={busy}
          onClick={() => {
            dialog.current?.close();
            onEdit();
          }}
        >
          Sửa giỏ
        </button>
        {stale || busy ? (
          <span className="button primary" aria-disabled="true">
            Mở KFC ↗
          </span>
        ) : (
          <a
            className="button primary"
            href="https://kfcvietnam.com.vn/menu"
            target="_blank"
            rel="noopener noreferrer"
          >
            Mở KFC ↗
          </a>
        )}
      </div>
    </dialog>
  );
}
