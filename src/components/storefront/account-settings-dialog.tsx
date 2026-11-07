"use client";
import { useEffect, useRef, useState } from "react";
import type { CustomerProfile } from "@/lib/types/account";
import { api, RequestError } from "@/lib/storefront-types";

export function AccountSettingsDialog({
  profile,
  onClose,
  onSaved,
  onSessionEnded,
}: {
  profile: CustomerProfile;
  onClose: () => void;
  onSaved: (profile: CustomerProfile) => void;
  onSessionEnded: (message: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const working = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const submit = async (form: HTMLFormElement, password: boolean) => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    const data = Object.fromEntries(new FormData(form));
    try {
      if (password) {
        await api("/api/account/password", {
          method: "POST",
          headers: { "X-KFC-Owner": profile.id },
          body: JSON.stringify(data),
        });
        form.reset();
        onSessionEnded(
          "Đã đổi mật khẩu. Mọi phiên cũ đã hết hiệu lực; hãy đăng nhập lại.",
        );
      } else {
        const response = await api<{ profile: CustomerProfile }>(
          "/api/account/profile",
          {
            method: "PATCH",
            headers: { "X-KFC-Owner": profile.id },
            body: JSON.stringify(data),
          },
        );
        onSaved(response.profile);
        setNotice("Đã cập nhật họ tên.");
      }
    } catch (err) {
      if (
        err instanceof RequestError &&
        (err.status === 401 || err.code === "IDENTITY_CHANGED")
      ) {
        onSessionEnded("Phiên tài khoản đã hết hạn. Vui lòng đăng nhập lại.");
      } else {
        setError(
          err instanceof Error ? err.message : "Chưa thể cập nhật tài khoản.",
        );
      }
    } finally {
      if (password) form.reset();
      working.current = false;
      setBusy(false);
    }
  };
  return (
    <dialog
      ref={dialog}
      className="checkout-dialog account-dialog"
      aria-labelledby="account-settings-title"
      onClose={onClose}
      onCancel={(event) => {
        if (busy) event.preventDefault();
      }}
    >
      <div className="section-heading">
        <div>
          <span className="eyebrow">TÀI KHOẢN CỦA BẠN</span>
          <h2 id="account-settings-title">Thông tin & bảo mật</h2>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Đóng quản lý tài khoản"
          disabled={busy}
          onClick={() => dialog.current?.close()}
        >
          ×
        </button>
      </div>
      <p className="small muted account-email">{profile.email}</p>
      {error && (
        <p role="alert" className="error-box">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="notice-box">
          {notice}
        </p>
      )}
      <form
        className="account-section"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(event.currentTarget, false);
        }}
      >
        <fieldset className="checkout-fields" disabled={busy}>
          <legend>Hồ sơ cá nhân</legend>
          <label>
            Họ và tên
            <input
              name="fullName"
              autoComplete="name"
              defaultValue={profile.fullName}
              minLength={2}
              maxLength={100}
              required
            />
          </label>
        </fieldset>
        <button
          type="submit"
          className="button primary full-width"
          disabled={busy}
        >
          Lưu họ tên
        </button>
      </form>
      <form
        className="account-section"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(event.currentTarget, true);
        }}
      >
        <fieldset className="checkout-fields" disabled={busy}>
          <legend>Đổi mật khẩu</legend>
          <p className="small muted">
            Đổi mật khẩu sẽ đăng xuất mọi trình duyệt đang dùng tài khoản này.
            Giỏ hàng và lịch sử đơn vẫn được giữ.
          </p>
          <label>
            Mật khẩu hiện tại
            <input
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              maxLength={128}
              required
            />
          </label>
          <label>
            Mật khẩu mới
            <input
              name="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={10}
              maxLength={128}
              required
            />
          </label>
          <label>
            Nhập lại mật khẩu mới
            <input
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={10}
              maxLength={128}
              required
            />
          </label>
          <p className="small muted">
            Mật khẩu mới ít nhất 10 ký tự và khác mật khẩu hiện tại. Nếu mất
            phản hồi sau khi gửi, hãy đăng nhập lại để kiểm tra; hệ thống không
            tự gửi lại thao tác.
          </p>
        </fieldset>
        <button
          type="submit"
          className="button secondary full-width"
          disabled={busy}
        >
          Đổi mật khẩu & đăng xuất
        </button>
      </form>
    </dialog>
  );
}
