import { NextResponse } from "next/server";
import { services } from "@/lib/agent/agent-core";
import { adminApi, requireAdminSession } from "@/lib/server/admin-api";
import { ApiError, readJson } from "@/lib/server/api";
import { withUserLock } from "@/lib/server/user-lock";
import { feedbackFiltersSchema, feedbackReplySchema } from "@/lib/validation/feedback";
export async function GET(request: Request) {
  return adminApi(request, async () => {
    const params = new URL(request.url).searchParams;
    if (new Set(params.keys()).size !== [...params.keys()].length) throw new ApiError(400, "Bộ lọc bị lặp.");
    const input = feedbackFiltersSchema.safeParse(Object.fromEntries(params));
    if (!input.success) throw new ApiError(400, "Bộ lọc đánh giá chưa hợp lệ.");
    return NextResponse.json(await services.feedbackService.inbox(input.data));
  });
}
export async function POST(request: Request) {
  return adminApi(request, async () => {
    const input = feedbackReplySchema.safeParse(await readJson(request));
    if (!input.success) throw new ApiError(400, "Phản hồi cần 5–1.000 ký tự và phiên bản đánh giá hiện tại.");
    const order = await services.adminService.detail(input.data.orderId);
    return withUserLock(order.userId, async () => {
      await requireAdminSession();
      return NextResponse.json(await services.feedbackService.reply(input.data));
    });
  });
}
