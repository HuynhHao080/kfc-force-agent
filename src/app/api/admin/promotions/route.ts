import { NextResponse } from "next/server";
import { adminApi, requireAdminSession } from "@/lib/server/admin-api";
import { ApiError, readJson } from "@/lib/server/api";
import { services } from "@/lib/agent/agent-core";
import {
  createPromotionSchema,
  updatePromotionSchema,
} from "@/lib/validation/promotion";
export async function GET(request: Request) {
  return adminApi(request, async () =>
    NextResponse.json({ promotions: await services.promotionService.list() }),
  );
}
export async function POST(request: Request) {
  return adminApi(request, async () => {
    const input = createPromotionSchema.safeParse(await readJson(request));
    if (!input.success)
      throw new ApiError(
        400,
        "Thông tin khuyến mãi không hợp lệ. Kiểm tra mã, số tiền, phần trăm và thời gian.",
      );
    return NextResponse.json(await services.promotionService.save(input.data, undefined, requireAdminSession), {
      status: 201,
    });
  });
}
export async function PATCH(request: Request) {
  return adminApi(request, async () => {
    const input = updatePromotionSchema.safeParse(await readJson(request));
    if (!input.success)
      throw new ApiError(
        400,
        "Thông tin khuyến mãi hoặc phiên bản không hợp lệ.",
      );
    const { revision, ...fields } = input.data;
    return NextResponse.json(
      await services.promotionService.save(fields, revision, requireAdminSession),
    );
  });
}
