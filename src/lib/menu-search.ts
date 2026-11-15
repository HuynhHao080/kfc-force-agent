import type { MenuItem } from "./types/menu";

export function normalizeVietnamese(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchesMenuQuery(
  item: Pick<MenuItem, "name" | "description" | "tags">,
  query: string,
  options: { allowNamePrefix?: boolean } = {},
): boolean {
  const tokens = normalizeVietnamese(query).split(" ").filter(Boolean);
  const names = normalizeVietnamese(item.name).split(" ");
  const words = new Set(
    normalizeVietnamese(
      [item.name, item.description ?? "", ...(item.tags ?? [])].join(" "),
    ).split(" "),
  );
  return tokens.every(
    (token) =>
      words.has(token) ||
      (!!options.allowNamePrefix &&
        names.some((name) => name.startsWith(token))),
  );
}
