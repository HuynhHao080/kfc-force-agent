import { NextResponse } from "next/server";
import { adminApi } from "@/lib/server/admin-api";
import { services } from "@/lib/agent/agent-core";
export async function GET(request: Request) {
  return adminApi(request, async () =>
    NextResponse.json({
      entries: await services.adminService.catalogHistory(),
      limit: 200,
    }),
  );
}
