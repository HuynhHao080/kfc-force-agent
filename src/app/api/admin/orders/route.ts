import { NextResponse } from "next/server";
import { adminApi, requireAdminSession } from "@/lib/server/admin-api";
import { ApiError, readJson } from "@/lib/server/api";
import { services } from "@/lib/agent/agent-core";
import { orderTransitionSchema } from "@/lib/validation/admin";
import { withUserLock } from "@/lib/server/user-lock";
export async function GET(request: Request) {
  return adminApi(request, async () => {
    const id = new URL(request.url).searchParams.get("orderId");
    return NextResponse.json(
      id
        ? await services.adminService.detail(id)
        : await services.adminService.dashboard(),
    );
  });
}
export async function PATCH(request: Request) {
  return adminApi(request, async () => {
    const input = orderTransitionSchema.safeParse(await readJson(request));
    if (!input.success)
      throw new ApiError(400, input.error.issues[0]?.message ?? "Trạng thái hoặc mã đơn không hợp lệ.");
    const order = await services.adminService.detail(input.data.orderId);
    // Same lock as customer cancellation, plus repository compare-and-set.
    return withUserLock(order.userId, async () => {
      await requireAdminSession();
      return NextResponse.json(
        await services.adminService.transition(
          input.data.orderId,
          input.data.expectedStatus,
          input.data.nextStatus,
          input.data.cancellationReason,
        ),
      );
    });
  });
}
