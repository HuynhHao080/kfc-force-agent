import { NextResponse } from "next/server";
import { menuQuerySchema } from "@/lib/validation/menu";
import { services } from "@/lib/agent/agent-core";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const body = Object.fromEntries(searchParams.entries());
    const parsed = menuQuerySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const query = parsed.data;

    // Handle specific item lookup
    if (query.itemId) {
      const item = await services.menuService.getMenuItemById(query.itemId);
      if (!item) {
        return NextResponse.json(
          { error: "Món ăn không tồn tại", details: { itemId: query.itemId } },
          { status: 404 },
        );
      }
      return NextResponse.json({ item });
    }

    // Handle bundle lookup
    if (query.bundleId) {
      const bundle = await services.menuService.getProductBundleById(query.bundleId);
      if (!bundle) {
        return NextResponse.json(
          { error: "Combo không tồn tại", details: { bundleId: query.bundleId } },
          { status: 404 },
        );
      }
      return NextResponse.json({ bundle });
    }

    // Handle category-specific items
    if (query.categoryId) {
      const items = await services.menuService.getItemsByCategory(query.categoryId);
      return NextResponse.json({ items });
    }

    // Handle search query
    if (query.q) {
      const items = await services.menuService.searchMenuItems(query.q);
      return NextResponse.json({
        items,
        count: items.length,
        query: query.q,
      });
    }

    // Default: return categories and available items
    const categories = await services.menuService.getCategories();
    const availableItems = await services.menuService.getAvailableMenuItems();

    return NextResponse.json({
      categories,
      items: availableItems,
      count: availableItems.length,
    });
  } catch (error) {
    console.error("Menu API error:", error);
    return NextResponse.json({ error: "Lỗi máy chủ khi xử lý yêu cầu menu" }, { status: 500 });
  }
}
