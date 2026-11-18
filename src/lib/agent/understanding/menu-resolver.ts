import type { MenuItem } from "@/lib/types/menu";
import { expandShorthand, foldText, hasDiacritics } from "./vietnamese-input";

/**
 * Grounded menu mention resolution. The resolver can only return items that
 * exist in the supplied catalog; it never invents IDs, names or prices.
 *
 * Outcomes:
 *   resolved     exactly one available item
 *   ambiguous    several available items; the caller must ask the customer
 *   unavailable  the mention matches only items that exist but are not sold now
 *   not_found    nothing in the catalog matches (e.g. a product KFC VN does not sell)
 */
export type ResolutionStatus = "resolved" | "ambiguous" | "unavailable" | "not_found";

export interface MenuResolution {
  status: ResolutionStatus;
  items: Pick<MenuItem, "id" | "name" | "price">[];
  /** Words the customer used that match nothing in the catalog. */
  unknownTokens: string[];
  /** Matching items that exist but are not orderable right now. */
  unavailable: Pick<MenuItem, "id" | "name" | "price">[];
}

type CatalogItem = Pick<MenuItem, "id" | "name" | "price" | "description" | "tags" | "isActive" | "isAvailable"> & {
  categoryName?: string;
};

/**
 * Alias phrases on folded text, applied to BOTH customer text and catalog text
 * so that spelling variants inside the catalog (Mỳ/Mì) also converge.
 * Keep entries conservative: a wrong alias silently changes an order.
 */
const PHRASE_ALIASES: [RegExp, string][] = [
  [/\bmy y\b/g, "mi y"],
  [/\b(?:spaghetti|my spaghetti|mi spaghetti)\b/g, "mi y"],
  [/\b(?:hamburger|hambuger|hamburgur|ham bo go|bo go)\b/g, "burger"],
  [/\b(?:french fries|fries|khoai chien)\b/g, "khoai tay chien"],
  [/\b(?:mashed potato(?:es)?|khoai nghien)\b/g, "khoai tay nghien"],
  [/\b(?:7 up|seven up|sevenup)\b/g, "7up"],
  [/\b(?:pepsi zero|pepsi diet|diet pepsi|pepsi ko duong|pepsi k duong)\b/g, "pepsi khong duong"],
  [/\b(?:egg tarts?|banh tart|tart trung|banh tac)\b/g, "banh trung"],
  [/\btenders\b/g, "tender"],
  [/\b(?:phomai|pho mat|cheese)\b/g, "pho mai"],
  [/\b(?:salat|xa lat|xalat)\b/g, "salad"],
  [/\bsoup\b/g, "sup"],
  [/\b(?:coleslaw|bap cai)\b(?! tron)/g, "bap cai tron"],
  [/\b(?:ga chien|fried chicken)\b/g, "ga ran"],
  [/\bbucket\b/g, "xo"],
  // Category words become single tokens so request verbs ("ăn", "uống") stay fillers.
  [/\b(?:thuc uong|nuoc ngot|nuoc uong|do uong|nuoc giai khat|drinks?)\b/g, "douong"],
  [/\b(?:trang mieng|desserts?|do ngot)\b/g, "trangmieng"],
  [/\b(?:thuc an nhe|do an vat|an vat|snacks?|mon phu)\b/g, "anvat"],
  [/\b(?:size m|medium|size vua|co vua)\b/g, "vua"],
  [/\b(?:size l|large|size lon)\b/g, "large"],
  [/\b(?:size xl|extra large|size dai)\b/g, "dai"],
];

/** Single-token category aliases produced by PHRASE_ALIASES. */
const CATEGORY_WORDS = new Set(["douong", "anvat", "trangmieng"]);

/** Fillers that describe the request, not the product. Query side only. */
const FILLER = new Set([
  "cai", "phan", "suat", "chai", "ly", "coc", "mon", "nhe", "nha", "a", "cua", "kfc", "o", "loai",
  "them", "cho", "minh", "toi", "em", "anh", "chi", "voi", "vao", "gio", "hang", "khoi", "nua", "di",
  "giup", "lay", "goi", "mua", "dat", "order", "muon", "can", "xem", "tim", "co", "nao",
  "the", "con", "duoc", "hay", "ban", "oi", "la", "gi", "ah", "nhi", "luon", "de", "an", "uong",
  // request verbs and structure words; "bo" is NOT here because it is "Bơ" in product names
  "add", "gium", "dum", "doi", "thanh", "sua", "cap", "nhat", "len", "tang", "giam", "xuong", "ra",
  "xoa", "huy", "menu", "thuc", "don", "nhung", "so", "luong", "hoi", "biet", "nguoi", "nen",
]);

