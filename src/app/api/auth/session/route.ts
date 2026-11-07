import { NextResponse } from "next/server";
import {
  customerAccount,
  signOutCustomer,
  readCustomer,
} from "@/lib/server/customer-identity";
import { publicProfile } from "@/lib/services/account-service";
import {
  assertExpectedOwner,
  assertSameOrigin,
  errorResponse,
} from "@/lib/server/api";
export async function GET() {
  const account = await customerAccount();
  return NextResponse.json(
    { profile: account ? publicProfile(account) : null },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    assertExpectedOwner(request, await readCustomer());
    await signOutCustomer();
    return NextResponse.json(
      { profile: null },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
