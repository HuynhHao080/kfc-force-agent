import { NextResponse } from "next/server";
import { readCatalogRevision } from "@/lib/server/catalog-precondition";
import { adminApi, requireAdminSession } from "@/lib/server/admin-api";
import { ApiError, readJson } from "@/lib/server/api";
import { services } from "@/lib/agent/agent-core";
import {
  adminCategorySchema,
  adminCategoryUpdateSchema,
} from "@/lib/validation/admin";

export async function GET(request: Request) {
  return adminApi(request, async () =>
    NextResponse.json({
      categories: (await services.adminService.catalog()).categories,
    }),
  );
}
export async function POST(request: Request) {
  return adminApi(request, async () => {
    const parsed = adminCategorySchema.safeParse(await readJson(request));
    if (!parsed.success)
      throw new ApiError(
        400,
        "Kiểm tra tên, mô tả và thứ tự danh mục (0–999).",
      );
    return NextResponse.json(
      { category: await services.adminService.saveCategory(parsed.data, undefined, requireAdminSession) },
      { status: 201 },
    );
  });
}
export async function PATCH(request: Request) {
  return adminApi(request, async () => {
    const parsed = adminCategoryUpdateSchema.safeParse(await readJson(request));
    if (!parsed.success)
      throw new ApiError(400, "Thông tin danh mục không hợp lệ.");
    const { categoryId, ...fields } = parsed.data;
    return NextResponse.json({
      category: await services.adminService.saveCategory(fields, categoryId, requireAdminSession, readCatalogRevision(request)),
    });
  });
}
