import { activeConfirmation } from "@/lib/agent/confirmation";
import { NextResponse } from "next/server";
import { ensureCustomer } from "@/lib/server/customer-identity";
import { services } from "@/lib/agent/agent-core";
import { withUserLock } from "@/lib/server/user-lock";
export async function GET(request: Request) {
  const { userId, profile } = await ensureCustomer(request);
  return withUserLock(userId, async () => {
    const session = await services.sessionService.getActiveSession(userId);
    const saved = session
      ? await services.sessionService.getConversationContext(session.id)
      : null;
    return NextResponse.json(
      {
        profile,
        messages: session
          ? (await services.sessionService.getMessages(session.id)).slice(-50)
          : [],
        requiresConfirmation: !!activeConfirmation(saved?.context),
        pendingConfirmation: activeConfirmation(saved?.context),
        demo: true,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  });
}
