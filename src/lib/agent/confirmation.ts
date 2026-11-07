import { z } from "zod";
export const CONFIRMATION_TTL_MS = 15 * 60 * 1000;
export const PendingConfirmationSchema = z.object({
  id: z.string().uuid(),
  expiresAt: z.string().datetime(),
  summary: z.array(z.string()).min(1),
});
export type PendingConfirmation = z.infer<typeof PendingConfirmationSchema>;
export function activeConfirmation(
  context?: Record<string, unknown>,
  now = Date.now(),
): PendingConfirmation | null {
  const parsed = PendingConfirmationSchema.safeParse(
    context?.pendingConfirmation,
  );
  return parsed.success &&
    Date.parse(parsed.data.expiresAt) > now &&
    Array.isArray(context?.pendingActions) &&
    context.pendingActions.length > 0
    ? parsed.data
    : null;
}
