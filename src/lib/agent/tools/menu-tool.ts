import { AgentTool, ToolExecutionContext } from "./agent-tool";
import { MenuService } from "@/lib/services/menu-service";
import {
  MenuCategory,
  MenuItem,
  MenuItemOption,
  ProductBundle,
  BundleItem,
} from "@/lib/types/menu";
import { z } from "zod";

export interface MenuToolInput {
  operation:
    | "list_categories"
    | "list_items"
    | "search"
    | "get_item"
    | "get_options"
    | "list_bundles"
    | "get_bundle"
    | "get_item_with_options"
    | "get_bundle_with_items";
  query?: string;
  categoryId?: string;
  itemId?: string;
  bundleId?: string;
  optionId?: string;
  valueId?: string;
}

export interface MenuToolOutput {
  categories?: MenuCategory[];
  items?: MenuItem[];
  item?: MenuItem | null;
  options?: MenuItemOption[];
  bundles?: ProductBundle[];
  bundle?: ProductBundle | null;
  bundleItems?: BundleItem[];
  message?: string;
}

export class MenuTool extends AgentTool<MenuToolInput, MenuToolOutput> {
  readonly name = "menu";
  readonly description = "Menu operations including categories, items, search, and bundles";

  constructor(private menuService: MenuService) {
    super();
  }

  readonly inputSchema = z.object({
    operation: z.enum([
      "list_categories",
      "list_items",
      "search",
      "get_item",
      "get_options",
      "list_bundles",
      "get_bundle",
      "get_item_with_options",
      "get_bundle_with_items",
    ]),
    query: z.string().optional(),
    categoryId: z.string().optional(),
    itemId: z.string().optional(),
    bundleId: z.string().optional(),
    optionId: z.string().optional(),
    valueId: z.string().optional(),
  });

  readonly outputSchema = z.object({
    categories: z.array(z.any()).optional(),
    items: z.array(z.any()).optional(),
    item: z.any().optional(),
    options: z.array(z.any()).optional(),
    bundles: z.array(z.any()).optional(),
    bundle: z.any().optional(),
    bundleItems: z.array(z.any()).optional(),
    message: z.string().optional(),
  });

  protected async executeInternal(
    input: MenuToolInput,
    context: ToolExecutionContext,
  ): Promise<MenuToolOutput> {
    switch (input.operation) {
      case "list_categories":
        const categories = await this.menuService.getActiveCategories();
        return { categories };

      case "list_items":
        const allItems: MenuItem[] = input.categoryId
          ? await this.menuService.getItemsByCategory(input.categoryId)
          : await this.menuService.getMenuItems();
        // Never surface inactive/unavailable products to the customer.
        return { items: allItems.filter((item) => item.isActive && item.isAvailable) };

      case "search":
        const searchResults = await this.menuService.searchMenuItemsForCustomer(input.query || "");
        return {
          items: searchResults,
          message: searchResults.length === 0 ? "Không tìm thấy món phù hợp." : undefined,
        };

      case "get_item":
        if (!input.itemId) {
          throw new Error("Thiếu ID món ăn.");
        }
        const item = await this.menuService.getMenuItemById(input.itemId);
        if (!item || !item.isActive || !item.isAvailable) {
          return { item: null, message: "Món ăn không tồn tại hoặc không có sẵn." };
        }
        return { item };

      case "get_options":
        if (!input.itemId) {
          throw new Error("Thiếu ID món ăn.");
        }
        const options = await this.menuService.getItemOptions(input.itemId);
        return { options };

      case "list_bundles":
        const bundles = (await this.menuService.getProductBundles()).filter(
          (bundle) => bundle.isActive && bundle.isAvailable,
        );
        return { bundles };

      case "get_bundle":
        if (!input.bundleId) {
          throw new Error("Thiếu ID combo.");
        }
        const bundle = await this.menuService.getProductBundleById(input.bundleId);
        if (!bundle || !bundle.isActive || !bundle.isAvailable) {
          return { bundle: null, message: "Combo không tồn tại hoặc không có sẵn." };
        }
        return { bundle };

      case "get_item_with_options":
        if (!input.itemId) {
          throw new Error("Thiếu ID món ăn.");
        }
        const { item: menuItemData, options: menuOptionsData } =
          await this.menuService.getMenuItemWithOptions(input.itemId);
        return { item: menuItemData, options: menuOptionsData };

      case "get_bundle_with_items":
        if (!input.bundleId) {
          throw new Error("Thiếu ID combo.");
        }
        const { bundle: bundleData, items: bundleItemsData } =
          await this.menuService.getBundleWithItems(input.bundleId);
        return { bundle: bundleData, bundleItems: bundleItemsData };

      default:
        throw new Error(`Không hỗ trợ thao tác menu: ${input.operation}`);
    }
  }
}
