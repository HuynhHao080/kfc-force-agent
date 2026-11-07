import { NextResponse } from "next/server";
import {
  adminAuthenticated,
  adminConfigured,
  loginAdmin,
  logoutAdmin,
} from "@/lib/server/admin-session";
import {
  ApiError,
  assertSameOrigin,
  errorResponse,
  readJson,
} from "@/lib/server/api";
import { consumeLoginAttempt } from "@/lib/server/login-limit";
import { adminLoginSchema } from "@/lib/validation/admin";
const headers = { "Cache-Control": "private, no-store" };
export async function GET() {
  try {
    return NextResponse.json(
      {
        configured: adminConfigured(),
        authenticated: await adminAuthenticated(),
      },
      { headers },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    consumeLoginAttempt("admin");
    const parsed = adminLoginSchema.safeParse(await readJson(request));
    if (!parsed.success)
      throw new ApiError(400, "Vui lòng nhập mật khẩu quản trị.");
    await loginAdmin(request, parsed.data.password);
    return NextResponse.json({ authenticated: true }, { headers });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    await logoutAdmin();
    return NextResponse.json({ authenticated: false }, { headers });
  } catch (error) {
    return errorResponse(error);
  }
}
