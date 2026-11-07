"use client";
import { useEffect, useState } from "react";
import { api, money, RequestError } from "@/lib/storefront-types";
import { invalidDateRange, type OrderFilters } from "@/lib/order-reporting";
import { productSalesCsv } from "@/lib/sales-reporting";
import type { SalesReport } from "@/lib/types/sales";
export function SalesReportPanel({
  filters,
  basisRevision,
  onExpired,
}: {
  filters: OrderFilters;
  basisRevision: string | undefined;
  onExpired: () => void;
}) {
  const { status, fulfillment, search, from, to } = filters;
  const [state, setState] = useState<{
    key: string;
    report?: SalesReport;
    error?: string;
  }>({ key: "" });
  const [reload, setReload] = useState(0);
  const invalid = invalidDateRange(filters);
  const key = JSON.stringify([
    basisRevision,
    status,
    fulfillment,
    search,
    from,
    to,
    reload,
  ]);
  useEffect(() => {
    if (!basisRevision || invalid) return;
    let active = true;
    const controller = new AbortController();
    let timeout: number | undefined;
    const timer = window.setTimeout(() => {
      timeout = window.setTimeout(() => controller.abort(), 20000);
      const params = new URLSearchParams({
        basisRevision,
        status,
        fulfillment,
        search,
        from,
        to,
      });
      api<SalesReport>("/api/admin/sales?" + params, {
        signal: controller.signal,
      })
        .then((report) => {
          if (active) setState({ key, report });
        })
        .catch((error) => {
          if (!active) return;
          if (error instanceof RequestError && error.status === 401)
            onExpired();
          else
            setState({
              key,
              error:
                error instanceof Error
                  ? error.message
                  : "Chưa tải được báo cáo món.",
            });
        })
        .finally(() => window.clearTimeout(timeout));
    }, 250);
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timer);
      window.clearTimeout(timeout);
    };
  }, [
    basisRevision,
    status,
    fulfillment,
    search,
    from,
    to,
    invalid,
    key,
    onExpired,
  ]);
  const report = state.key === key && !invalid ? state.report : undefined;
  const error = state.key === key ? state.error : undefined;
  const download = () => {
    if (!report) return;
    const url = URL.createObjectURL(
      new Blob([productSalesCsv(report)], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "kfc-product-sales-demo.csv";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <section className="panel sales-report-panel" aria-label="Món bán chạy">
      <div className="section-heading">
        <div>
          <span className="eyebrow">MÓN NÀO ĐƯỢC CHỌN NHIỀU?</span>
          <h2>Món bán chạy</h2>
        </div>
        <button
          className="button secondary"
          disabled={!report?.products.length}
          onClick={download}
        >
          Xuất CSV món
        </button>
      </div>
      <p className="small muted">
        Chỉ đơn đã hoàn tất, theo ngày đặt và cùng bộ lọc phía trên, trong tối
        đa 200 đơn gần nhất. Tiền món tính trước giảm, không phải doanh thu phân
        bổ cho từng món hay tiền đã thu.
      </p>
      <button
        className="text-button"
        onClick={() => setReload((value) => value + 1)}
      >
        Làm mới món bán chạy
      </button>
      {invalid ? (
        <p role="alert" className="error-box">
          Khoảng ngày chưa hợp lệ; chưa tính báo cáo món.
        </p>
      ) : error ? (
        <p role="alert" className="error-box">
          {error}
        </p>
      ) : !report ? (
        <p role="status" className="muted">
          Đang tính báo cáo món…
        </p>
      ) : (
        <>
          {report.excludedOrders > 0 && (
            <p role="alert" className="error-box">
              Đã loại {report.excludedOrders} đơn hoàn tất thiếu chi tiết hoặc
              sai đối soát khỏi báo cáo món này.
            </p>
          )}
          <div className="sales-metrics">
            {[
              ["Đơn hoàn tất hợp lệ", String(report.completedOrders)],
              ["Số phần", String(report.units)],
              ["Tiền món trước giảm", money(report.gross)],
              ["Giảm giá", money(report.discount)],
              ["Phí giao", money(report.deliveryFee)],
              ["Giá trị sau giảm + phí", money(report.net)],
            ].map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          {!report.products.length ? (
            <p className="notice-box">
              Không có món từ đơn hoàn tất hợp lệ trong bộ lọc này.
            </p>
          ) : (
            <div className="sales-product-list">
              {report.products.map((product, index) => (
                <article key={product.menuItemId}>
                  <div className="section-heading">
                    <h3>
                      {index + 1}. {product.name}
                    </h3>
                    <strong>{product.units} phần</strong>
                  </div>
                  <meter
                    min={0}
                    max={Math.max(1, ...report.products.map((p) => p.units))}
                    value={product.units}
                    aria-label={product.name + ": " + product.units + " phần"}
                  />
                  <p>
                    {product.orderCount} đơn hoàn tất · {money(product.gross)}{" "}
                    tiền món trước giảm
                  </p>
                  <small className="muted">{product.menuItemId}</small>
                </article>
              ))}
            </div>
          )}
          <p className="small muted">
            Top {report.topLimit} theo số phần, cùng số phần thì xếp theo tiền
            món và mã món. Tên từ snapshot hoàn tất mới nhất. Tổng ở trên tính
            mọi món, có thể lớn hơn tổng top. Mẫu {report.sampledOrders} đơn,{" "}
            {report.matchedOrders} đơn khớp bộ lọc. Tính lúc{" "}
            {new Date(report.generatedAt).toLocaleString("vi-VN")}.
          </p>
        </>
      )}
    </section>
  );
}
