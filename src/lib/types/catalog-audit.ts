export type CatalogAuditValue = string | number | boolean | null;
export interface CatalogAuditEntry {
  id: string;
  actor: "admin";
  action:
    "MENU_CREATED" | "MENU_UPDATED" | "CATEGORY_CREATED" | "CATEGORY_UPDATED";
  entityId: string;
  entityName: string;
  createdAt: string;
  changes: {
    field: string;
    before: CatalogAuditValue;
    after: CatalogAuditValue;
  }[];
}
export const catalogActionLabels: Record<CatalogAuditEntry["action"], string> =
  {
    MENU_CREATED: "Tạo món",
    MENU_UPDATED: "Sửa món",
    CATEGORY_CREATED: "Tạo danh mục",
    CATEGORY_UPDATED: "Sửa danh mục",
  };
export const catalogFieldLabels: Record<string, string> = {
  name: "Tên",
  description: "Mô tả",
  price: "Giá bán",
  categoryId: "Mã danh mục",
  imageUrl: "Minh hoạ",
  isActive: "Hoạt động",
  isAvailable: "Còn món",
  displayOrder: "Thứ tự",
};
