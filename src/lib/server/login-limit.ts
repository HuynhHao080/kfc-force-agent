import { DomainError } from "@/lib/domain-error";
const state = globalThis as typeof globalThis & {
  kfcLoginLimits?: Map<string, { count: number; until: number }>;
};
const limits = (state.kfcLoginLimits ??= new Map());
// Global per-role budget for the local demo; never trusts a spoofable IP header.
export function consumeLoginAttempt(
  role: "admin" | "customer" | "password-change",
  accountId?: string,
) {
  const now = Date.now();
  for (const [key, value] of limits) if (value.until <= now) limits.delete(key);
  // Password changes are authenticated: isolate their budget by trusted account ID.
  const key =
    role === "password-change" && accountId ? role + ":" + accountId : role;
  let entry = limits.get(key);
  if (!entry || entry.until <= now) {
    entry = { count: 0, until: now + 60000 };
    limits.set(key, entry);
  }
  if (++entry.count > 10)
    throw new DomainError(
      "LOGIN_LIMIT",
      "Quá nhiều lần đăng nhập. Vui lòng chờ một phút.",
      429,
    );
}
