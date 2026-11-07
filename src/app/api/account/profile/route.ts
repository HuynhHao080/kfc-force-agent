import { NextResponse } from "next/server";
import { accountApi } from "@/lib/server/account-api";
import { ApiError, readJson } from "@/lib/server/api";
import { services } from "@/lib/agent/agent-core";
import { profileSchema } from "@/lib/validation/account";

export async function PATCH(request: Request) {
  return accountApi(request, async (account) => {
    const parsed = profileSchema.safeParse(await readJson(request));
    if (!parsed.success)
      throw new ApiError(400, parsed.error.issues[0].message);
    return NextResponse.json({
      profile: await services.accountService.updateProfile(
        account,
        parsed.data.fullName,
      ),
    });
  });
}
