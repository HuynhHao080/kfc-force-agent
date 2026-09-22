import { NextResponse } from "next/server";
import { chatRequestSchema } from "@/lib/validation/chat";
import { agentCore } from "@/lib/agent/agent-core";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = chatRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const response = await agentCore(parsed.data);
    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
