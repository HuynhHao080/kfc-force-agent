import {
  MenuCategory,
  MenuItem,
  MenuItemOption,
  OptionValue,
  ProductBundle,
  BundleItem,
} from "@/lib/types/menu";

import type { CatalogAuditEntry } from "@/lib/types/catalog-audit";
import type { Promotion } from "@/lib/types/promotion";
export interface IMenuRepository {
  getShopSettings(): Promise<import("@/lib/types/shop").ShopSettings | null>;
  saveShopSettings(settings: import("@/lib/types/shop").ShopSettings, expectedRevision: string): Promise<void>;
  getPromotions(): Promise<Promotion[]>;
  getPromotion(code: string): Promise<Promotion | null>;
  savePromotion(entry: Promotion, expectedRevision?: string): Promise<void>;
  getCatalogAudit(limit: number): Promise<CatalogAuditEntry[]>;
  // Categories
  saveCategory(
    category: MenuCategory,
    audit?: CatalogAuditEntry,
  ): Promise<void>;
  getCategories(): Promise<MenuCategory[]>;
  getCategoryById(categoryId: string): Promise<MenuCategory | null>;

  saveMenuItem(item: MenuItem, audit?: CatalogAuditEntry): Promise<void>;

  // Menu Items
  getMenuItems(): Promise<MenuItem[]>;
  getMenuItemById(itemId: string): Promise<MenuItem | null>;
  getItemsByCategory(categoryId: string): Promise<MenuItem[]>;
  searchMenuItems(query: string): Promise<MenuItem[]>;

  // Item Options
  getItemOptions(menuItemId: string): Promise<MenuItemOption[]>;
  getItemOptionById(optionId: string): Promise<MenuItemOption | null>;

  // Option Values
  getOptionValues(optionId: string): Promise<OptionValue[]>;
  getOptionValueById(valueId: string): Promise<OptionValue | null>;

  // Product Bundles
  getProductBundles(): Promise<ProductBundle[]>;
  getProductBundleById(bundleId: string): Promise<ProductBundle | null>;

  // Bundle Items
  getBundleItems(bundleId: string): Promise<BundleItem[]>;

  // Utility
  getAvailableMenuItems(): Promise<MenuItem[]>;
  getActiveCategories(): Promise<MenuCategory[]>;
}