/** Modifiers a customer may add that the catalog does not encode; ignored, not a mismatch. */
const IGNORABLE = new Set(["lanh", "nong", "da", "it", "ngon", "thom", "gion", "moi", "nhieu"]);

function canonical(text: string): string {
  let folded = expandShorthand(text);
  for (const [pattern, replacement] of PHRASE_ALIASES) folded = folded.replace(pattern, replacement);
  return folded.replace(/\s+/g, " ").trim();
}

function tokens(text: string): string[] {
  return canonical(text).split(" ").filter(Boolean);
}

/** Optimal-string-alignment distance, bounded for short tokens. */
function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  return d[a.length][b.length];
}

interface Indexed {
  item: CatalogItem;
  name: Set<string>;
  nameList: string[];
  detail: Set<string>;
  available: boolean;
}

interface Vocabulary { all: Set<string>; names: Set<string> }

function index(menu: CatalogItem[]): { rows: Indexed[]; vocabulary: Vocabulary } {
  const vocabulary: Vocabulary = { all: new Set(), names: new Set() };
  // isActive=false means retired from the source catalog: treated as not sold at all.
  // isActive && !isAvailable means temporarily sold out: matchable, reported as such.
  const rows = menu.filter((item) => item.isActive).map((item) => {
    const nameList = tokens(item.name);
    // Category names are shared by many unrelated items ("Burger - Cơm - Mì Ý"),
    // so only the category-level aliases (douong, anvat, trangmieng) are taken
    // from them; product words must come from the item's own name/description.
    const categoryTokens = tokens(item.categoryName ?? "").filter((t) => CATEGORY_WORDS.has(t));
    const detail = new Set([...tokens([item.description ?? "", ...(item.tags ?? [])].join(" ")), ...categoryTokens]);
    nameList.forEach((t) => { vocabulary.all.add(t); vocabulary.names.add(t); });
    detail.forEach((t) => { if (!FILLER.has(t)) vocabulary.all.add(t); });
    return { item, name: new Set(nameList), nameList, detail, available: item.isAvailable };
  });
  return { rows, vocabulary };
}

/** Each query token becomes a set of acceptable catalog tokens. */
function expandQuery(mention: string, vocabulary: Vocabulary, options: { skipNumbers?: boolean } = {}) {
  const accentFree = !hasDiacritics(mention);
  const groups: Set<string>[] = [];
  const unknown: string[] = [];
  for (const token of tokens(mention)) {
    if (FILLER.has(token) || IGNORABLE.has(token)) continue;
    if (options.skipNumbers && /^\d+$/.test(token)) continue;
    const options_ = new Set<string>();
    if (vocabulary.all.has(token)) options_.add(token);
    // Without accents "lon" may mean "lớn" (large) as well as "lon" (can).
    if (accentFree && token === "lon") options_.add("large");
    // Typo tolerance only against product-name words, same first letter, so
    // "pesi" -> "pepsi" but "canh" (cánh) never becomes "banh" (bánh).
    if (!options_.size && !/^\d+$/.test(token) && token.length >= 4) {
      const limit = token.length >= 8 ? 2 : 1;
      let best = limit + 1;
      for (const word of vocabulary.names) {
        if (word.length < 4 || word[0] !== token[0]) continue;
        const distance = editDistance(token, word);
        if (distance < best) { best = distance; options_.clear(); }
        if (distance === best && distance <= limit) options_.add(word);
      }
    }
    if (options_.size) groups.push(options_);
    else unknown.push(token);
  }
  return { groups, unknown };
}

const covers = (set: Set<string>, groups: Set<string>[]) =>
  groups.every((group) => [...group].some((token) => set.has(token)));

/** Size words, after folding and aliasing ("Lớn" -> large). */
const SIZE_WORDS = new Set(["large", "vua", "dai", "lon", "tieu", "chuan"]);

const BUNDLE_WORDS = ["combo", "deal", "xo"];
const isBundle = (row: Indexed) => BUNDLE_WORDS.some((word) => row.name.has(word));

/**
 * Narrowing rules, each conservative:
 * - if the customer did not say combo/deal/xô, single items beat bundles;
 * - drop an item whose name strictly contains another match's name (an
 *   unmentioned variant such as "Không Đường").
 */
function preferGeneral(rows: Indexed[], groups: Set<string>[]): Indexed[] {
  const askedBundle = groups.some((group) => BUNDLE_WORDS.some((word) => group.has(word)));
  const singles = rows.filter((row) => !isBundle(row));
  const pool = !askedBundle && singles.length ? singles : rows;
  return pool.filter((row) => !pool.some((other) =>
    other !== row && other.name.size < row.name.size && [...other.name].every((t) => row.name.has(t))));
}

