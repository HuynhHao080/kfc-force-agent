"use client";
import { useEffect, useState } from "react";

interface Status {
  enabled: boolean;
  outcome: string;
  lastSuccessAt: string | null;
  version: string;
  intervalMinutes: number | null;
}
export function CatalogFreshness({
  version,
  capturedAt,
  paused,
  onUpdate,
}: {
  version?: string;
  capturedAt?: string;
  paused: boolean;
  onUpdate: () => Promise<void>;
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [disconnected, setDisconnected] = useState(false);
  useEffect(() => {
    let active = true;
    let fetching = false;
    let controller: AbortController | undefined;
    const sync = async () => {
      if (paused || document.hidden || fetching) return;
      fetching = true;
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 10000);
      try {
        const response = await fetch("/api/catalog/status", {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("CATALOG_STATUS_UNAVAILABLE");
        const next: Status = await response.json();
        if (!active) return;
        setStatus(next);
        setDisconnected(false);
        if (version && next.version !== version) await onUpdate();
      } catch {
        if (active) setDisconnected(true);
      } finally {
        window.clearTimeout(timeout);
        fetching = false;
      }
    };
    void sync();
    const wake = () => {
      void sync();
    };
    const timer = window.setInterval(wake, 60000);
    document.addEventListener("visibilitychange", wake);
    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [version, paused, onUpdate]);
  const last = status?.lastSuccessAt ?? capturedAt;
  const timestamp = last
    ? new Date(last).toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Ho_Chi_Minh",
      })
    : null;
  return (
    <p className="catalog-freshness" role="status">
      {disconnected
        ? "Chưa kết nối được trạng thái cập nhật. "
        : status?.outcome === "error"
          ? "Lần kiểm tra mới chưa thành công, đang giữ thực đơn gần nhất. "
          : ""}
      {timestamp &&
        `${status?.lastSuccessAt ? "Đã kiểm tra" : "Dữ liệu nguồn"} ${timestamp}. `}
      {status?.enabled && `Tự kiểm tra mỗi ${status.intervalMinutes} phút.`}
    </p>
  );
}
