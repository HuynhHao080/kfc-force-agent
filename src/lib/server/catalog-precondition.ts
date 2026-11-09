import { DomainError } from "@/lib/domain-error";

export function readCatalogRevision(request: Request): string | undefined {
  const revision = request.headers.get("x-kfc-catalog-revision");
  if (revision === null) return undefined;
  if (!/^[a-f0-9]{64}$/.test(revision))
    throw new DomainError("INVALID_CATALOG_REVISION", "Phiên bản thực đơn chưa hợp lệ. Hãy tải lại dữ liệu.");
  return revision;
}
