import {
  existsSync,
  readFileSync,
  writeFileSync,
  renameSync,
  mkdirSync,
} from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { catalogRecords } from "./kfc-catalog";
import { fetchCatalog } from "./fetch-catalog";
import { applyLocalCatalog } from "@/lib/db/repositories/implementations/local-repository";
import { kfcCatalogEnabled } from "@/lib/purchase-mode";

interface RefreshState {
  day: string;
  attempts: number;
  nextCheckAt: number;
  lastCheckedAt?: string;
  lastSuccessAt?: string;
  failures: number;
  outcome: "waiting" | "updated" | "unchanged" | "error";
}

export class CatalogRefresh {
  private running = false;
  private state: RefreshState;
  private file: string;
  constructor(
    private directory: string,
    private intervalMs: number,
    private dailyLimit: number,
    private collect = fetchCatalog,
    private publish = applyLocalCatalog,
    private now = Date.now,
  ) {
    this.file = resolve(directory, "catalog-refresh-state.json");
    this.state = existsSync(this.file)
      ? JSON.parse(readFileSync(this.file, "utf8"))
      : {
          day: "",
          attempts: 0,
          nextCheckAt: 0,
          failures: 0,
          outcome: "waiting",
        };
    if (
      !Number.isFinite(this.state.nextCheckAt) ||
      !Number.isInteger(this.state.attempts) ||
      this.state.attempts < 0 ||
      !Number.isInteger(this.state.failures)
    )
      throw new Error("CATALOG_STATE_INVALID");
  }
  status() {
    return {
      enabled: true,
      updating: this.running,
      outcome: this.state.outcome,
      lastCheckedAt: this.state.lastCheckedAt ?? null,
      lastSuccessAt: this.state.lastSuccessAt ?? null,
      nextCheckAt: new Date(this.state.nextCheckAt).toISOString(),
      intervalMinutes: this.intervalMs / 60000,
    };
  }
  private save() {
    mkdirSync(this.directory, { recursive: true });
    const temporary = this.file + "." + randomUUID() + ".tmp";
    writeFileSync(temporary, JSON.stringify(this.state), {
      flag: "wx",
      mode: 0o600,
    });
    renameSync(temporary, this.file);
  }
  async tick(): Promise<void> {
    const now = this.now();
    if (this.running || now < this.state.nextCheckAt) return;
    this.running = true;
    try {
      const day = new Date(now).toISOString().slice(0, 10);
      if (day !== this.state.day)
        this.state = { ...this.state, day, attempts: 0 };
      if (this.state.attempts >= this.dailyLimit) {
        this.state.nextCheckAt = Date.parse(day + "T00:00:00.000Z") + 86400000;
        this.save();
        return;
      }
      this.state.attempts++;
      this.state.lastCheckedAt = new Date(now).toISOString();
      this.state.nextCheckAt = now + this.intervalMs;
      // Failed persistence means no network call. A crash still consumes its attempt.
      this.save();
      try {
        const capture = await this.collect();
        const changed = await this.publish(catalogRecords(capture));
        this.state.outcome = changed ? "updated" : "unchanged";
        this.state.lastSuccessAt = new Date(this.now()).toISOString();
        this.state.failures = 0;
      } catch {
        this.state.outcome = "error";
        this.state.failures++;
      }
      this.state.nextCheckAt =
        this.now() +
        Math.min(
          this.intervalMs * 2 ** Math.min(this.state.failures, 3),
          Math.max(this.intervalMs, 21600000),
        );
      this.save();
    } finally {
      this.running = false;
    }
  }
}

const shared = globalThis as typeof globalThis & {
  kfcCatalogRefresh?: CatalogRefresh;
  kfcCatalogRefreshTimer?: ReturnType<typeof setInterval>;
};
export function catalogRefreshStatus() {
  return (
    shared.kfcCatalogRefresh?.status() ?? {
      enabled: false,
      updating: false,
      outcome: "disabled" as const,
      lastCheckedAt: null,
      lastSuccessAt: null,
      nextCheckAt: null,
      intervalMinutes: null,
    }
  );
}
export function startCatalogRefresh() {
  if (
    shared.kfcCatalogRefreshTimer ||
    process.env.KFC_CATALOG_AUTO_REFRESH !== "1" ||
    !kfcCatalogEnabled() ||
    process.env.PERSISTENCE_DRIVER !== "local"
  )
    return;
  if (!process.env.TINYFISH_API_KEY) return;
  const intervalMinutes = Number(
    process.env.KFC_CATALOG_INTERVAL_MINUTES || 60,
  );
  const dailyLimit = Number(process.env.KFC_CATALOG_DAILY_FETCH_LIMIT || 24);
  if (
    !Number.isInteger(intervalMinutes) ||
    intervalMinutes < 60 ||
    intervalMinutes > 1440 ||
    !Number.isInteger(dailyLimit) ||
    dailyLimit < 1 ||
    dailyLimit > 24
  )
    throw new Error("CATALOG_CONFIG_INVALID");
  const scheduler = new CatalogRefresh(
    resolve(process.env.LOCAL_DATA_DIR || ".local"),
    intervalMinutes * 60000,
    dailyLimit,
  );
  shared.kfcCatalogRefresh = scheduler;
  const tick = () => {
    void scheduler
      .tick()
      .catch(() =>
        console.error(
          "Catalog refresh state could not be saved; previous catalog retained.",
        ),
      );
  };
  shared.kfcCatalogRefreshTimer = setInterval(tick, 60000);
  shared.kfcCatalogRefreshTimer.unref();
  tick();
}
