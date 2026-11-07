import { NextResponse } from "next/server";
import { services } from "@/lib/agent/agent-core";
import { errorResponse } from "@/lib/server/api";
export async function GET() {
  try { return NextResponse.json(await services.shopService.view(), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return errorResponse(error); }
}
