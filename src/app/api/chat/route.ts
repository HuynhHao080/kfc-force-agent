import { NextResponse } from "next/server";
import { chatRequestSchema } from "@/lib/validation/chat";
import { services } from "@/lib/agent/agent-core";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Yêu cầu không phải JSON hợp lệ" }, { status: 400 });
  }

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Yêu cầu không hợp lệ",
        details: parsed.error.issues.map((issue) => ({
          field: issue.path.join(".") || "root",
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  try {
    const response = await services.chatService.processChat(parsed.data);
    return NextResponse.json(response);
  } catch (error) {
    // Controlled failure: return a structured, actionable payload rather than
    // a bare 500, and never leak the stack trace to the client.
    console.error("Chat API error:", error);
    return NextResponse.json(
      {
        error: "Đã xảy ra lỗi khi xử lý yêu cầu. Vui lòng thử lại.",
        sessionId: parsed.data.sessionId,
      },
      { status: 500 },
    );
  }
}

