import { normalizeVietnamese } from "@/lib/menu-search";

/**
 * Deterministic Vietnamese input understanding helpers. Pure functions only:
 * no I/O, no model calls, no catalog access. Safe to run on every message.
 */

const boundary = (word: string) =>
  new RegExp(`(?<![\\p{L}\\p{N}])${word}(?![\\p{L}\\p{N}])`, "giu");

/** True when the text carries Vietnamese diacritics (or đ). */
export function hasDiacritics(text: string): boolean {
  return /[̀-ͯ]/.test(text.normalize("NFD")) || /đ/i.test(text);
}

/**
 * Lowercase, accent-free, punctuation-free form used for matching.
 * "Lớn" (large) and "Lon" (can) collide once accents are removed, so the size
 * word is canonicalised to "large" while the accent is still visible.
 */
export function foldText(text: string): string {
  const marked = text.normalize("NFC").replace(boundary("lớn"), " large ");
  return normalizeVietnamese(marked);
}

/** Token-level chat shorthand. Only unambiguous, food-ordering-relevant forms. */
const SHORTHAND: Record<string, string> = {
  k: "khong", ko: "khong", kh: "khong", khg: "khong", hok: "khong", hong: "khong", hem: "khong", kg: "khong",
  dc: "duoc", dk: "duoc", j: "gi", gj: "gi",
  mik: "minh", mk: "minh", mh: "minh", mjk: "minh", mjnh: "minh",
  bn: "bao nhieu", bnh: "bao nhieu", bnhieu: "bao nhieu", nhiu: "nhieu",
  sl: "so luong", vs: "voi", cx: "cung", ms: "moi", lun: "luon",
  hnay: "hom nay", hum: "hom", ntn: "nhu the nao",
  oke: "ok", oki: "ok", okela: "ok", okie: "ok",
};

/** Expands chat shorthand on folded text. Returns folded, expanded text. */
export function expandShorthand(text: string): string {
  return foldText(text)
    .split(" ")
    .filter(Boolean)
    .map((token) => SHORTHAND[token] ?? token)
    .join(" ");
}

const DIGIT: Record<string, number> = {
  mot: 1, hai: 2, ba: 3, bon: 4, tu: 4, nam: 5, lam: 5, sau: 6, bay: 7, tam: 8, chin: 9,
};

export interface PriceConstraint {
  maxPrice?: number;
  minPrice?: number;
  /** "khoảng 50k": a target, not a strict bound. Reported, never auto-applied. */
  approximate?: number;
  /** "mỗi người 50k": the amount is per person, not a basket total. */
  perPerson?: boolean;
  /** A bound cue was present but the amount was unusable (e.g. reversed range). */
  ambiguousAmount?: boolean;
  /** "dưới 50" was read as 50.000đ; nothing on the menu costs under 1.000đ. */
  assumedThousands?: boolean;
}

interface Amount { value: number; start: number; end: number; unitless: boolean }

/** Finds VND amounts in folded text: 50k, 50 nghin, 50.000d, 1tr2, nua trieu, nam chuc, hai tram ruoi. */
export function findVndAmounts(folded: string): Amount[] {
  const found: Amount[] = [];
  const take = (match: RegExpExecArray, value: number, unitless = false) => {
    if (found.some((a) => match.index < a.end && match.index + match[0].length > a.start)) return;
    found.push({ value: Math.round(value), start: match.index, end: match.index + match[0].length, unitless });
  };
  let m: RegExpExecArray | null;
  // 1tr2 / 1 trieu 2 / 1.5 trieu
  // Decimal separators arrive as "p" (see prepareAmounts): 1p5 trieu.
  const million = /\b(\d+(?:p\d+)?)\s*(?:tr|trieu|cu)(?:\s*(\d))?\b/g;
  while ((m = million.exec(folded))) {
    const base = Number(m[1].replace("p", "."));
    take(m, (base + (m[2] ? Number(m[2]) / 10 : 0)) * 1_000_000);
  }
  const halfMillion = /\bnua trieu\b/g;
  while ((m = halfMillion.exec(folded))) take(m, 500_000);
  // written: hai tram (ruoi) (nghin), nam chuc (nghin), nam muoi (lam) nghin
  const written = /\b(mot|hai|ba|bon|tu|nam|sau|bay|tam|chin)\s+(tram|chuc|muoi)(?:\s+(ruoi|mot|hai|ba|bon|tu|nam|lam|sau|bay|tam|chin))?(?:\s+(nghin|ngan|k|canh))?\b/g;
  while ((m = written.exec(folded))) {
    const lead = DIGIT[m[1]];
    let value: number;
    if (m[2] === "tram") value = lead * 100 + (m[3] === "ruoi" ? 50 : 0);
    else value = lead * 10 + (m[3] && m[3] !== "ruoi" ? DIGIT[m[3]] : 0);
    // "nam chuc" is already thousands in speech; "hai tram" too.
    take(m, value * 1000);
  }
  // 50k / 50 nghin / 50 ngan / 50 canh / 50.000 / 50000d / 50.000 vnd
  const numeric = /\b(\d+)(?:\s*(k|ka|nghin|ngan|canh|d|vnd|dong))?\b/g;
  while ((m = numeric.exec(folded))) {
    const raw = Number(m[1]);
    const unit = m[2];
    if (unit && ["k", "ka", "nghin", "ngan", "canh"].includes(unit)) take(m, raw * 1000);
    else if (raw >= 1000) take(m, raw);
    else take(m, raw, true);
  }
  return found.sort((a, b) => a.start - b.start);
}

