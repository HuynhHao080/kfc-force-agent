import { normalizeVietnamese } from "@/lib/services/menu-service";
const digit: Record<string, number> = {
  khong: 0,
  mot: 1,
  hai: 2,
  ba: 3,
  bon: 4,
  tu: 4,
  nam: 5,
  lam: 5,
  sau: 6,
  bay: 7,
  tam: 8,
  chin: 9,
};
const word =
  "không|khong|một|mốt|mot|hai|ba|bốn|bon|tư|tu|năm|nam|lăm|lam|sáu|sau|bảy|bay|tám|tam|chín|chin|mười|mươi|muoi|trăm|tram|linh|lẻ|le|âm|am";
const wordNumbers = new RegExp(
  "(?<![\\p{L}\\p{N}])(?:" +
    word +
    ")(?:\\s+(?:" +
    word +
    "))*(?![\\p{L}\\p{N}])",
  "giu",
);
function tens(tokens: string[]): number | undefined {
  if (tokens.length === 1) return tokens[0] === "muoi" ? 10 : digit[tokens[0]];
  if (tokens.length === 2 && tokens[0] === "muoi" && digit[tokens[1]] > 0)
    return 10 + digit[tokens[1]];
  if (
    (tokens.length === 2 || tokens.length === 3) &&
    digit[tokens[0]] >= 2 &&
    tokens[1] === "muoi"
  ) {
    const unit = tokens.length === 3 ? digit[tokens[2]] : 0;
    if (unit !== undefined) return digit[tokens[0]] * 10 + unit;
  }
}
function writtenNumber(phrase: string): number | undefined {
  const tokens = normalizeVietnamese(phrase).split(" ");
  const sign = tokens[0] === "am" ? (tokens.shift(), -1) : 1;
  let value: number | undefined;
  if (tokens[1] === "tram" && digit[tokens[0]] > 0) {
    const hundreds = digit[tokens[0]] * 100,
      rest = tokens.slice(2);
    if (rest[0] === "linh" || rest[0] === "le") rest.shift();
    const tail = rest.length ? tens(rest) : 0;
    if (tail !== undefined) value = hundreds + tail;
  } else value = tens(tokens);
  return value === undefined ? undefined : sign * value;
}
function polite(text: string) {
  for (let index = 0; index < 3; index++)
    text = text.replace(/^(?:ban oi|lam on|vui long|hay)\s+/, "");
  return text.replace(/\s+(?:nhe|nha|a)(?:\s+(?:ban|a))?$/, "").trim();
}
/** Conservative lexical parsing only. No cart reads, arithmetic on cart or execution. */
export function prepareMockMessage(message: string) {
  const quantities: { value: number | undefined; ambiguous: boolean }[] = [];
  const sizes: string[] = [];
  let ambiguous = /\bkfc(?:qty|size)\d+token\b/i.test(message);
  let masked = message
    .normalize("NFC")
    .replace(
      /(?<![\p{L}\p{N}])\d+(?:[.,]\d+)?\s*(?:ml|lít|lit|l)\b/giu,
      (value) => {
        const index =
          sizes.push(
            normalizeVietnamese(
              value
                .replace(/\s+/g, "")
                .replace(/lít|lit/gi, "l")
                .replace(",", "."),
            ),
          ) - 1;
        return "kfcsize" + index + "token";
      },
    );
  const punctuation = masked.replace(/(\d),(\d)/g, "$1.$2");
  const text = polite(normalizeVietnamese(masked));
  masked = masked.replace(wordNumbers, (phrase) => {
    const value = writtenNumber(phrase),
      index = quantities.push({ value, ambiguous: value === undefined }) - 1;
    return "kfcqty" + index + "token";
  });
  masked = masked.replace(
    /(?<![\w.,])([+-]?\d+(?:[.,]\d+)?)(?![\w.,])/g,
    (raw) => {
      const value = Number(raw.replace(",", "."));
      const index =
        quantities.push({
          value,
          ambiguous: /[.,]/.test(raw) && Number.isInteger(value),
        }) - 1;
      return "kfcqty" + index + "token";
    },
  );
  const normalized = polite(normalizeVietnamese(masked));
  if (/\d/.test(masked.replace(/kfc(?:qty|size)\d+token/g, "")))
    ambiguous = true;
  ambiguous ||=
    quantities.length > 1 ||
    quantities.some((q) => q.ambiguous) ||
    /\b\d+e\d+\b/i.test(masked);
  if (quantities.length === 1) {
    const prefix = normalized
      .slice(0, normalized.indexOf("kfcqty0token"))
      .trim();
    const leading =
      /^(?:(?:them|add|lay|goi|mua|xoa|bo|remove|huy)(?: mon)?(?: giup)?(?: (?:minh|toi|em))?(?: giup)?|cho (?:minh|toi|em)(?: them)?|(?:minh|toi|em) (?:muon|can|lay)(?: them)?)$/;
    if (!leading.test(prefix) && !/^.*\b(?:thanh|len|con|xuong)$/.test(prefix))
      ambiguous = true;
  }
  // Do not infer a count from vague, fractional, paired or conditional requests.
  ambiguous ||=
    /\b(?:vai|may|nua|ruoi|chuc|nghin|ngan|trieu|khoang|hon|it nhat|toi da|mot it|mot so)\b/.test(
      text,
    ) || /kfcqty\d+token\s+(?:cap|doi|lit|l|ml)\b/.test(normalized);
  const multiple =
    /[,;\n\r]/.test(punctuation) ||
    /\b(?:va|roi|sau do|hoac|nhung|thay vi|neu|khi)\b/.test(text);
  return {
    text,
    queryText: normalized.replace(/kfcqty\d+token/g, " "),
    quantity: quantities[0]?.value,
    ambiguous,
    multiple,
    sizes,
  };
}
export function restoreMockSizes(query: string, sizes: string[]) {
  return query.replace(
    /kfcsize(\d+)token/g,
    (_, index) => sizes[Number(index)] ?? "",
  );
}
