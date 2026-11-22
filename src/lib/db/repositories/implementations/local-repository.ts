import { withUserLock } from "@/lib/server/user-lock";
import {
  existsSync,
  copyFileSync,
  constants,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { createMemoryRepositories } from "./mock-repository";
import { catalogRecords } from "@/lib/catalog/kfc-catalog";
import { kfcCatalogEnabled } from "@/lib/purchase-mode";
import bundledCatalog from "@/lib/catalog/kfc-menu.snapshot.json";
import type { RepositorySet } from "../repositories";
import { mergeCatalog } from "@/lib/catalog/merge-catalog";
import { catalogFingerprint } from "@/lib/catalog/catalog-fingerprint";
import { SHOP_ORDER_GATE } from "@/lib/services/shop-service";
import type { MenuCategory, MenuItem } from "@/lib/types/menu";

type Snapshot = Record<string, Record<string, [unknown, unknown][]>>;
const shared = globalThis as typeof globalThis & {
  kfcLocalRepositories?: RepositorySet;
  kfcApplyLocalCatalog?: (catalog: { categories: MenuCategory[]; items: MenuItem[] }) => Promise<boolean>;
};

export async function applyLocalCatalog(catalog: { categories: MenuCategory[]; items: MenuItem[] }): Promise<boolean> {
  localRepositories();
  return shared.kfcApplyLocalCatalog!(catalog);
}

function replaceSnapshot(temporary: string, file: string): void {
  const retryWait = new Int32Array(new SharedArrayBuffer(4));
  for (let attempt = 0; ; attempt++) {
    try {
      renameSync(temporary, file);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (attempt >= 4 || !["EPERM", "EACCES", "EBUSY"].includes(code ?? ""))
        throw error;
      // File scanners can briefly hold the destination open on Windows.
      // Keep replacement synchronous so reads cannot interleave with retries.
      Atomics.wait(retryWait, 0, 0, 50 * (attempt + 1));
    }
  }
}
export function localRepositories(): RepositorySet {
  if (shared.kfcLocalRepositories) return shared.kfcLocalRepositories;
  const directory = resolve(
    /* turbopackIgnore: true */ process.env.LOCAL_DATA_DIR || ".local",
  );
  mkdirSync(directory, { recursive: true });
  const file = resolve(directory, "store.json");
  const catalogFile = process.env.KFC_CATALOG_FILE;
  let initialCatalog: ReturnType<typeof catalogRecords> | undefined;
  if (!existsSync(file)) {
    if (catalogFile) initialCatalog = catalogRecords(JSON.parse(readFileSync(resolve(catalogFile), "utf8")));
    else if (kfcCatalogEnabled()) initialCatalog = catalogRecords(bundledCatalog);
  }
  const repositoryCatalog = initialCatalog ?? (kfcCatalogEnabled() ? { categories: [], items: [] } : undefined);
  const repositories = createMemoryRepositories(repositoryCatalog);
  const snapshot = (): Snapshot =>
    Object.fromEntries(
      Object.entries(repositories).map(([name, repository]) => [
        name,
        Object.fromEntries(
          Object.entries(repository)
            .filter(([, value]) => value instanceof Map)
            .map(([key, value]) => [
              key,
              [...(value as Map<unknown, unknown>)],
            ]),
        ),
      ]),
    );
  const restore = (data: Snapshot) => {
    for (const [name, fields] of Object.entries(data)) {
      const repository = repositories[
        name as keyof RepositorySet
      ] as unknown as Record<string, unknown>;
      if (!repository) continue;
      for (const [key, entries] of Object.entries(fields)) {
        if (repository[key] instanceof Map && Array.isArray(entries))
          repository[key] = new Map(entries);
      }
    }
  };
  if (existsSync(file)) {
    restore(JSON.parse(readFileSync(file, "utf8")));
    if (kfcCatalogEnabled() && process.env.KFC_CATALOG_REFRESH === "1") {
      const incoming = catalogRecords(catalogFile ? JSON.parse(readFileSync(resolve(catalogFile), "utf8")) : bundledCatalog);
      const merged = mergeCatalog(snapshot(), incoming);
      if (merged.changed) {
        const importId = randomUUID();
        const backup = resolve(directory, `store.before-catalog-${importId}.json`);
        copyFileSync(file, backup, constants.COPYFILE_EXCL);
        const temporary = `${file}.catalog-${importId}.tmp`;
        writeFileSync(temporary, JSON.stringify(merged.snapshot), { flag: "wx", mode: 0o600 });
        replaceSnapshot(temporary, file);
        restore(merged.snapshot);
      }
    }
  }
  else if (initialCatalog) {
    // Freeze imported prices and provenance before accepting any application writes.
    writeFileSync(file, JSON.stringify(snapshot()), { flag: "wx", mode: 0o600 });
  }
  shared.kfcApplyLocalCatalog = catalog => withUserLock(SHOP_ORDER_GATE, () =>
    withUserLock("__local_disk__", async () => {
      const before = snapshot();
      const currentItems = before.menuRepository.items.map(([, item]) => item as MenuItem);
      const importedItems = currentItems.filter(item => (item.metadata?.source as { provider?: string } | undefined)?.provider === "tinyfish" && item.isActive);
      // A truncated/failed page must never retire a large part of the serving menu.
      if (catalog.items.length < importedItems.length * 0.8 || catalog.items.length === 0)
        throw new Error("CATALOG_INCOMPLETE");
      const categoryIds = new Set(catalog.categories.map(category => category.id));
      if (importedItems.some(item => !categoryIds.has(item.categoryId)))
        throw new Error("CATALOG_INCOMPLETE");
      const currentCategories = before.menuRepository.categories.map(([, category]) => category as MenuCategory);
      const merged = mergeCatalog(before, catalog);
      if (catalogFingerprint({ categories: currentCategories, items: currentItems }) === catalogFingerprint(catalog)) return false;
      if (!merged.changed) return false;
      const id = randomUUID();
      copyFileSync(file, resolve(directory, `store.before-catalog-${id}.json`), constants.COPYFILE_EXCL);
      const temporary = `${file}.catalog-${id}.tmp`;
      writeFileSync(temporary, JSON.stringify(merged.snapshot), { flag: "wx", mode: 0o600 });
      replaceSnapshot(temporary, file);
      restore(merged.snapshot);
      return true;
    }),
  );
  const wrapped = Object.fromEntries(
    Object.entries(repositories).map(([name, repository]) => [
      name,
      new Proxy(repository, {
        get(target, property, receiver) {
          const value = Reflect.get(target, property, receiver);
          if (typeof value !== "function") return value;
          if (
            !/^(create|update|add|append|save|remove|clear|complete|cancel|transition)/.test(
              String(property),
            )
          )
            return value.bind(target);
          return (...args: unknown[]) =>
            withUserLock("__local_disk__", async () => {
              const before = JSON.stringify(snapshot());
              try {
                const result = await value.apply(target, args);
                const temporary = `${file}.tmp`;
                writeFileSync(temporary, JSON.stringify(snapshot()), {
                  mode: 0o600,
                });
                replaceSnapshot(temporary, file);
                return result;
              } catch (error) {
                restore(JSON.parse(before));
                throw error;
              }
            });
        },
      }),
    ]),
  ) as unknown as RepositorySet;
  return (shared.kfcLocalRepositories = wrapped);
}
