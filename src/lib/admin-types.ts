import type { Order } from "./types/order";
export interface AdminDashboard {
  revision?: string;
  orders: Order[];
  stats: {
    sampleLimit: number;
    totalOrders: number;
    activeOrders: number;
    completedOrders: number;
    cancelledOrders: number;
    completedValue: number;
    daily: { date: string; count: number; value: number }[];
  };
}
