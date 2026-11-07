import type { ShopSettings, ShopView } from "./types/shop";
export const shopDayLabels = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];
export function defaultShopSettings(): ShopSettings {
  return { name: "KFC Force Agent · Cửa hàng demo", address: "Điểm nhận món demo · chưa cấu hình địa chỉ", phone: "", announcement: "",
    acceptingOrders: true, pickupEnabled: true, deliveryEnabled: true, deliveryFee: 15000, minimumSubtotal: 0,
    scheduleEnabled: false, hours: Array.from({ length: 7 }, (_, day) => ({ day, closed: false, opensAt: "08:00", closesAt: "22:00" })),
    revision: "default", updatedAt: "2026-01-01T00:00:00.000Z" };
}
export function shopAvailability(settings: ShopSettings, now: number): ShopView["availability"] {
  const local = new Date(now + 7 * 60 * 60 * 1000);
  const day = settings.hours.find(entry => entry.day === local.getUTCDay());
  const minute = local.getUTCHours() * 60 + local.getUTCMinutes();
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  const withinHours = !settings.scheduleEnabled || !!(day && !day.closed && minute >= minutes(day.opensAt) && minute < minutes(day.closesAt));
  const open = settings.acceptingOrders && withinHours;
  return { open, canPickup: open && settings.pickupEnabled, canDelivery: open && settings.deliveryEnabled,
    message: !settings.acceptingOrders ? "Cửa hàng tạm ngừng nhận đơn mới." : !withinHours ? "Đang ngoài giờ nhận đơn (giờ Việt Nam)." :
      !settings.pickupEnabled && !settings.deliveryEnabled ? "Cửa hàng đang tắt cả hai hình thức nhận món." : "Cửa hàng đang nhận đơn demo.",
    checkedAt: new Date(now).toISOString() };
}
