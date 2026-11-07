import { NextResponse } from "next/server";
import {
  ensureCustomer,
  customerAccount,
} from "@/lib/server/customer-identity";
import { ApiError, errorResponse } from "@/lib/server/api";
import { withUserLock } from "@/lib/server/user-lock";
import { activeConfirmation } from "@/lib/agent/confirmation";
import { services } from "@/lib/agent/agent-core";

export async function GET(request: Request) {
  try {
    const { userId, profile } = await ensureCustomer(request);
    return await withUserLock(userId, async () => {
      if (profile && (await customerAccount())?.id !== userId)
        throw new ApiError(401, "Phiên đã hết hạn. Vui lòng tải lại trang.");
      const id = new URL(request.url).searchParams.get("orderId");
      if (id && id.length > 100)
        throw new ApiError(400, "Mã đơn không hợp lệ.");
      const session = await services.sessionService.getActiveSession(userId);
      const saved = session
        ? await services.sessionService.getConversationContext(session.id)
        : null;
      const [basket, orders, categories, items, messages, detail, addressBook] =
        await Promise.all([
          services.cartService.getCartView(userId),
          services.orderService.getUserOrders(userId),
          services.menuService.getActiveCategories(),
          services.menuService.getAvailableMenuItems(),
          session
            ? services.sessionService.getMessages(session.id)
            : Promise.resolve([]),
          id
            ? services.checkoutService.detail(userId, id)
            : Promise.resolve(null),
          profile
            ? services.addressService.book(userId)
            : Promise.resolve(null),
        ]);
      const pending = activeConfirmation(saved?.context);
      return NextResponse.json(
        {
          shop: await services.shopService.view(),
          ownerId: userId,
          addressBook,
          session: {
            profile,
            messages: messages.slice(-50),
            requiresConfirmation: !!pending,
            pendingConfirmation: pending,
          },
          basket,
          menu: { categories, items },
          history: {
            orders: orders.sort((a, b) =>
              b.createdAt.localeCompare(a.createdAt),
            ),
          },
          detail,
        },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    });
  } catch (error) {
    return errorResponse(error);
  }
}
