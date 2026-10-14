import {
  MenuCategory,
  MenuItem,
  MenuItemOption,
  OptionValue,
  ProductBundle,
  BundleItem,
} from "@/lib/types/menu";

export interface IMenuRepository {
  // Categories
  getCategories(): Promise<MenuCategory[]>;
  getCategoryById(categoryId: string): Promise<MenuCategory | null>;

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
