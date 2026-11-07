export interface ShopHours { day: number; closed: boolean; opensAt: string; closesAt: string }
export interface ShopSettings {
  name: string;
  address: string;
  phone: string;
  announcement: string;
  acceptingOrders: boolean;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  deliveryFee: number;
  minimumSubtotal: number;
  scheduleEnabled: boolean;
  hours: ShopHours[];
  revision: string;
  updatedAt: string;
}
export interface ShopView {
  configured: boolean;
  settings: ShopSettings;
  availability: { open: boolean; canPickup: boolean; canDelivery: boolean; message: string; checkedAt: string };
}
export type OrderStoreSnapshot = Pick<ShopSettings, "name" | "address" | "phone" | "revision">;
