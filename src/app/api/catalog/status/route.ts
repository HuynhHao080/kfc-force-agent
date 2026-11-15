import { NextResponse } from "next/server";
import { catalogRefreshStatus } from "@/lib/catalog/catalog-refresh";
import { services } from "@/lib/agent/agent-core";
import { catalogFingerprint } from "@/lib/catalog/catalog-fingerprint";

export async function GET() {
  const [categories, items] = await Promise.all([
    services.menuService.getActiveCategories(),
    services.menuService.getAvailableMenuItems(),
  ]);
  return NextResponse.json(
    {
      ...catalogRefreshStatus(),
      version: catalogFingerprint({ categories, items }),
    },
    { headers: { "Cache-Control": "public, max-age=30" } },
  );
}
