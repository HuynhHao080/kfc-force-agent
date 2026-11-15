"use client";
import { useEffect, useRef, useState } from "react";
import type { MenuItem } from "@/lib/types/menu";
import { money } from "@/lib/storefront-types";
import { MenuImage } from "./menu-image";
import { officialKfcSources } from "@/lib/catalog/official-sources";

export function ProductDialog({
  item,
  busy,
  error,
  onClose,
  onAdd,
}: {
  item: MenuItem;
  busy: boolean;
  error: string;
  onClose: () => void;
  onAdd: (quantity: number) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [quantity, setQuantity] = useState(1);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const source = item.metadata?.source as
    | {
        provider?: unknown;
        url?: unknown;
        fetchedAt?: unknown;
        priceVnd?: unknown;
      }
    | undefined;
  let sourceUrl: string | undefined;
  if (source?.provider === "tinyfish" && typeof source.url === "string") {
    try {
      const url = new URL(source.url);
      if (
        url.origin === "https://kfcvietnam.com.vn" &&
        !url.username &&
        !url.password
      )
        sourceUrl = url.href;
    } catch {
      /* Only validated source URLs are linked. */
    }
  }
  const retrieved =
    typeof source?.fetchedAt === "string" ? Date.parse(source.fetchedAt) : NaN;
  return (
    <dialog
      ref={dialog}
      className="checkout-dialog product-dialog"
      aria-labelledby="product-title"
      onClose={onClose}
      onCancel={(event) => {
        if (busy) event.preventDefault();
      }}
    >
      <div className="section-heading">
        <h2 id="product-title">{item.name}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Đóng chi tiết món"
          disabled={busy}
          onClick={() => dialog.current?.close()}
        >
          ×
        </button>
      </div>
      <div className="product-photo">
        <MenuImage
          imageUrl={item.imageUrl}
          alt={item.name}
          width={600}
          height={390}
        />
      </div>
      {item.description && (
        <p className="product-description">{item.description}</p>
      )}
      {sourceUrl && (
        <p className="small muted product-source">
          Nguồn KFC Việt Nam
          {typeof source?.priceVnd === "number" && (
            <> · giá thu thập {money(source.priceVnd)}</>
          )}
          {Number.isFinite(retrieved) && (
            <>
              {" "}
              · thu thập{" "}
              {new Intl.DateTimeFormat("vi-VN", {
                dateStyle: "short",
                timeStyle: "short",
                timeZone: "Asia/Ho_Chi_Minh",
              }).format(retrieved)}
            </>
          )}
          {" · "}
          <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
            Xem nguồn ↗
          </a>
        </p>
      )}
    <p className="small muted product-source"><a href={officialKfcSources.allergens} target="_blank" rel="noopener noreferrer">Bảng thành phần dị ứng từ KFC ↗</a></p>
    <form
        onSubmit={(event) => {
          event.preventDefault();
          onAdd(quantity);
        }}
      >
        <div className="product-quantity-row">
          <label htmlFor="product-quantity">Số lượng</label>
          <div className="product-quantity-controls">
            <button
              type="button"
              aria-label="Giảm số lượng món"
              disabled={busy || !Number.isInteger(quantity) || quantity <= 1}
              onClick={() => setQuantity((value) => value - 1)}
            >
              −
            </button>
            <input
              id="product-quantity"
              type="number"
              min={1}
              max={100}
              required
              value={Number.isNaN(quantity) ? "" : quantity}
              disabled={busy}
              onChange={(event) => setQuantity(event.target.valueAsNumber)}
            />
            <button
              type="button"
              aria-label="Tăng số lượng món"
              disabled={busy || !Number.isInteger(quantity) || quantity >= 100}
              onClick={() => setQuantity((value) => value + 1)}
            >
              +
            </button>
          </div>
        </div>
        {error && (
          <p className="error-box" role="alert">
            {error}
          </p>
        )}
        <button
          className="button primary full-width"
          disabled={
            busy ||
            !item.isAvailable ||
            !item.isActive ||
            !Number.isInteger(quantity) ||
            quantity < 1 ||
            quantity > 100
          }
        >
          {busy
            ? "Đang thêm…"
            : `Thêm vào giỏ · ${money(item.price * (Number.isFinite(quantity) ? quantity : 0))}`}
        </button>
      </form>
    </dialog>
  );
}
