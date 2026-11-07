import { activeConfirmation } from "@/lib/agent/confirmation";
import { NextResponse } from "next/server";
import { chatRequestSchema } from "@/lib/validation/chat";
import { services } from "@/lib/agent/agent-core";
import { ApiError, customerApi, readJson } from "@/lib/server/api";
import { invalidateProposal } from "@/lib/server/invalidate-proposal";
export async function POST(request: Request) {
  return customerApi(request, async (userId) => {
    const body = await readJson(request);
    const parsed = chatRequestSchema.safeParse({
      ...(body as object),
      userId,
      sessionId: `chat_${userId}`,
      platform: "web",
    });
    if (!parsed.success)
      throw new ApiError(400, parsed.error.issues[0].message);
    return NextResponse.json(
      await services.chatService.processChat(parsed.data),
    );
  });
}
export async function DELETE(request: Request) {
  return customerApi(request, async (userId) => {
    const session = await services.sessionService.getActiveSession(userId);
    const saved = session
      ? await services.sessionService.getConversationContext(session.id)
      : null;
    const pending = activeConfirmation(saved?.context);
    if (
      pending &&
      new URL(request.url).searchParams.get("confirmationId") !== pending.id
    ) {
      throw new ApiError(
        409,
        "Đề xuất đã thay đổi. Vui lòng xem lại trước khi bỏ qua.",
      );
    }
    await invalidateProposal(userId);
    return NextResponse.json({
      requiresConfirmation: false,
      pendingConfirmation: null,
    });
  });
}
