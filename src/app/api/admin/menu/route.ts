import { NextResponse } from "next/server";
import { readCatalogRevision } from "@/lib/server/catalog-precondition";
import { adminApi, requireAdminSession } from "@/lib/server/admin-api";
import { ApiError, readJson } from "@/lib/server/api";
import { services } from "@/lib/agent/agent-core";
import { adminMenuSchema, adminMenuUpdateSchema } from "@/lib/validation/admin";
export async function GET(request: Request) {
  return adminApi(request, async () =>
    NextResponse.json(await services.adminService.catalog()),
  );
}
export async function POST(request: Request) {
  return adminApi(request, async () => {
    const input = adminMenuSchema.safeParse(await readJson(request));
    if (!input.success)
      throw new ApiError(
        400,
        "Kiểm tra tên món, danh mục và giá (1.000–5.000.000đ).",
      );
    return NextResponse.json(
      { item: await services.adminService.saveMenu(input.data, undefined, requireAdminSession) },
      { status: 201 },
    );
  });
}
export async function PATCH(request: Request) {
  return adminApi(request, async () => {
    const input = adminMenuUpdateSchema.safeParse(await readJson(request));
    if (!input.success) throw new ApiError(400, "Thông tin món không hợp lệ.");
    const { itemId, ...fields } = input.data;
    return NextResponse.json({
      item: await services.adminService.saveMenu(fields, itemId, requireAdminSession, readCatalogRevision(request)),
    });
  });
}
