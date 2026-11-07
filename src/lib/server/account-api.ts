import type { CustomerAccount } from "@/lib/types/account";
import { customerAccount } from "./customer-identity";
import {
  ApiError,
  assertExpectedOwner,
  assertSameOrigin,
  errorResponse,
} from "./api";
import { withUserLock } from "./user-lock";

export async function accountApi(
  request: Request,
  operation: (account: CustomerAccount) => Promise<Response>,
): Promise<Response> {
  try {
    assertSameOrigin(request);
    const identity = await customerAccount();
    if (!identity)
      throw new ApiError(401, "Vui lòng đăng nhập tài khoản khách hàng.");
    assertExpectedOwner(request, identity.id);
    return await withUserLock(identity.id, async () => {
      // Recheck after waiting: password rotation may have invalidated this token.
      const account = await customerAccount();
      if (!account || account.id !== identity.id)
        throw new ApiError(401, "Phiên đã hết hạn. Vui lòng đăng nhập lại.");
      const response = await operation(account);
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    });
  } catch (error) {
    return errorResponse(error);
  }
}
