import { NextResponse } from "next/server";
import { z } from "zod";
import { services } from "@/lib/agent/agent-core";
import { ApiError, customerApi, readJson } from "@/lib/server/api";

const attemptSchema = z.object({
  idempotencyKey: z.string().uuid(),
  cartId: z.string().min(1).max(128),
}).strict();

// POST keeps the opaque request key out of URLs. This operation only reads;
// the customer lock places it after any pending checkout for the same owner.
export async function POST(request: Request) {
  return customerApi(request, async (userId) => {
    const input = attemptSchema.safeParse(await readJson(request));
    if (!input.success) throw new ApiError(400, "Thông tin yêu cầu đặt đơn không hợp lệ.");
    return NextResponse.json({
      order: await services.checkoutService.findAttempt(userId, input.data),
    });
  });
}
