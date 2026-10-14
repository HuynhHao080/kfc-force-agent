import { IMenuRepository } from "@/lib/db/repositories/interfaces/menu-repository.interface";
import {
  MenuCategory,
  MenuItem,
  MenuItemOption,
  OptionValue,
  ProductBundle,
  BundleItem,
} from "@/lib/types/menu";

export class MenuService {
  constructor(private menuRepository: IMenuRepository) {}

  // Categories
  async getCategories(): Promise<MenuCategory[]> {
    return this.menuRepository.getCategories();
  }

  async getCategoryById(categoryId: string): Promise<MenuCategory | null> {
    return this.menuRepository.getCategoryById(categoryId);
  }

  // Menu Items
  async getMenuItems(): Promise<MenuItem[]> {
    return this.menuRepository.getMenuItems();
  }

  async getMenuItemById(itemId: string): Promise<MenuItem | null> {
    return this.menuRepository.getMenuItemById(itemId);
  }

  async getItemsByCategory(categoryId: string): Promise<MenuItem[]> {
    return this.menuRepository.getItemsByCategory(categoryId);
  }

  async searchMenuItems(query: string): Promise<MenuItem[]> {
    return this.menuRepository.searchMenuItems(query);
  }

  // Item Options
  async getItemOptions(menuItemId: string): Promise<MenuItemOption[]> {
    return this.menuRepository.getItemOptions(menuItemId);
  }

  async getItemOptionById(optionId: string): Promise<MenuItemOption | null> {
    return this.menuRepository.getItemOptionById(optionId);
  }

  // Option Values
  async getOptionValues(optionId: string): Promise<OptionValue[]> {
    return this.menuRepository.getOptionValues(optionId);
  }

  async getOptionValueById(valueId: string): Promise<OptionValue | null> {
    return this.menuRepository.getOptionValueById(valueId);
  }

  // Product Bundles
  async getProductBundles(): Promise<ProductBundle[]> {
    return this.menuRepository.getProductBundles();
  }

  async getProductBundleById(bundleId: string): Promise<ProductBundle | null> {
    return this.menuRepository.getProductBundleById(bundleId);
  }

  // Bundle Items
  async getBundleItems(bundleId: string): Promise<BundleItem[]> {
    return this.menuRepository.getBundleItems(bundleId);
  }

  // Utility methods
  async getAvailableMenuItems(): Promise<MenuItem[]> {
    return this.menuRepository.getAvailableMenuItems();
  }

  async getActiveCategories(): Promise<MenuCategory[]> {
    return this.menuRepository.getActiveCategories();
  }
  async getMenuItemWithOptions(
    itemId: string,
  ): Promise<{ item: MenuItem | null; options: MenuItemOption[] }> {
    const item = await this.menuRepository.getMenuItemById(itemId);
    if (!item || !item.isActive || !item.isAvailable) {
      return { item: null, options: [] };
    }

    const options = await this.menuRepository.getItemOptions(itemId);
    return { item, options };
  }

  async getBundleWithItems(
    bundleId: string,
  ): Promise<{ bundle: ProductBundle | null; items: BundleItem[] }> {
    const bundle = await this.menuRepository.getProductBundleById(bundleId);
    if (!bundle || !bundle.isActive || !bundle.isAvailable) {
      return { bundle: null, items: [] };
    }

    const items = await this.menuRepository.getBundleItems(bundleId);
    return { bundle, items };
  }

  async searchMenuWithDetails(query: string): Promise<MenuItem[]> {
    const results = await this.menuRepository.searchMenuItems(query);
    return results.filter((item) => item.isActive && item.isAvailable);
  }

  /**
   * Accent-insensitive Vietnamese search.
   *
   * "ga ran" matches "Gà Rán"; "combo ga cay" matches "Combo Gà Cay".
   * Falls back to the repository's plain search when the accent-insensitive
   * pass returns nothing, so no result is ever lost.
   */
  async searchMenuItemsForCustomer(query: string): Promise<MenuItem[]> {
    const normalizedQuery = normalizeVietnamese(query);
    const available = await this.menuRepository.getAvailableMenuItems();
    if (!normalizedQuery) {
      return available;
    }

    const matched = available.filter((item) => {
      const haystack = [item.name, item.description ?? "", (item.tags ?? []).join(" ")]
        .map(normalizeVietnamese)
        .join(" ");
      return haystack.includes(normalizedQuery);
    });

    if (matched.length > 0) {
      return matched;
    }
    return this.searchMenuWithDetails(query);
  }

  // Vietnamese customer-facing methods
  async getVietnameseCategories(): Promise<MenuCategory[]> {
    const categories = await this.menuRepository.getActiveCategories();
    return categories.map((category) => ({
      ...category,
      name: normalizeVietnamese(category.name),
    }));
  }

  async getAvailableMenuItemsForCustomer(): Promise<MenuItem[]> {
    const items = await this.menuRepository.getAvailableMenuItems();
    return items.map((item) => ({
      ...item,
      name: normalizeVietnamese(item.name),
      description: item.description ? normalizeVietnamese(item.description) : undefined,
    }));
  }
}

/** Lower-cases and strips Vietnamese diacritics for accent-insensitive matching. */
export function normalizeVietnamese(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

