import { NextResponse } from "next/server";
import { addCartItemSchema, updateCartItemSchema } from "@/lib/validation/cart";
import { services } from "@/lib/agent/agent-core";
import { CartDomainError } from "@/lib/services/cart-service";

function toErrorResponse(error: unknown) {
  if (error instanceof CartDomainError) {
    const status =
      error.code === "CART_NOT_FOUND" || error.code === "CART_ITEM_NOT_FOUND"
        ? 404
        : error.code === "CART_FORBIDDEN"
          ? 403
          : 400;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }
  console.error("Cart API error:", error);
  return NextResponse.json({ error: "Lỗi máy chủ khi xử lý giỏ hàng" }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "Thiếu userId" }, { status: 400 });
    }

    // Read-only: an empty cart is reported as empty, not as an error.
    const view = await services.cartService.getCartView(userId);
    if (!view) {
      return NextResponse.json({ cart: null, items: [] });
    }
    return NextResponse.json(view);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = addCartItemSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Yêu cầu không hợp lệ",
          details: parsed.error.issues.map((issue) => ({
            field: issue.path.join(".") || "root",
            message: issue.message,
          })),
        },
        { status: 400 },
      );
    }

    // The authoritative price, availability and name come from the menu.
    const menuItem = await services.menuService.getMenuItemById(parsed.data.menuItemId);
    if (!menuItem || !menuItem.isActive || !menuItem.isAvailable) {
      return NextResponse.json(
        { error: "Món ăn không tồn tại hoặc không có sẵn", code: "ITEM_UNAVAILABLE" },
        { status: 404 },
      );
    }

    const view = await services.cartService.addMenuItem(
      parsed.data.userId,
      menuItem,
      parsed.data.quantity,
      parsed.data.options ?? {},
    );
    return NextResponse.json(view, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const parsed = updateCartItemSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Yêu cầu không hợp lệ",
          details: parsed.error.issues.map((issue) => ({
            field: issue.path.join(".") || "root",
            message: issue.message,
          })),
        },
        { status: 400 },
      );
    }

    const view = await services.cartService.updateItemQuantity(
      parsed.data.userId,
      parsed.data.itemId,
      parsed.data.quantity,
    );
    return NextResponse.json(view);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const itemId = searchParams.get("itemId");

    if (!userId || !itemId) {
      return NextResponse.json({ error: "Thiếu userId và itemId" }, { status: 400 });
    }

    const view = await services.cartService.removeItem(userId, itemId);
    return NextResponse.json(view);
  } catch (error) {
    return toErrorResponse(error);
  }
}

