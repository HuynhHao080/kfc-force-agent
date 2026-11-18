import { IMenuRepository } from "@/lib/db/repositories/interfaces/menu-repository.interface";
import { menuSearchOptionsSchema, type MenuSearchOptions } from "@/lib/validation/menu";
import { DomainError } from "@/lib/domain-error";
import { normalizeVietnamese, matchesMenuQuery } from "@/lib/menu-search";
import { matchMenuItems } from "@/lib/agent/understanding/menu-resolver";
export { normalizeVietnamese, matchesMenuQuery } from "@/lib/menu-search";
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
   * Prefix matching applies to product names. Descriptions match whole words.
   */
  async searchMenuItemsForCustomer(query: string, filters: MenuSearchOptions = {}): Promise<MenuItem[]> {
    const options = menuSearchOptionsSchema.parse(filters);
    if (options.minPrice !== undefined && options.maxPrice !== undefined && options.minPrice > options.maxPrice)
      throw new DomainError("INVALID_PRICE_RANGE", "Giá tối thiểu phải nhỏ hơn hoặc bằng giá tối đa.");
    const normalizedQuery = normalizeVietnamese(query);
    const available = await this.menuRepository.getAvailableMenuItems();
    // Understanding-aware match first (no accents, aliases, typos, "lớn" vs "lon");
    // prefix matching remains the fallback for partially typed words ("bur").
    let matched = normalizedQuery ? null : available;
    if (!matched) {
      const categories = new Map((await this.menuRepository.getCategories()).map(c => [c.id, c.name]));
      const smart = matchMenuItems(query, available.map(item => ({ ...item, categoryName: categories.get(item.categoryId) })));
      matched = smart?.length
        ? available.filter(item => smart.some(hit => hit.id === item.id))
        : available.filter(item => matchesMenuQuery(item, normalizedQuery, { allowNamePrefix: true }));
    }
    const result = matched.filter(item =>
      (!options.categoryId || item.categoryId === options.categoryId) &&
      (options.minPrice === undefined || item.price >= options.minPrice) &&
      (options.maxPrice === undefined || item.price <= options.maxPrice));
    if (options.sort === "price_asc") result.sort((a, b) => a.price - b.price || a.id.localeCompare(b.id));
    if (options.sort === "price_desc") result.sort((a, b) => b.price - a.price || a.id.localeCompare(b.id));
    if (options.sort === "name") result.sort((a, b) => a.name.localeCompare(b.name, "vi") || a.id.localeCompare(b.id));
    return options.limit ? result.slice(0, options.limit) : result;
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
