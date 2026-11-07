import { adminAuthenticated } from "./admin-session";
import { ApiError, assertSameOrigin, errorResponse } from "./api";
import { withUserLock } from "./user-lock";
export async function requireAdminSession() {
  if (!(await adminAuthenticated()))
    throw new ApiError(401, "Phiên quản trị đã hết hạn. Vui lòng đăng nhập lại.");
}
export async function adminApi(
  request: Request,
  operation: () => Promise<Response>,
): Promise<Response> {
  try {
    assertSameOrigin(request);
    if (!(await adminAuthenticated()))
      throw new ApiError(401, "Vui lòng đăng nhập quản trị.");
    const response = await withUserLock("__admin__", async () => {
      if (!(await adminAuthenticated()))
        throw new ApiError(
          401,
          "Phiên quản trị đã hết hạn. Vui lòng đăng nhập lại.",
        );
      return operation();
    });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
