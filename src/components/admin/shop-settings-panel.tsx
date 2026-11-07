"use client";
import { useEffect, useRef, useState } from "react";
import { api, RequestError } from "@/lib/storefront-types";
import { shopDayLabels } from "@/lib/shop-settings";
import type { ShopView } from "@/lib/types/shop";

export function ShopSettingsPanel({ onExpired, onChanged }: { onExpired: () => void; onChanged: () => void }) {
  const [view, setView] = useState<ShopView | null>(null);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const working = useRef(false);
  const alive = useRef(false);
  const alert = useRef<HTMLParagraphElement>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { if (error) alert.current?.focus(); }, [error]);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    api<ShopView>("/api/admin/shop", { signal: controller.signal }).then(value => {
      if (active) { setView(value); setDirty(false); setError(""); }
    }).catch(err => {
      if (!active) return;
      if (err instanceof RequestError && err.status === 401) onExpired();
      else setError(err instanceof Error ? err.message : "Chưa tải được cấu hình.");
    }).finally(() => window.clearTimeout(timeout));
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, [reload, onExpired]);
  const save = async (form: HTMLFormElement) => {
    if (working.current || !view) return;
    working.current = true; setBusy(true); setError(""); setNotice("");
    const data = new FormData(form);
    const text = (name: string) => String(data.get(name) ?? "");
    try {
      const next = await api<ShopView>("/api/admin/shop", { method: "PATCH", body: JSON.stringify({
        revision: view.settings.revision, name: text("name"), address: text("address"), phone: text("phone"), announcement: text("announcement"),
        acceptingOrders: data.has("acceptingOrders"), pickupEnabled: data.has("pickupEnabled"), deliveryEnabled: data.has("deliveryEnabled"),
        deliveryFee: Number(text("deliveryFee")), minimumSubtotal: Number(text("minimumSubtotal")), scheduleEnabled: data.has("scheduleEnabled"),
        hours: Array.from({ length: 7 }, (_, day) => ({ day, closed: data.has("closed-" + day), opensAt: text("opens-" + day), closesAt: text("closes-" + day) })),
      }) });
      if (!alive.current) return;
      setView(next); setDirty(false); setNotice("Đã lưu điều kiện nhận đơn. Đơn đã đặt giữ nguyên thông tin cũ.");
      if (typeof BroadcastChannel !== "undefined") {
        const channel = new BroadcastChannel("kfc-shop-settings"); channel.postMessage("changed"); channel.close();
      }
      onChanged();
    } catch (err) {
      if (!alive.current) return;
      if (err instanceof RequestError && err.status === 401) onExpired();
      else setError(err instanceof Error ? err.message : "Chưa lưu được cấu hình.");
    } finally { working.current = false; if (alive.current) setBusy(false); }
  };
  return <section className="shop-settings-panel panel" aria-labelledby="shop-settings-title">
    <div className="section-heading"><div><span className="eyebrow">ĐIỂM NHẬN MÓN · ĐIỀU KIỆN ĐẶT HÀNG</span><h2 id="shop-settings-title">Cửa hàng & tiếp nhận đơn</h2></div>
      <button className="text-button" disabled={busy} onClick={() => { setView(null); setNotice(""); setReload(value => value + 1); }}>
        {dirty ? "Tải lại · bỏ thay đổi chưa lưu" : "Tải lại cấu hình"}
      </button></div>
    <p className="small muted">Thông tin này hiển thị công khai. Giờ dùng UTC+7, trong cùng ngày; 24:00 là hết ngày. Chưa hỗ trợ lịch qua đêm hoặc ngày nghỉ ngoại lệ. Tắt nhận đơn không huỷ các đơn đang xử lý.</p>
    {error && <p ref={alert} tabIndex={-1} role="alert" className="error-box">{error}</p>}
    {notice && <p role="status" className="notice-box">{notice}</p>}
    {!view ? <p role="status">Đang tải cấu hình cửa hàng…</p> : <>
      {!view.configured && <p className="notice-box">Đang dùng cấu hình mặc định của bản demo. Hãy điền điểm nhận món và liên hệ phù hợp trước khi trình diễn.</p>}
      <p className="small muted">Tại lần tải: {view.availability.message}</p>
      <form key={view.settings.revision} onChange={() => setDirty(true)} onSubmit={event => { event.preventDefault(); void save(event.currentTarget); }}>
        <fieldset className="checkout-fields" disabled={busy}>
          <legend className="sr-only">Thông tin và chính sách cửa hàng</legend>
          <div className="shop-fields-grid">
            <label>Tên cửa hàng<input name="name" defaultValue={view.settings.name} minLength={2} maxLength={100} required /></label>
            <label>Điện thoại cửa hàng<input name="phone" defaultValue={view.settings.phone} maxLength={15} placeholder="Để trống nếu không công bố" /></label>
          </div>
          <label>Địa chỉ nhận món<input name="address" defaultValue={view.settings.address} minLength={5} maxLength={300} required /></label>
          <label>Thông báo công khai<textarea name="announcement" defaultValue={view.settings.announcement} maxLength={300} placeholder="Ví dụ: Cửa hàng tạm nghỉ để bảo trì." /></label>
          <div className="shop-toggles">
            <label className="checkbox-label"><input name="acceptingOrders" type="checkbox" defaultChecked={view.settings.acceptingOrders} /> Nhận đơn mới</label>
            <label className="checkbox-label"><input name="pickupEnabled" type="checkbox" defaultChecked={view.settings.pickupEnabled} /> Cho phép nhận tại cửa hàng</label>
            <label className="checkbox-label"><input name="deliveryEnabled" type="checkbox" defaultChecked={view.settings.deliveryEnabled} /> Cho phép giao hàng demo</label>
          </div>
          <div className="shop-fields-grid">
            <label>Phí giao hàng (đ)<input name="deliveryFee" type="number" min={0} max={200000} step={1} defaultValue={view.settings.deliveryFee} required /></label>
            <label>Tiền món tối thiểu (đ)<input name="minimumSubtotal" type="number" min={0} max={10000000} step={1} defaultValue={view.settings.minimumSubtotal} required /></label>
          </div>
          <label className="checkbox-label"><input name="scheduleEnabled" type="checkbox" defaultChecked={view.settings.scheduleEnabled} /> Giới hạn nhận đơn theo lịch bên dưới</label>
          <div className="shop-hours">
            {view.settings.hours.map(day => <div key={day.day} className="shop-hours-row">
              <strong>{shopDayLabels[day.day]}</strong>
              <label className="checkbox-label"><input type="checkbox" name={"closed-" + day.day} defaultChecked={day.closed} /> Nghỉ</label>
              <label>Mở<input aria-label={"Giờ mở " + shopDayLabels[day.day]} name={"opens-" + day.day} defaultValue={day.opensAt} maxLength={5} placeholder="08:00" required /></label>
              <label>Đóng<input aria-label={"Giờ đóng " + shopDayLabels[day.day]} name={"closes-" + day.day} defaultValue={day.closesAt} maxLength={5} placeholder="22:00" required /></label>
            </div>)}
          </div>
          <p className="small muted">Giá trị tối thiểu tính tiền món trước giảm giá và phí giao. Bật lịch chỉ nhận đơn trong khoảng giờ mở (bao gồm) đến giờ đóng (không bao gồm). Dùng tắt Nhận đơn mới cho nghỉ đột xuất.</p>
        </fieldset>
        <button className="button primary" type="submit" disabled={busy || !dirty}>{busy ? "Đang lưu…" : "Lưu điều kiện nhận đơn"}</button>
      </form>
    </>}
  </section>;
}
