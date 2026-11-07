import { NextResponse } from "next/server";
import { readCustomer } from "./customer-identity";
import { withUserLock } from "./user-lock";
import { DomainError } from "@/lib/domain-error";
import { readBoundedJson } from "./bounded-json";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function readJson(request: Request): Promise<unknown> {
  return readBoundedJson(request);
}
export async function customerApi(
  request: Request,
  operation: (userId: string) => Promise<Response>,
): Promise<Response> {
  try {
    assertSameOrigin(request);
    const userId = await readCustomer();
    if (!userId)
      throw new ApiError(401, "Phiên đã hết hạn. Vui lòng tải lại trang.");
    assertExpectedOwner(request, userId);
    const response = await withUserLock(userId, async () => {
      if ((await readCustomer()) !== userId)
        throw new ApiError(401, "Phiên đã hết hạn. Vui lòng tải lại trang.");
      return operation(userId);
    });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
export function assertExpectedOwner(request: Request, userId: string | null) {
  const expected = request.headers.get("x-kfc-owner");
  if (expected && expected !== userId)
    throw new DomainError(
      "IDENTITY_CHANGED",
      "Phiên hiển thị đã thay đổi. Vui lòng xem lại dữ liệu trước khi thao tác.",
      409,
    );
}
export function assertSameOrigin(request: Request) {
  if (request.method !== "GET") {
    const origin = request.headers.get("origin");
    // Next may normalize request.url's hostname to localhost on loopback.
    // Host is the browser's actual destination; do not trust forwarded-host.
    const target = new URL(request.url);
    const host = request.headers.get("host");
    const expectedOrigin = host ? target.protocol + "//" + host : target.origin;
    if (
      (origin && origin !== expectedOrigin) ||
      request.headers.get("sec-fetch-site") === "cross-site"
    ) {
      throw new ApiError(403, "Yêu cầu từ trang khác không được phép.");
    }
  }
}
export function errorResponse(error: unknown): Response {
  const headers = { "Cache-Control": "private, no-store" };
  if (error instanceof ApiError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status, headers },
    );
  if (error instanceof DomainError)
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status, headers },
    );
  console.error("API operation failed:", error);
  return NextResponse.json(
    { error: "Không thể xử lý yêu cầu. Vui lòng thử lại." },
    { status: 500, headers },
  );
}
