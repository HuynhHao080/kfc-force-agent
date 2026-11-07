import { NextResponse } from "next/server";
import { registerSchema } from "@/lib/validation/account";
import { services } from "@/lib/agent/agent-core";
import { publicProfile } from "@/lib/services/account-service";
import {
  assertSameOrigin,
  readJson,
  ApiError,
  errorResponse,
} from "@/lib/server/api";
import { signInCustomer } from "@/lib/server/customer-identity";
import { consumeLoginAttempt } from "@/lib/server/login-limit";
import { withUserLock } from "@/lib/server/user-lock";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    consumeLoginAttempt("customer");
    const parsed = registerSchema.safeParse(await readJson(request));
    if (!parsed.success)
      throw new ApiError(400, parsed.error.issues[0].message);
    const account = await withUserLock("__accounts__", () =>
      services.accountService.register(parsed.data),
    );
    await signInCustomer(request, account);
    return NextResponse.json(
      { profile: publicProfile(account) },
      { status: 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
