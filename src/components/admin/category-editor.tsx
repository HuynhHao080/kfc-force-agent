"use client";
import { useEffect, useRef } from "react";
import type { MenuCategory } from "@/lib/types/menu";
export function CategoryEditor({
  category,
  itemCount,
  busy,
  error,
  onClose,
  onSave,
}: {
  category: MenuCategory | null;
  itemCount: number;
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
      aria-labelledby="category-editor-title"
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
            ...(category ? { categoryId: category.id } : {}),
            name: data.get("name"),
            description: data.get("description"),
            displayOrder: Number(data.get("displayOrder")),
            isActive: data.has("isActive"),
          });
        }}
      >
        <div className="section-heading">
          <div>
            <span className="eyebrow">PHÂN LOẠI THỰC ĐƠN</span>
            <h2 id="category-editor-title">
              {category ? "Sửa danh mục" : "Thêm danh mục"}
            </h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Đóng sửa danh mục"
            disabled={busy}
            onClick={() => dialog.current?.close()}
          >
            ×
          </button>
        </div>
        <fieldset className="checkout-fields" disabled={busy}>
          <legend className="sr-only">Thông tin danh mục</legend>
          <label>
            Tên danh mục
            <input
              name="name"
              defaultValue={category?.name}
              minLength={2}
              maxLength={80}
              required
            />
          </label>
          <label>
            Mô tả danh mục
            <textarea
              name="description"
              defaultValue={category?.description}
              maxLength={240}
            />
          </label>
          <label>
            Thứ tự hiển thị
            <input
              name="displayOrder"
              type="number"
              min={0}
              max={999}
              step={1}
              defaultValue={category?.displayOrder ?? 10}
              required
            />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={category?.isActive ?? true}
            />
            Đang sử dụng
          </label>
          <p className="small muted">
            Số nhỏ hiển thị trước. Chỉ tắt khi danh mục không còn món nào, kể cả
            món đã ẩn hoặc hết món.
          </p>
          {!!itemCount && (
            <p className="notice-box">
              Có {itemCount} món thuộc danh mục này. Muốn tắt, hãy sửa từng món
              để chuyển sang danh mục khác trước.
            </p>
          )}
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
          {busy ? "Đang lưu…" : "Lưu danh mục"}
        </button>
      </form>
    </dialog>
  );
}
