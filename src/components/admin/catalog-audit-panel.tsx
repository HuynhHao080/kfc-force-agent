"use client";
import { useState } from "react";
import {
  catalogActionLabels,
  catalogFieldLabels,
  type CatalogAuditEntry,
  type CatalogAuditValue,
} from "@/lib/types/catalog-audit";
import { money } from "@/lib/storefront-types";
const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase();
const display = (value: CatalogAuditValue, field: string) =>
  value === null
    ? "Chưa có"
    : typeof value === "boolean"
      ? value
        ? "Có"
        : "Không"
      : field === "price" && typeof value === "number"
        ? money(value)
        : String(value === "" ? "(trống)" : value);
export function CatalogAuditPanel({
  entries,
}: {
  entries: CatalogAuditEntry[];
}) {
  const [query, setQuery] = useState("");
  const [action, setAction] = useState("all");
  const visible = entries.filter(
    (entry) =>
      (action === "all" || entry.action === action) &&
      normalize(entry.entityName + " " + entry.entityId).includes(
        normalize(query.trim()),
      ),
  );
  return (
    <section className="catalog-audit-panel" aria-labelledby="audit-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">LỊCH SỬ THAY ĐỔI THỰC ĐƠN</span>
          <h2 id="audit-title">Nhật ký quản trị</h2>
        </div>
        <span className="count-badge">{visible.length}</span>
      </div>
      <p className="small muted">
        Tối đa 200 thay đổi gần nhất của món và danh mục từ khi có chức năng
        này. Lịch sử trạng thái đơn nằm trong chi tiết từng đơn. Tài khoản quản
        trị hiện dùng chung.
      </p>
      <div className="order-filter-grid audit-filter-grid">
        <label>
          Tìm tên hoặc mã đối tượng
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          Loại thay đổi
          <select
            value={action}
            onChange={(event) => setAction(event.target.value)}
          >
            <option value="all">Tất cả thay đổi</option>
            {Object.entries(catalogActionLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!visible.length && (
        <div className="panel empty-state">
          <h3>Chưa có nhật ký phù hợp.</h3>
          <p className="muted">
            Thử bỏ bộ lọc hoặc tạo/sửa món, danh mục để xem thay đổi mới.
          </p>
        </div>
      )}
      <div className="audit-list">
        {visible.map((entry) => (
          <article className="panel" key={entry.id}>
            <div className="section-heading">
              <div>
                <span className="status-badge">
                  {catalogActionLabels[entry.action]}
                </span>
                <h3>{entry.entityName}</h3>
              </div>
              <time className="small muted" dateTime={entry.createdAt}>
                {new Date(entry.createdAt).toLocaleString("vi-VN", {
                  timeZone: "Asia/Ho_Chi_Minh",
                })}
              </time>
            </div>
            <p className="small muted audit-entity-id">
              {entry.entityId} · Quản trị chung
            </p>
            <dl className="audit-changes">
              {entry.changes.map((change) => (
                <div key={change.field}>
                  <dt>{catalogFieldLabels[change.field] ?? change.field}</dt>
                  <dd>
                    <span>{display(change.before, change.field)}</span>
                    <span aria-label="thay đổi thành">→</span>
                    <strong>{display(change.after, change.field)}</strong>
                  </dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
