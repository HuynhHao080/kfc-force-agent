"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/storefront-types";
export function AccountDialog({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      className="checkout-dialog account-dialog"
      ref={dialog}
      aria-labelledby="account-title"
      onClose={onClose}
      onCancel={(event) => {
        if (busy) event.preventDefault();
      }}
    >
      <div className="section-heading">
        <div>
          <span className="eyebrow">BỮA NGON, THEO BẠN</span>
          <h2 id="account-title">
            {mode === "login" ? "Chào bạn trở lại." : "Tạo tài khoản của bạn."}
          </h2>
        </div>
        <button
          className="icon-button"
          aria-label="Đóng tài khoản"
          disabled={busy}
          onClick={() => dialog.current?.close()}
        >
          ×
        </button>
      </div>
      <p className="small muted account-description">
        Lưu giỏ và lịch sử đơn theo tài khoản trên các trình duyệt. Dữ liệu
        khách hiện tại không tự chuyển vào tài khoản.
      </p>
      <form
        key={mode}
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          setBusy(true);
          setError("");
          const data = Object.fromEntries(new FormData(event.currentTarget));
          try {
            await api(`/api/auth/${mode}`, {
              method: "POST",
              body: JSON.stringify(data),
            });
            await onSuccess();
          } catch (err) {
            setError(
              err instanceof Error ? err.message : "Chưa thể đăng nhập.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset className="checkout-fields" disabled={busy}>
          <legend className="sr-only">Thông tin tài khoản</legend>
          {mode === "register" && (
            <label>
              Họ và tên
              <input
                name="fullName"
                autoComplete="name"
                minLength={2}
                maxLength={100}
                required
              />
            </label>
          )}
          <label>
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              maxLength={254}
              required
            />
          </label>
          <label>
            Mật khẩu
            <input
              name="password"
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              minLength={mode === "register" ? 10 : 1}
              maxLength={128}
              required
            />
          </label>
          {mode === "register" && (
            <p className="small muted">
              Ít nhất 10 ký tự. Đây là tài khoản demo, chưa có xác thực email
              hoặc khôi phục mật khẩu qua email.
            </p>
          )}
        </fieldset>
        {error && (
          <p role="alert" className="error-box">
            {error}
          </p>
        )}
        <button
          className="button primary full-width"
          type="submit"
          disabled={busy}
        >
          {busy
            ? "Đang xử lý…"
            : mode === "login"
              ? "Đăng nhập"
              : "Tạo tài khoản"}
        </button>
        <button
          className="text-button full-width"
          type="button"
          disabled={busy}
          onClick={() => {
            setError("");
            setMode(mode === "login" ? "register" : "login");
          }}
        >
          {mode === "login"
            ? "Chưa có tài khoản? Đăng ký"
            : "Đã có tài khoản? Đăng nhập"}
        </button>
      </form>
    </dialog>
  );
}
