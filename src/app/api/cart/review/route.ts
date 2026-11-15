import { NextResponse } from "next/server";
import { services } from "@/lib/agent/agent-core";
import { ApiError, customerApi } from "@/lib/server/api";
import { assertCartSnapshot } from "@/lib/server/cart-snapshot";
import { withUserLock } from "@/lib/server/user-lock";
import { SHOP_ORDER_GATE } from "@/lib/services/shop-service";
import { buildCartReview } from "@/lib/cart-review";

export async function POST(request: Request) {
  return customerApi(request, (userId) =>
    withUserLock(SHOP_ORDER_GATE, async () => {
      await assertCartSnapshot(request, services.cartService, userId);
      const basket = await services.cartService.getCartView(userId);
      if (!basket?.items.length)
        throw new ApiError(
          400,
          "Hãy chọn món trước khi kiểm tra danh sách mua.",
        );
      return NextResponse.json(
        buildCartReview(basket, await services.menuService.getMenuItems()),
      );
    }),
  );
}
