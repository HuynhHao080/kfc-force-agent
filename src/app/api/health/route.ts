import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "KFC Force Agent",
    version: "0.1.0",
    phase: "foundation",
  });
}