const summary = (row: Indexed) => ({ id: row.item.id, name: row.item.name, price: row.item.price });

export function resolveMenuMention(mention: string, menu: CatalogItem[]): MenuResolution {
  const { rows, vocabulary } = index(menu);
  const { groups, unknown } = expandQuery(mention, vocabulary);
  const empty = (status: ResolutionStatus): MenuResolution => ({ status, items: [], unknownTokens: unknown, unavailable: [] });
  // Any content word that exists nowhere in the catalog means the product is not sold.
  if (!groups.length || unknown.length) return empty("not_found");

  const wanted = canonical(mention).split(" ").filter((t) => !FILLER.has(t) && !IGNORABLE.has(t)).join(" ");
  const exact = rows.filter((row) => row.nameList.join(" ") === wanted);
  let matches = exact.length ? exact : rows.filter((row) => covers(row.name, groups));
  // Description fallback. Only a size word may come from the description
  // ("pepsi lớn" -> Pepsi (Đại), described as "Lớn"). If the product itself is
  // only a component of a bundle ("súp rong biển" inside a combo), the
  // customer must be asked: such matches can never resolve on their own.
  let componentOnly = false;
  if (!matches.length) {
    const loose = rows.filter((row) => covers(new Set([...row.name, ...row.detail]), groups));
    const productGroups = groups.filter((group) => ![...group].every((t) => SIZE_WORDS.has(t)));
    matches = loose.filter((row) => covers(row.name, productGroups));
    if (!matches.length) { matches = loose; componentOnly = true; }
  }
  if (!matches.length) return empty("not_found");

  // Narrow first, then split by availability: when the product the customer
  // named is sold out, report it instead of silently substituting a bundle.
  const narrowed = preferGeneral(matches, groups);
  const available = narrowed.filter((row) => row.available);
  const unavailable = narrowed.filter((row) => !row.available).map(summary);
  if (!available.length) return { status: "unavailable", items: [], unknownTokens: [], unavailable };
  return {
    status: available.length === 1 && !componentOnly ? "resolved" : "ambiguous",
    items: available.map(summary).sort((a, b) => a.price - b.price || a.id.localeCompare(b.id)),
    unknownTokens: [],
    unavailable,
  };
}

/**
 * Search semantics: every orderable item the phrase describes, without the
 * narrowing used for cart actions (a search for "burger" lists combos too).
 * Returns null when the phrase contains words the catalog does not know, so
 * callers can fall back to prefix search while a customer is still typing.
 */
export function matchMenuItems<T extends CatalogItem>(query: string, menu: T[]): T[] | null {
  const { rows, vocabulary } = index(menu);
  const { groups, unknown } = expandQuery(query, vocabulary);
  if (!groups.length || unknown.length) return null;
  // Name or description, like the previous search: "gà" still finds deals whose
  // description contains chicken.
  return rows
    .filter((row) => row.available && covers(new Set([...row.name, ...row.detail]), groups))
    .map((row) => row.item as T);
}

/**
 * Ranks available catalog items for the model context. Name hits weigh more
 * than description/category hits. Returns noMatch instead of padding the list
 * with unrelated items, so the model is never handed a misleading shortlist.
 */
export function rankMenuCandidates(message: string, menu: CatalogItem[], limit = 12) {
  const { rows, vocabulary } = index(menu);
  // Bare numbers in a full message are usually quantities, not product names.
  const { groups, unknown } = expandQuery(message, vocabulary, { skipNumbers: true });
  const all = rows
    .map((row) => ({
      row,
      score: groups.reduce((sum, group) => {
        const list = [...group];
        if (list.some((t) => row.name.has(t))) return sum + 2;
        if (list.some((t) => row.detail.has(t))) return sum + 1;
        return sum;
      }, 0),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.row.item.price - b.row.item.price || a.row.item.id.localeCompare(b.row.item.id));
  const scored = all.filter((entry) => entry.row.available);
  // Sold-out items that match as well as the best match: the customer most
  // likely means one of these, so the model must be told they are sold out.
  const top = all[0]?.score ?? 0;
  const soldOut = all.filter((entry) => !entry.row.available && entry.score === top).slice(0, 5);
  return {
    noMatch: scored.length === 0,
    /** Words matching nothing on the menu ("cánh", "coca"): tell the model so it can say so. */
    unknownTokens: unknown,
    items: scored.slice(0, limit).map((entry) => summary(entry.row)),
    soldOut: soldOut.map((entry) => summary(entry.row)),
  };
}

export { foldText };
