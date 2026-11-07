"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Promotion } from "@/lib/types/promotion";
import { api, money, RequestError } from "@/lib/storefront-types";
export function PromotionPanel({
  onExpired,
  onChanged,
}: {
  onExpired: () => void;
  onChanged: () => void;
}) {
  const [entries, setEntries] = useState<Promotion[]>([]);
  const [editor, setEditor] = useState<Promotion | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const working = useRef(false);
  const errorMessage = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (error) errorMessage.current?.focus();
  }, [error]);
  const reload = useCallback(async () => {
    const result = await api<{ promotions: Promotion[] }>(
      "/api/admin/promotions",
    );
    setEntries(result.promotions);
    setNow(Date.now());
  }, []);
  useEffect(() => {
    let active = true;
    api<{ promotions: Promotion[] }>("/api/admin/promotions")
      .then((r) => {
        if (active) {
          setEntries(r.promotions);
          setNow(Date.now());
        }
      })
      .catch((e) => {
        if (!active) return;
        if (e instanceof RequestError && e.status === 401) onExpired();
        else
          setError(
            e instanceof Error ? e.message : "Không tải được khuyến mãi.",
          );
      });
    return () => {
      active = false;
    };
  }, [onExpired]);
  const action = async (operation: () => Promise<void>) => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await operation();
    } catch (e) {
      if (e instanceof RequestError && e.status === 401) onExpired();
      else
        setError(e instanceof Error ? e.message : "Thao tác chưa thành công.");
    } finally {
      working.current = false;
      setBusy(false);
    }
  };
  return (
    <section className="panel promotion-panel" aria-label="Quản lý khuyến mãi">
      <div className="section-heading">
        <div>
          <span className="eyebrow">ƯU ĐÃI CHO BỮA NGON</span>
          <h2>Mã giảm giá</h2>
        </div>
        <button
          className="button primary"
          disabled={busy || entries.length >= 200}
          onClick={() => {
            setEditor(null);
            setError("");
          }}
        >
          + Tạo mã
        </button>
      </div>
      <p className="small muted">
        Một mã mỗi đơn; giảm trên tiền món, không giảm phí giao. Mã dùng lại
        được, chưa giới hạn lượt dùng. Tắt mã thay vì xoá để giữ lịch sử đơn.
      </p>
      <button
        className="text-button"
        disabled={busy}
        onClick={() =>
          void action(async () => {
            await reload();
            setEditor(undefined);
            setNotice("Đã làm mới khuyến mãi.");
          })
        }
      >
        Làm mới khuyến mãi
      </button>
      {error && (
        <p ref={errorMessage} tabIndex={-1} role="alert" className="error-box">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="notice-box">
          {notice}
        </p>
      )}
      {!entries.length && <p className="muted">Chưa có mã giảm giá.</p>}
      <div className="promotion-list">
        {entries.map((entry) => (
          <article key={entry.code}>
            <div className="section-heading">
              <h3>{entry.code}</h3>
              <span className="status-badge">
                {!entry.isActive
                  ? "Đã tắt"
                  : now < Date.parse(entry.startsAt)
                    ? "Sắp bắt đầu"
                    : now >= Date.parse(entry.endsAt)
                      ? "Hết hạn"
                      : "Đang áp dụng"}
              </span>
            </div>
            <strong>{entry.title}</strong>
            <p>
              Giảm{" "}
              {entry.discountType === "percent"
                ? entry.value + "%"
                : money(entry.value)}
              {entry.maxDiscount > 0
                ? " · tối đa " + money(entry.maxDiscount)
                : ""}
            </p>
            <p className="small muted">
              Đơn từ {money(entry.minimumSubtotal)} ·{" "}
              {new Date(entry.startsAt).toLocaleString("vi-VN")} →{" "}
              {new Date(entry.endsAt).toLocaleString("vi-VN")}
            </p>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => {
                setEditor(entry);
                setError("");
              }}
            >
              Sửa mã {entry.code}
            </button>
          </article>
        ))}
      </div>
      {editor !== undefined && (
        <PromotionEditor
          key={editor?.revision ?? "new"}
          entry={editor}
          busy={busy}
          onCancel={() => setEditor(undefined)}
          onSave={(data) =>
            void action(async () => {
              await api("/api/admin/promotions", {
                method: editor ? "PATCH" : "POST",
                body: JSON.stringify(data),
              });
              setEditor(undefined);
              setNotice("Đã lưu khuyến mãi.");
              onChanged();
              await reload().catch(() =>
                setError(
                  "Mã đã được lưu; chưa tải được danh sách mới. Hãy làm mới trước khi sửa tiếp.",
                ),
              );
            })
          }
        />
      )}
    </section>
  );
}
function localTime(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
function PromotionEditor({
  entry,
  busy,
  onSave,
  onCancel,
}: {
  entry: Promotion | null;
  busy: boolean;
  onSave: (data: object) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState(entry?.discountType ?? "percent");
  const [openedAt] = useState(() => Date.now());
  return (
    <form
      className="account-section"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        onSave({
          code: entry?.code ?? String(data.get("code")).trim().toUpperCase(),
          title: data.get("title"),
          discountType: type,
          value: Number(data.get("value")),
          minimumSubtotal: Number(data.get("minimumSubtotal")),
          maxDiscount: type === "percent" ? Number(data.get("maxDiscount")) : 0,
          startsAt: new Date(String(data.get("startsAt"))).toISOString(),
          endsAt: new Date(String(data.get("endsAt"))).toISOString(),
          isActive: data.has("isActive"),
          ...(entry ? { revision: entry.revision } : {}),
        });
      }}
    >
      <fieldset className="checkout-fields" disabled={busy}>
        <legend>{entry ? "Sửa khuyến mãi" : "Tạo khuyến mãi"}</legend>
        <label>
          Mã giảm giá
          <input
            name="code"
            required
            minLength={3}
            maxLength={24}
            pattern="(?:[A-Za-z0-9_]|-){3,24}"
            defaultValue={entry?.code}
            readOnly={!!entry}
            placeholder="KFC20"
          />
        </label>
        <label>
          Tên chương trình
          <input
            name="title"
            required
            minLength={2}
            maxLength={100}
            defaultValue={entry?.title}
          />
        </label>
        <label>
          Kiểu giảm
          <select
            value={type}
            onChange={(e) => setType(e.target.value as "percent" | "fixed")}
          >
            <option value="percent">Theo phần trăm</option>
            <option value="fixed">Số tiền cố định</option>
          </select>
        </label>
        <label>
          {type === "percent" ? "Phần trăm giảm" : "Số tiền giảm (đ)"}
          <input
            name="value"
            type="number"
            required
            min={1}
            max={type === "percent" ? 100 : 1000000}
            step={1}
            defaultValue={entry?.value ?? 10}
          />
        </label>
        <label>
          Tiền món tối thiểu (đ)
          <input
            name="minimumSubtotal"
            type="number"
            required
            min={0}
            max={10000000}
            step={1}
            defaultValue={entry?.minimumSubtotal ?? 0}
          />
        </label>
        {type === "percent" && (
          <label>
            Trần giảm (đ, 0 = không giới hạn)
            <input
              name="maxDiscount"
              type="number"
              required
              min={0}
              max={1000000}
              step={1}
              defaultValue={entry?.maxDiscount ?? 0}
            />
          </label>
        )}
        <label>
          Bắt đầu
          <input
            name="startsAt"
            type="datetime-local"
            required
            defaultValue={localTime(
              entry?.startsAt ?? new Date(openedAt).toISOString(),
            )}
          />
        </label>
        <label>
          Kết thúc
          <input
            name="endsAt"
            type="datetime-local"
            required
            defaultValue={localTime(
              entry?.endsAt ?? new Date(openedAt + 7 * 86400000).toISOString(),
            )}
          />
        </label>
        <p className="small muted">
          Giờ theo múi giờ máy đang dùng. Thời điểm kết thúc không còn áp dụng
          mã.
        </p>
        <label className="checkbox-label">
          <input
            name="isActive"
            type="checkbox"
            defaultChecked={entry?.isActive ?? true}
          />
          Cho phép áp dụng
        </label>
      </fieldset>
      <div className="address-book-actions">
        <button type="submit" className="button primary" disabled={busy}>
          Lưu khuyến mãi
        </button>
        <button
          type="button"
          className="text-button"
          disabled={busy}
          onClick={onCancel}
        >
          Đóng trình sửa mã
        </button>
      </div>
    </form>
  );
}
