import { NextResponse } from "next/server";
import { z } from "zod";
import { adminApi } from "@/lib/server/admin-api";
import { ApiError } from "@/lib/server/api";
import { services } from "@/lib/agent/agent-core";

const filters = z.object({ fulfillment: z.enum(["all", "pickup", "delivery"]).default("all") }).strict();
export async function GET(request: Request) {
  return adminApi(request, async () => {
    const params = new URL(request.url).searchParams;
    if (new Set(params.keys()).size !== [...params.keys()].length) throw new ApiError(400, "Bộ lọc bị lặp.");
    const input = filters.safeParse(Object.fromEntries(params));
    if (!input.success) throw new ApiError(400, "Bộ lọc bếp không hợp lệ.");
    return NextResponse.json(await services.adminService.kitchen(input.data.fulfillment));
  });
}
