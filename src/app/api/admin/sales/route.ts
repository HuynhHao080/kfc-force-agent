import { NextResponse } from "next/server";
import { adminApi } from "@/lib/server/admin-api";
import { ApiError } from "@/lib/server/api";
import { invalidDateRange } from "@/lib/order-reporting";
import { salesFiltersSchema } from "@/lib/validation/sales";
import { services } from "@/lib/agent/agent-core";
import { z } from "zod";
const requestSchema = salesFiltersSchema.extend({
  basisRevision: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
});
export async function GET(request: Request) {
  return adminApi(request, async () => {
    const params = new URL(request.url).searchParams;
    if (new Set(params.keys()).size !== [...params.keys()].length)
      throw new ApiError(400, "Bộ lọc bị lặp.");
    const input = requestSchema.safeParse(Object.fromEntries(params));
    if (!input.success || invalidDateRange(input.data))
      throw new ApiError(400, "Bộ lọc báo cáo không hợp lệ.");
    const { basisRevision, ...filters } = input.data;
    return NextResponse.json(
      await services.adminService.sales(filters, basisRevision),
    );
  });
}
