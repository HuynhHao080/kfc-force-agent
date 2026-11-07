"use client";
import { useEffect, useRef } from "react";
import type { MenuCategory, MenuItem } from "@/lib/types/menu";
export function MenuEditor({
  item,
  categories,
  busy,
  error,
  onClose,
  onSave,
}: {
  item: MenuItem | null;
  categories: MenuCategory[];
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (data: object) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="checkout-dialog"
      aria-labelledby="menu-editor-title"
      onClose={onClose}
      onCancel={(event) => {
        if (busy) event.preventDefault();
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          onSave({
            ...(item ? { itemId: item.id } : {}),
            name: data.get("name"),
            description: data.get("description"),
            price: Number(data.get("price")),
            categoryId: data.get("categoryId"),
            imageUrl: data.get("imageUrl"),
            isActive: data.has("isActive"),
            isAvailable: data.has("isAvailable"),
          });
        }}
      >
        <div className="section-heading">
          <div>
            <span className="eyebrow">THỰC ĐƠN CỦA BẠN</span>
            <h2 id="menu-editor-title">
              {item ? "Chỉnh sửa món" : "Thêm món mới"}
            </h2>
          </div>
          <button
            type="button"
            disabled={busy}
            className="icon-button"
            aria-label="Đóng sửa món"
            onClick={() => dialog.current?.close()}
          >
            ×
          </button>
        </div>
        <fieldset className="checkout-fields" disabled={busy}>
          <legend className="sr-only">Thông tin món ăn</legend>
          <label>
            Tên món
            <input
              name="name"
              defaultValue={item?.name}
              required
              minLength={2}
              maxLength={100}
            />
          </label>
          <label>
            Mô tả
            <textarea
              name="description"
              defaultValue={item?.description}
              maxLength={400}
            />
          </label>
          <label>
            Giá bán (VND)
            <input
              name="price"
              type="number"
              min={1000}
              max={5000000}
              step={1}
              required
              defaultValue={item?.price ?? 49000}
            />
          </label>
          <label>
            Danh mục
            <select
              name="categoryId"
              defaultValue={
                item?.categoryId ??
                categories.find((category) => category.isActive)?.id
              }
              required
            >
              {categories
                .filter((category) => category.isActive)
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Minh hoạ
            <select
              name="imageUrl"
              defaultValue={
                item?.imageUrl?.replace(/\.png$/, ".svg") ??
                "/images/fried-chicken.svg"
              }
            >
              {[
                ["burger", "Burger"],
                ["combo", "Combo"],
                ["fried-chicken", "Gà rán"],
                ["fries", "Khoai tây"],
                ["pepsi", "Nước uống"],
                ["wings", "Gà miếng"],
              ].map(([file, label]) => (
                <option key={file} value={`/images/${file}.svg`}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="checkbox-label">
            <input
              name="isActive"
              type="checkbox"
              defaultChecked={item?.isActive ?? true}
            />{" "}
            Hiển thị trong thực đơn
          </label>
          <label className="checkbox-label">
            <input
              name="isAvailable"
              type="checkbox"
              defaultChecked={item?.isAvailable ?? true}
            />{" "}
            Còn món, có thể đặt
          </label>
          <p className="small muted">
            Đơn đã đặt giữ nguyên giá chụp tại thời điểm checkout. Giỏ và đề
            xuất chưa xác nhận sẽ kiểm tra lại giá mới.
          </p>
        </fieldset>
        {error && (
          <p className="error-box" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          className="button primary full-width"
          disabled={busy}
        >
          {busy ? "Đang lưu…" : "Lưu món ăn"}
        </button>
      </form>
    </dialog>
  );
}
