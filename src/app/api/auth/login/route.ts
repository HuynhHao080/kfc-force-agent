import { NextResponse } from "next/server";
import { loginSchema } from "@/lib/validation/account";
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
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    consumeLoginAttempt("customer");
    const parsed = loginSchema.safeParse(await readJson(request));
    if (!parsed.success)
      throw new ApiError(400, parsed.error.issues[0].message);
    const account = await services.accountService.login(
      parsed.data.email,
      parsed.data.password,
    );
    await signInCustomer(request, account);
    return NextResponse.json(
      { profile: publicProfile(account) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
