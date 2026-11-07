"use client";
import { useEffect, useRef, useState } from "react";
import type { Address } from "@/lib/types/user";
import type { AddressBook } from "@/lib/types/address-book";
import type { CustomerProfile } from "@/lib/types/account";
import { formatSavedAddress } from "@/lib/address-format";
import { api, RequestError } from "@/lib/storefront-types";
export function AddressBookDialog({
  initial,
  profile,
  onClose,
  onChanged,
  onExpired,
}: {
  initial: AddressBook;
  profile: CustomerProfile;
  onClose: () => void;
  onChanged: (book: AddressBook) => void;
  onExpired: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const errorMessage = useRef<HTMLParagraphElement>(null);
  const working = useRef(false);
  const [book, setBook] = useState(initial);
  const [editing, setEditing] = useState<Address | null | undefined>(undefined);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  useEffect(() => {
    if (error) errorMessage.current?.focus();
  }, [error]);
  const request = async (method: string, data?: object) => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api<AddressBook>("/api/account/addresses", {
        method,
        headers: { "X-KFC-Owner": profile.id },
        body: data
          ? JSON.stringify({ ...data, revision: book.revision })
          : undefined,
      });
      setBook(result);
      onChanged(result);
      setEditing(undefined);
      setRemoveId(null);
      setNotice(
        method === "GET" ? "Đã làm mới sổ địa chỉ." : "Đã cập nhật sổ địa chỉ.",
      );
    } catch (err) {
      if (
        err instanceof RequestError &&
        (err.status === 401 || err.code === "IDENTITY_CHANGED")
      )
        onExpired();
      else
        setError(
          err instanceof Error ? err.message : "Chưa thể cập nhật sổ địa chỉ.",
        );
    } finally {
      working.current = false;
      setBusy(false);
    }
  };
  const fields = (entry: Address) => ({
    addressId: entry.id,
    label: entry.label,
    recipientName: entry.recipientName,
    phone: entry.phone,
    addressLine: formatSavedAddress(entry),
    isDefault: true,
  });
  return (
    <dialog
      ref={dialog}
      className="checkout-dialog address-book-dialog"
      aria-labelledby="address-book-title"
      onClose={onClose}
      onCancel={(event) => {
        if (busy) event.preventDefault();
      }}
    >
      <div className="section-heading">
        <div>
          <span className="eyebrow">GIAO ĐẾN NƠI BẠN MUỐN</span>
          <h2 id="address-book-title">Sổ địa chỉ</h2>
        </div>
        <button
          className="icon-button"
          aria-label="Đóng sổ địa chỉ"
          disabled={busy}
          onClick={() => dialog.current?.close()}
        >
          ×
        </button>
      </div>
      <p className="small muted">
        Lưu tối đa 5 địa chỉ cho tài khoản. Sửa địa chỉ không thay đổi thông tin
        trong các đơn đã đặt. Địa chỉ đầu tiên tự là mặc định.
      </p>
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
      <div className="section-heading address-book-toolbar">
        <button
          className="text-button"
          disabled={busy}
          onClick={() => void request("GET")}
        >
          Làm mới sổ địa chỉ
        </button>
        <button
          className="button secondary"
          disabled={busy || book.addresses.length >= 5}
          onClick={() => {
            setEditing(null);
            setRemoveId(null);
            setError("");
          }}
        >
          + Thêm địa chỉ
        </button>
      </div>
      {!book.addresses.length && editing === undefined && (
        <p className="muted">Bạn chưa lưu địa chỉ nào.</p>
      )}
      <div className="address-book-list">
        {book.addresses.map((entry) => (
          <article key={entry.id}>
            <div className="section-heading">
              <h3>{entry.label}</h3>
              {entry.isDefault && (
                <span className="status-badge">Mặc định</span>
              )}
            </div>
            <strong>{entry.recipientName}</strong>
            <p>{entry.phone}</p>
            <p>{formatSavedAddress(entry)}</p>
            <div className="address-book-actions">
              <button
                className="text-button"
                disabled={busy}
                onClick={() => {
                  setEditing(entry);
                  setRemoveId(null);
                  setError("");
                }}
              >
                Sửa {entry.label}
              </button>
              {!entry.isDefault && (
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => void request("PATCH", fields(entry))}
                >
                  Chọn {entry.label} mặc định
                </button>
              )}
              <button
                className="text-button"
                disabled={busy}
                onClick={() => {
                  setRemoveId(entry.id);
                  setEditing(undefined);
                }}
              >
                Xoá {entry.label}
              </button>
            </div>
            {removeId === entry.id && (
              <div className="notice-box">
                <p>
                  Xoá địa chỉ {entry.label}? Đơn đã đặt vẫn giữ thông tin cũ.
                </p>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() =>
                    void request("DELETE", {
                      addressId: entry.id,
                      confirm: true,
                    })
                  }
                >
                  Xác nhận xoá địa chỉ
                </button>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => setRemoveId(null)}
                >
                  Giữ địa chỉ
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
      {editing !== undefined && (
        <AddressEditor
          key={editing?.id ?? "new"}
          entry={editing}
          profile={profile}
          busy={busy}
          onCancel={() => setEditing(undefined)}
          onSave={(data) => void request(editing ? "PATCH" : "POST", data)}
        />
      )}
    </dialog>
  );
}
function AddressEditor({
  entry,
  profile,
  busy,
  onSave,
  onCancel,
}: {
  entry: Address | null;
  profile: CustomerProfile;
  busy: boolean;
  onSave: (data: object) => void;
  onCancel: () => void;
}) {
  return (
    <form
      className="account-section"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        onSave({
          ...(entry ? { addressId: entry.id } : {}),
          label: data.get("label"),
          recipientName: data.get("recipientName"),
          phone: data.get("phone"),
          addressLine: data.get("addressLine"),
          isDefault: !!entry?.isDefault || data.has("isDefault"),
        });
      }}
    >
      <fieldset className="checkout-fields" disabled={busy}>
        <legend>{entry ? "Sửa địa chỉ" : "Thêm địa chỉ mới"}</legend>
        <label>
          Nhãn địa chỉ
          <input
            name="label"
            minLength={2}
            maxLength={50}
            required
            placeholder="Nhà, Công ty…"
            defaultValue={entry?.label}
          />
        </label>
        <label>
          Tên người nhận
          <input
            name="recipientName"
            autoComplete="name"
            minLength={2}
            maxLength={100}
            required
            defaultValue={entry?.recipientName ?? profile.fullName}
          />
        </label>
        <label>
          Điện thoại nhận hàng
          <input
            name="phone"
            type="tel"
            autoComplete="tel"
            pattern="(0|\+84)[0-9]{9}"
            required
            defaultValue={entry?.phone}
          />
        </label>
        <label>
          Địa chỉ đầy đủ
          <textarea
            name="addressLine"
            autoComplete="street-address"
            minLength={10}
            maxLength={300}
            required
            defaultValue={entry ? formatSavedAddress(entry) : ""}
          />
        </label>
        <label className="checkbox-label">
          <input
            name="isDefault"
            type="checkbox"
            defaultChecked={entry?.isDefault}
            disabled={entry?.isDefault}
          />
          Đặt làm địa chỉ mặc định
        </label>
        {entry?.isDefault && (
          <p className="small muted">
            Chọn một địa chỉ khác làm mặc định nếu muốn đổi.
          </p>
        )}
      </fieldset>
      <div className="address-book-actions">
        <button type="submit" className="button primary" disabled={busy}>
          Lưu địa chỉ
        </button>
        <button
          type="button"
          className="text-button"
          disabled={busy}
          onClick={onCancel}
        >
          Huỷ sửa địa chỉ
        </button>
      </div>
    </form>
  );
}
