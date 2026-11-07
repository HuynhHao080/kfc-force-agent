import { services } from "@/lib/agent/agent-core";
export async function invalidateProposal(userId: string) {
  const session = await services.sessionService.getActiveSession(userId);
  if (!session) return;
  const saved = await services.sessionService.getConversationContext(
    session.id,
  );
  await services.sessionService.saveConversationContext({
    sessionId: session.id,
    context: {
      ...saved?.context,
      pendingActions: [],
      pendingConfirmation: null,
      pendingCartSignature: null,
    },
    updatedAt: new Date().toISOString(),
  });
}
