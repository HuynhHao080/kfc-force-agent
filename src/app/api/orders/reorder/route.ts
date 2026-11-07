import { NextResponse } from "next/server";
import { customerApi, ApiError, readJson } from "@/lib/server/api";
import { invalidateProposal } from "@/lib/server/invalidate-proposal";
import { services } from "@/lib/agent/agent-core";
import {
  previewReorderSchema,
  confirmReorderSchema,
} from "@/lib/validation/reorder";
export async function POST(request: Request) {
  return customerApi(request, async (userId) => {
    const input = previewReorderSchema.safeParse(await readJson(request));
    if (!input.success) throw new ApiError(400, "Mã đơn đặt lại không hợp lệ.");
    return NextResponse.json(
      await services.reorderService.preview(userId, input.data.orderId),
    );
  });
}
export async function PUT(request: Request) {
  return customerApi(request, async (userId) => {
    const input = confirmReorderSchema.safeParse(await readJson(request));
    if (!input.success)
      throw new ApiError(400, "Vui lòng xác nhận đúng bản xem trước đặt lại.");
    const result = await services.reorderService.confirm(
      userId,
      input.data.confirmationToken,
    );
    if (!result.replayed) await invalidateProposal(userId);
    return NextResponse.json(result);
  });
}
