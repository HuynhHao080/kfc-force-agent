import { NextResponse } from "next/server";
import { accountApi } from "@/lib/server/account-api";
import { ApiError, readJson } from "@/lib/server/api";
import { services } from "@/lib/agent/agent-core";
import {
  createAddressSchema,
  updateAddressSchema,
  deleteAddressSchema,
} from "@/lib/validation/address";
export async function GET(request: Request) {
  return accountApi(request, async (account) =>
    NextResponse.json(await services.addressService.book(account.id)),
  );
}
export async function POST(request: Request) {
  return accountApi(request, async (account) => {
    const input = createAddressSchema.safeParse(await readJson(request));
    if (!input.success)
      throw new ApiError(
        400,
        "Kiểm tra nhãn, người nhận, điện thoại và địa chỉ đầy đủ.",
      );
    const { revision, ...fields } = input.data;
    return NextResponse.json(
      await services.addressService.save(account.id, fields, revision),
      { status: 201 },
    );
  });
}
export async function PATCH(request: Request) {
  return accountApi(request, async (account) => {
    const input = updateAddressSchema.safeParse(await readJson(request));
    if (!input.success)
      throw new ApiError(400, "Thông tin địa chỉ không hợp lệ.");
    const { addressId, revision, ...fields } = input.data;
    return NextResponse.json(
      await services.addressService.save(
        account.id,
        fields,
        revision,
        addressId,
      ),
    );
  });
}
export async function DELETE(request: Request) {
  return accountApi(request, async (account) => {
    const input = deleteAddressSchema.safeParse(await readJson(request));
    if (!input.success)
      throw new ApiError(
        400,
        "Vui lòng xác nhận xoá đúng địa chỉ và phiên bản.",
      );
    return NextResponse.json(
      await services.addressService.remove(
        account.id,
        input.data.addressId,
        input.data.revision,
      ),
    );
  });
}
