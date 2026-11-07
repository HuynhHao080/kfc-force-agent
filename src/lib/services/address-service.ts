import { randomUUID } from "node:crypto";
import type { UserRepository } from "@/lib/db/repositories/interfaces/user-repository.interface";
import type { Address } from "@/lib/types/user";
import type { AddressBook } from "@/lib/types/address-book";
import type { z } from "zod";
import type { addressFieldsSchema } from "@/lib/validation/address";
import { addressRevision } from "@/lib/server/address-revision";
import { DomainError } from "@/lib/domain-error";
type Fields = z.infer<typeof addressFieldsSchema>;
export class AddressService {
  constructor(private users: UserRepository) {}
  async book(userId: string): Promise<AddressBook> {
    const addresses = await this.users.getUserAddresses(userId);
    return { addresses, revision: addressRevision(userId, addresses) };
  }
  private async current(userId: string, revision: string) {
    const book = await this.book(userId);
    if (revision !== book.revision)
      throw new DomainError(
        "ADDRESS_BOOK_CHANGED",
        "Sổ địa chỉ đã thay đổi. Vui lòng làm mới trước khi lưu.",
        409,
      );
    return book.addresses;
  }
  private async commit(
    userId: string,
    addresses: Address[],
    expected: string,
    preferred?: string,
  ) {
    const oldest = [...addresses].sort(
      (a, b) =>
        a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
    );
    const defaultId =
      preferred ??
      addresses.find((entry) => entry.isDefault)?.id ??
      oldest[0]?.id;
    const updated = addresses.map((entry) => ({
      ...entry,
      isDefault: entry.id === defaultId,
    }));
    await this.users.saveUserAddresses(userId, updated, expected);
    return { addresses: updated, revision: addressRevision(userId, updated) };
  }
  async save(
    userId: string,
    fields: Fields,
    revision: string,
    id?: string,
  ): Promise<AddressBook> {
    const addresses = await this.current(userId, revision);
    const previous = id ? addresses.find((entry) => entry.id === id) : null;
    if (id && !previous)
      throw new DomainError(
        "ADDRESS_NOT_FOUND",
        "Không tìm thấy địa chỉ.",
        404,
      );
    if (!id && addresses.length >= 5)
      throw new DomainError(
        "ADDRESS_LIMIT",
        "Mỗi tài khoản lưu tối đa 5 địa chỉ.",
      );
    const now = new Date().toISOString();
    const entry: Address = {
      ...fields,
      id: previous?.id ?? "addr_" + randomUUID(),
      userId,
      ward: "",
      district: "",
      city: "",
      isDefault: fields.isDefault || previous?.isDefault || !addresses.length,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    };
    const result = previous
      ? addresses.map((item) => (item.id === id ? entry : item))
      : [...addresses, entry];
    return this.commit(
      userId,
      result,
      revision,
      entry.isDefault ? entry.id : undefined,
    );
  }
  async remove(
    userId: string,
    id: string,
    revision: string,
  ): Promise<AddressBook> {
    const addresses = await this.current(userId, revision);
    if (!addresses.some((entry) => entry.id === id))
      throw new DomainError(
        "ADDRESS_NOT_FOUND",
        "Không tìm thấy địa chỉ.",
        404,
      );
    return this.commit(
      userId,
      addresses.filter((entry) => entry.id !== id),
      revision,
    );
  }
}
