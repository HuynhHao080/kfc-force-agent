import type { MenuCategory, MenuItem } from "@/lib/types/menu";

type Snapshot = Record<string, Record<string, [unknown, unknown][]>>;

function source(item: MenuItem): {
  rawSha256?: string;
  fetchedAt?: string;
  provider?: string;
} {
  return (item.metadata?.source ?? {}) as {
    rawSha256?: string;
    fetchedAt?: string;
    provider?: string;
  };
}

export function mergeCatalog(
  snapshot: Snapshot,
  catalog: { categories: MenuCategory[]; items: MenuItem[] },
): {
  snapshot: Snapshot;
  added: number;
  updated: number;
  retired: number;
  changed: boolean;
} {
  const result = structuredClone(snapshot);
  const menu = result.menuRepository;
  const items = new Map(menu.items as [string, MenuItem][]);
  const categories = new Map(menu.categories as [string, MenuCategory][]);
  const incomingTime = Date.parse(source(catalog.items[0]).fetchedAt ?? "");
  const storedTimes = [...items.values()]
    .map((item) => Date.parse(source(item).fetchedAt ?? ""))
    .filter(Number.isFinite);
  if (
    !Number.isFinite(incomingTime) ||
    storedTimes.some((time) => time > incomingTime)
  )
    throw new Error(
      "Catalog source is older than the accepted data. Review the import before applying it.",
    );
  let added = 0,
    updated = 0,
    retired = 0,
    categoryChanges = 0;
  const incomingIds = new Set(catalog.items.map((item) => item.id));
  for (const item of catalog.items) {
    const previous = items.get(item.id);
    if (previous && source(previous).rawSha256 === source(item).rawSha256)
      continue;
    if (previous) updated++;
    else added++;
    items.set(item.id, item);
  }
  for (const [id, item] of items) {
    if (
      source(item).provider === "tinyfish" &&
      !incomingIds.has(id) &&
      (item.isActive || item.isAvailable)
    ) {
      items.set(id, {
        ...item,
        isActive: false,
        isAvailable: false,
        updatedAt: catalog.items[0].updatedAt,
      });
      retired++;
    }
  }
  for (const category of catalog.categories) {
    const previous = categories.get(category.id);
    if (
      previous?.updatedAt === category.updatedAt &&
      JSON.stringify(previous) === JSON.stringify(category)
    )
      continue;
    if (previous && Date.parse(previous.updatedAt) > incomingTime) continue;
    categories.set(category.id, category);
    categoryChanges++;
  }
  const currentEntries: [unknown, unknown][] = catalog.items.map((item) => [
    item.id,
    items.get(item.id) ?? item,
  ]);
  const historicalEntries = [...items.entries()].filter(
    ([id]) => !incomingIds.has(id),
  );
  menu.items = [...currentEntries, ...historicalEntries];
  menu.categories = [...categories.entries()];
  return {
    snapshot: result,
    added,
    updated,
    retired,
    changed: added + updated + retired + categoryChanges > 0,
  };
}
