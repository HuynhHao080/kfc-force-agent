import { NextResponse } from "next/server";
import { z } from "zod";
import { customerApi, ApiError, readJson } from "@/lib/server/api";
import { services } from "@/lib/agent/agent-core";

const inputSchema = z
  .object({
    itemId: z.string().min(1).max(100),
    saved: z.boolean(),
    revision: z.string().min(1).max(100),
  })
  .strict();

export async function GET(request: Request) {
  return customerApi(request, async (userId) =>
    NextResponse.json(await services.favoritesService.view(userId)),
  );
}

export async function PUT(request: Request) {
  return customerApi(request, async (userId) => {
    const input = inputSchema.safeParse(await readJson(request));
    if (!input.success)
      throw new ApiError(400, "Thông tin món yêu thích không hợp lệ.");
    const { itemId, saved, revision } = input.data;
    return NextResponse.json(
      await services.favoritesService.set(userId, itemId, saved, revision),
    );
  });
}
