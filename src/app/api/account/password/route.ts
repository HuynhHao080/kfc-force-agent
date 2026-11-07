import { NextResponse } from "next/server";
import { accountApi } from "@/lib/server/account-api";
import { ApiError, readJson } from "@/lib/server/api";
import { clearCustomerCookie } from "@/lib/server/customer-identity";
import { services } from "@/lib/agent/agent-core";
import { passwordChangeSchema } from "@/lib/validation/account";
import { consumeLoginAttempt } from "@/lib/server/login-limit";

export async function POST(request: Request) {
  return accountApi(request, async (account) => {
    consumeLoginAttempt("password-change", account.id);
    const parsed = passwordChangeSchema.safeParse(await readJson(request));
    if (!parsed.success)
      throw new ApiError(400, parsed.error.issues[0].message);
    await services.accountService.changePassword(
      account,
      parsed.data.currentPassword,
      parsed.data.newPassword,
    );
    // Version revocation is committed with the password; no second database write.
    await clearCustomerCookie();
    return NextResponse.json({ reauthenticate: true });
  });
}
