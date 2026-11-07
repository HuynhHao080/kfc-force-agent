import { NextResponse } from "next/server";
import { services } from "@/lib/agent/agent-core";
import { adminApi, requireAdminSession } from "@/lib/server/admin-api";
import { ApiError, readJson } from "@/lib/server/api";
import { updateShopSchema } from "@/lib/validation/shop";
export async function GET(request: Request) {
  return adminApi(request, async () => NextResponse.json(await services.shopService.view()));
}
export async function PATCH(request: Request) {
  return adminApi(request, async () => {
    const input = updateShopSchema.safeParse(await readJson(request));
    if (!input.success) throw new ApiError(400, input.error.issues[0]?.message ?? "Cấu hình cửa hàng chưa hợp lệ.");
    return NextResponse.json(await services.shopService.save(input.data, requireAdminSession));
  });
}
