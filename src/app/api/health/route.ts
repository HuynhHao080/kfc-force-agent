import { NextResponse } from "next/server";
import { resolvePersistenceDriver } from "@/lib/db/repositories/repositories";
import { kfcPurchaseAssistantEnabled } from "@/lib/purchase-mode";
export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "KFC Force Agent",
      version: "0.2.0",
      phase: kfcPurchaseAssistantEnabled() ? "purchase-assistant" : "graduation-demo",
      mode: kfcPurchaseAssistantEnabled() ? "kfc-assistant" : "demo",
      aiProvider: (process.env.AI_PROVIDER || "mock").toLowerCase(),
      persistence: resolvePersistenceDriver(),
      cloudVerified: false,
      paymentsEnabled: false,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