/** Folding strips "." and ","; keep their meaning first: 100.000 -> 100000, 1,5 -> 1p5. */
function prepareAmounts(text: string): string {
  return expandShorthand(
    text.replace(/(\d)[.,](?=\d{3}(?!\d))/g, "$1").replace(/(\d)[.,](\d)/g, "$1p$2"),
  );
}

/**
 * Money amounts written in free text ("45.000 ₫", "45k", "1tr2", "200 nghìn").
 * Bare small numbers ("2 người", "3 miếng") are not money and are skipped.
 */
export function extractVndAmounts(text: string): number[] {
  return findVndAmounts(prepareAmounts(text)).filter((amount) => !amount.unitless).map((amount) => amount.value);
}

const MAX_CUES = /(?:duoi|khong qua|khong vuot qua|toi da|nho hon|re hon|it hon|trong tam|<=|<|ngan sach|budget|chi co|co|voi|max|nguoi)\s*$/;
const MAX_AFTER = /^\s*(?:do lai|tro xuong|tro lai|thoi|max|toi da)\b/;
const MIN_AFTER = /^\s*(?:tro len|do len)\b/;
const MIN_CUES = /(?:tren|tu|it nhat|toi thieu|lon hon|dat hon|nhieu hon|>=|>|min)\s*$/;
// "tầm 50k" is a target; "trong tầm 50k" is a ceiling.
const APPROX_CUES = /(?:khoang|tam|chung|xap xi)\s*$/;
const STRICT_TAM = /trong tam\s*$/;

/**
 * Reads a price constraint only when a bound cue surrounds the amount, so
 * numbers inside product names ("Xô Zòn Zã 159K") are never taken as budgets.
 */
export function parsePriceConstraint(text: string): PriceConstraint {
  const folded = prepareAmounts(text);
  const amounts = findVndAmounts(folded);
  const result: PriceConstraint = {};
  // Range: (tu) X den/toi Y, or "50k-100k" (folding removes the dash).
  for (let i = 0; i + 1 < amounts.length; i++) {
    const between = folded.slice(amounts[i].end, amounts[i + 1].start).trim();
    const [first, second] = [amounts[i], amounts[i + 1]];
    // Two bare numbers ("2 3") are not a price range.
    if (!/^(?:den|toi)?$/.test(between) || (first.unitless && second.unitless)) continue;
    amounts.splice(i, 2);
    // "50 đến 100k": the unit on the upper bound applies to the lower one.
    const bottom = first.unitless ? first.value * 1000 : first.value;
    const top = second.unitless ? second.value * 1000 : second.value;
    if (second.unitless) result.assumedThousands = true;
    if (bottom > top) result.ambiguousAmount = true;
    else { result.minPrice = bottom; result.maxPrice = top; }
    break;
  }
  for (const amount of amounts) {
    const before = folded.slice(Math.max(0, amount.start - 24), amount.start);
    const after = folded.slice(amount.end, amount.end + 16);
    const kind = MAX_AFTER.test(after) ? "max" : MIN_AFTER.test(after) ? "min"
      : STRICT_TAM.test(before) ? "max" : APPROX_CUES.test(before) ? "approx"
      : MIN_CUES.test(before) ? "min" : MAX_CUES.test(before) ? "max" : null;
    if (!kind) continue;
    // A bare "50" next to a price cue means 50.000đ in speech; flag the assumption.
    const value = amount.unitless ? amount.value * 1000 : amount.value;
    if (amount.unitless) result.assumedThousands = true;
    if (kind === "max") result.maxPrice = value;
    else if (kind === "min") result.minPrice = value;
    else result.approximate = value;
  }
  if (/\b(?:moi nguoi|1 nguoi|mot nguoi|nguoi mot|per person|dau nguoi)\b/.test(folded) &&
      (result.maxPrice !== undefined || result.approximate !== undefined))
    result.perPerson = true;
  return result;
}
