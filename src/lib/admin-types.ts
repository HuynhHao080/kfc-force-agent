import type { Order } from "./types/order";
import type { MenuCategory, MenuItem } from "./types/menu";
export type CatalogMenuItem = MenuItem & { catalogRevision: string };
export type CatalogCategory = MenuCategory & { catalogRevision: string };
export interface AdminCatalog {
  items: CatalogMenuItem[];
  categories: CatalogCategory[];
}
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
