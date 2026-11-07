import { NextResponse } from "next/server";
import { z } from "zod";
import { createOrderSchema } from "@/lib/validation/order";
import { services } from "@/lib/agent/agent-core";
import { ApiError, customerApi, readJson } from "@/lib/server/api";
import { invalidateProposal } from "@/lib/server/invalidate-proposal";
import { readCustomer } from "@/lib/server/customer-identity";
export async function GET(request: Request) {
  return customerApi(request, async (userId) => {
    const orderId = new URL(request.url).searchParams.get("orderId");
    if (orderId) {
      const detail = await services.checkoutService.detail(userId, orderId);
      if (!detail) throw new ApiError(404, "Không tìm thấy đơn hàng.");
      return NextResponse.json(detail);
    }
    const orders = await services.orderService.getUserOrders(userId);
    return NextResponse.json({
      orders: orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    });
  });
}
export async function POST(request: Request) {
  return customerApi(request, async (userId) => {
    const input = createOrderSchema.safeParse(await readJson(request));
    if (!input.success) throw new ApiError(400, input.error.issues[0].message);
    const order = await services.checkoutService.checkout(userId, input.data, async () => {
      if ((await readCustomer()) !== userId) throw new ApiError(401, "Phiên đã hết hạn. Vui lòng tải lại trang.");
    });
    await invalidateProposal(userId);
    return NextResponse.json(
      await services.checkoutService.detail(userId, order.id),
      { status: 201 },
    );
  });
}
export async function PATCH(request: Request) {
  return customerApi(request, async (userId) => {
    const parsed = z
      .object({ orderId: z.string().min(1).max(100), confirm: z.literal(true) })
      .safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, "Vui lòng xác nhận huỷ đơn.");
    await services.checkoutService.cancel(userId, parsed.data.orderId);
    return NextResponse.json(
      await services.checkoutService.detail(userId, parsed.data.orderId),
    );
  });
}
