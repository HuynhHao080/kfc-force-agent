import { NextResponse } from "next/server";
import { z } from "zod";
import { adminApi, requireAdminSession } from "@/lib/server/admin-api";
import { ApiError, readJson } from "@/lib/server/api";
import { services } from "@/lib/agent/agent-core";
import { withUserLock } from "@/lib/server/user-lock";
import { readWhatsAppConfig } from "@/lib/channels/whatsapp/config";
import { localWhatsAppRuntime } from "@/lib/channels/whatsapp/local-runtime";

/**
 * Hội thoại WhatsApp cho nhân viên (issue #16, giai đoạn 6): danh sách, lịch sử, tiếp quản / trả lại AI, nhắn khách.
 * Repo có một tài khoản quản trị nên mã nhân viên là "admin". Khoá theo khách giống worker, nên tiếp quản không
 * chen giữa một lượt AI đang xử lý.
 */
const STAFF_ID = "admin";
const customerId = z.string().regex(/^wa_[0-9a-f]{32}$/, "Mã hội thoại không hợp lệ.");
const handoffSchema = z.object({ customerId, action: z.enum(["takeover", "release"]), expectedRevision: z.string().uuid() }).strict();
const messageSchema = z.object({ customerId, message: z.string().trim().min(1, "Vui lòng nhập tin nhắn.").max(1000, "Tin nhắn tối đa 1000 ký tự.") }).strict();

export async function GET(request: Request) {
  return adminApi(request, async () => {
    const id = new URL(request.url).searchParams.get("customerId");
    if (!id) return NextResponse.json({ conversations: await services.channelStaffService.list(50) });
    const parsed = customerId.safeParse(id);
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);
    return NextResponse.json(await services.channelStaffService.detail(parsed.data));
  });
}

export async function PATCH(request: Request) {
  return adminApi(request, async () => {
    const input = handoffSchema.safeParse(await readJson(request));
    if (!input.success) throw new ApiError(400, input.error.issues[0]?.message ?? "Yêu cầu không hợp lệ.");
    const { customerId: id, action, expectedRevision } = input.data;
    return withUserLock(id, async () => {
      await requireAdminSession();
      const conversation = action === "takeover"
        ? await services.channelStaffService.takeOver(id, STAFF_ID, expectedRevision)
        : await services.channelStaffService.release(id, STAFF_ID, expectedRevision);
      return NextResponse.json({ conversation });
    });
  });
}

export async function POST(request: Request) {
  return adminApi(request, async () => {
    const input = messageSchema.safeParse(await readJson(request));
    if (!input.success) throw new ApiError(400, input.error.issues[0]?.message ?? "Yêu cầu không hợp lệ.");
    return withUserLock(input.data.customerId, async () => {
      await requireAdminSession();
      const sender = localWhatsAppRuntime(readWhatsAppConfig())?.sender ?? null;
      const conversation = await services.channelStaffService.send(input.data.customerId, STAFF_ID, input.data.message, sender);
      return NextResponse.json({ conversation });
    });
  });
}
