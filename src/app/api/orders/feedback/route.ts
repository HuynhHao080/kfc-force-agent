import { NextResponse } from "next/server";
import { services } from "@/lib/agent/agent-core";
import { ApiError, customerApi, readJson } from "@/lib/server/api";
import { customerFeedbackSchema, feedbackOrderId } from "@/lib/validation/feedback";
export async function GET(request: Request) {
  return customerApi(request, async userId => {
    const params = new URL(request.url).searchParams, parsed = feedbackOrderId.safeParse(params.get("orderId"));
    if (!parsed.success || [...params.keys()].some(key => key !== "orderId") || params.getAll("orderId").length !== 1)
      throw new ApiError(400, "Mã đơn không hợp lệ.");
    return NextResponse.json(await services.feedbackService.view(userId, parsed.data));
  });
}
export async function POST(request: Request) {
  return customerApi(request, async userId => {
    const input = customerFeedbackSchema.safeParse(await readJson(request));
    if (!input.success) throw new ApiError(400, "Chọn điểm 1–5 và nhận xét tối đa 1.000 ký tự.");
    return NextResponse.json(await services.feedbackService.save(userId, input.data));
  });
}
