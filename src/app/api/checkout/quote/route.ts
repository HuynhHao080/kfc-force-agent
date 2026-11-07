import { NextResponse } from "next/server";
import { customerApi, ApiError, readJson } from "@/lib/server/api";
import { services } from "@/lib/agent/agent-core";
import { checkoutQuoteSchema } from "@/lib/validation/promotion";
export async function POST(request: Request) {
  return customerApi(request, async (userId) => {
    const input = checkoutQuoteSchema.safeParse(await readJson(request));
    if (!input.success)
      throw new ApiError(400, "Thông tin giỏ hoặc mã giảm giá không hợp lệ.");
    return NextResponse.json(
      await services.checkoutService.quote(userId, input.data),
    );
  });
}
