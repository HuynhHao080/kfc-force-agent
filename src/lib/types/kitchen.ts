export const kitchenStatuses = ["CONFIRMED", "PREPARING", "READY", "DELIVERING"] as const;
export type KitchenStatus = (typeof kitchenStatuses)[number];
export interface KitchenCard {
  id: string;
  status: KitchenStatus;
  fulfillment: "pickup" | "delivery";
  createdAt: string;
  updatedAt: string;
  note: string;
  items: { menuItemId: string; name: string; quantity: number }[];
}
export interface KitchenBoard {
  generatedAt: string;
  sampleLimit: number;
  sampledOrders: number;
  fulfillment: "all" | "pickup" | "delivery";
  matchedActiveOrders: number;
  excludedActiveOrders: number;
  counts: Record<KitchenStatus, number>;
  cards: KitchenCard[];
  preparation: { menuItemId: string; name: string; waiting: number; preparing: number; total: number }[];
}
