import { assertCartSnapshot } from "@/lib/server/cart-snapshot";
import { NextResponse } from "next/server";
import { addCartItemSchema, updateCartItemSchema } from "@/lib/validation/cart";
import { services } from "@/lib/agent/agent-core";
import { ApiError, customerApi, readJson } from "@/lib/server/api";
import { invalidateProposal } from "@/lib/server/invalidate-proposal";
export async function GET(request: Request) {
  return customerApi(request, async (userId) =>
    NextResponse.json(
      (await services.cartService.getCartView(userId)) ?? {
        cart: null,
        items: [],
      },
    ),
  );
}
export async function POST(request: Request) {
  return customerApi(request, async (userId) => {
    const body = await readJson(request);
    const parsed = addCartItemSchema.safeParse({ ...(body as object), userId });
    if (!parsed.success)
      throw new ApiError(400, "Món hoặc số lượng không hợp lệ (tối đa 100).");
    await assertCartSnapshot(request, services.cartService, userId);
    const item = await services.menuService.getMenuItemById(
      parsed.data.menuItemId,
    );
    if (!item?.isActive || !item.isAvailable)
      throw new ApiError(404, "Món hiện không có sẵn.");
    const view = await services.cartService.addMenuItem(
      userId,
      item,
      parsed.data.quantity,
      parsed.data.options,
    );
    await invalidateProposal(userId);
    return NextResponse.json(view, { status: 201 });
  });
}
export async function PATCH(request: Request) {
  return customerApi(request, async (userId) => {
    const body = await readJson(request);
    const parsed = updateCartItemSchema.safeParse({
      ...(body as object),
      userId,
    });
    if (!parsed.success) throw new ApiError(400, "Số lượng phải từ 1 đến 100.");
    await assertCartSnapshot(request, services.cartService, userId);
    const view = await services.cartService.updateItemQuantity(
      userId,
      parsed.data.itemId,
      parsed.data.quantity,
    );
    await invalidateProposal(userId);
    return NextResponse.json(view);
  });
}
export async function DELETE(request: Request) {
  return customerApi(request, async (userId) => {
    await assertCartSnapshot(request, services.cartService, userId);
    const itemId = new URL(request.url).searchParams.get("itemId");
    const view = itemId
      ? await services.cartService.removeItem(userId, itemId)
      : await services.cartService.clearCart(userId);
    await invalidateProposal(userId);
    return NextResponse.json(view);
  });
}
