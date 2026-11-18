import { normalizeVietnamese } from "@/lib/menu-search";

/**
 * Fact check of a model-written reply before a customer sees it.
 *
 * Principle: check facts, not phrasing or arithmetic. The model may word the
 * answer freely, compare, add up, compute what is left of a budget or split it
 * per person (the server recomputes every real total when a change is proposed
 * or confirmed). It may NOT:
 *   1. attach a wrong price to a real product ("Burger Tôm 40.000 ₫");
 *   2. offer a sold-out or retired product without saying it is unavailable;
 *   3. claim that a cart change, order or payment has happened (it can only
 *      propose; the customer confirms with the button);
 *   4. link anywhere except kfcvietnam.com.vn;
 *   5. list a product whose name uses words found in no real product or menu
 *      group ("Pepsi Zero", "Nước cam", "cà phê" when KFC sells none of them),
 *      as a bullet or in an enumeration ("có nước ngọt, cà phê, trà");
 *   6. put a price on something that is not a product ("Gà rán – từ 25–50 nghìn")
 *      in a bullet that is not a total or budget line;
 *   7. open with "Xong" before the customer has confirmed anything;
 *   8. tell the customer to press “Xác nhận thao tác” when no proposal is waiting.
 */
/** `retired`: no longer on the KFC menu at all (not just sold out right now). */
export interface CatalogFact { id: string; name: string; price: number; available: boolean; retired?: boolean; category?: string }
export interface Evidence {
  catalog: CatalogFact[];
  /** A cart proposal is waiting for the customer's button (this turn or an earlier one). Unknown when omitted. */
  proposalPending?: boolean;
}

export interface GuardResult {
  ok: boolean;
  problems: string[];
  /** Available catalog items the reply names, in order (for product cards). */
  referencedIds: string[];
}

const COMPLETION_CLAIMS =
  /\b(?:da (?:them|dat|xoa|bo|cap nhat|thanh toan|doi|sua|giam|tang|huy)|dat hang thanh cong|thanh toan thanh cong|da duoc (?:them|dat|xoa|cap nhat)|don hang cua ban da)\b/;
const UNAVAILABLE_WORDS = /\b(?:het|tam het|ngung|khong con|khong ban)\b/;
const MAX_REPLY_CHARS = 1500;
/** Grammar and quantity words that may appear in a bullet head without being part of a product name. */
const LIST_WORDS = new Set(("cac loai mon phan va hoac hay voi kem them co cho ban minh nguoi size cai ly lon chai " +
  "mot hai ba bon nam x khac do nhe nua gi nao the la cung nhieu thuong").split(" "));
/** A bullet with an amount but no product is fine only when it is arithmetic over the customer's own choice. */
const TOTAL_WORDS = /\b(?:tong|cong|con du|con lai|du|thieu|moi nguoi|chia|ngan sach|tat ca)\b/;
const BULLET = /^\s*(?:[-•*+]|\d+[.)])\s+(.+)$/;

/** Money written in folded text: "45 000", "45000", "45k", "1tr2". Returns value and position. */
function amounts(folded: string): { value: number; at: number }[] {
  const found: { value: number; at: number }[] = [];
  const pattern = /\b(\d{1,3}(?: \d{3})+|\d{4,})\b|\b(\d+) ?(?:k|nghin|ngan)\b|\b(\d+) ?(?:tr|trieu) ?(\d)?\b/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(folded))) {
    const value = match[1] ? Number(match[1].replace(/ /g, ""))
      : match[2] ? Number(match[2]) * 1000
      : (Number(match[3]) + (match[4] ? Number(match[4]) / 10 : 0)) * 1_000_000;
    if (value >= 1000) found.push({ value, at: match.index });
  }
  return found;
}

/** "46.000 ₫) = 184.000 ₫" must read as two amounts, not one: separate digits joined only by symbols. */
const separateNumbers = (value: string) => value.replace(/(\d)([^\p{L}\d]*[^\p{L}\d\s.,][^\p{L}\d]*)(?=\d)/gu, "$1 x ");

/** Words of a bullet's product part: after a leading quantity, before a price, dash, colon or bracket. */
function bulletHead(body: string): string {
  return body.replace(/^\d+\s*[x×]\s*|^\d+\s+/i, "").split(/\s[-–—]\s|:|\(|\s\d/)[0];
}

export function checkReply(reply: string, evidence: Evidence): GuardResult {
  const problems: string[] = [];
  const text = reply.normalize("NFC").trim();
  if (!text) problems.push("Câu trả lời rỗng.");
  if (text.length > MAX_REPLY_CHARS) problems.push(`Câu trả lời dài quá ${MAX_REPLY_CHARS} ký tự.`);
  if (/^xong\b/.test(normalizeVietnamese(text)))
    problems.push("Đừng mở đầu bằng \"Xong\": giỏ chưa đổi cho tới khi khách bấm nút Xác nhận.");
  if (COMPLETION_CLAIMS.test(normalizeVietnamese(text)))
    problems.push("Không được nói đã thêm/đặt/xoá/cập nhật/thanh toán: bạn chỉ đề xuất, khách phải bấm nút Xác nhận.");
  // Only an instruction to press the button now is wrong without a proposal; explaining how
  // confirmation works ("mình không thể tự xác nhận, chỉ khi bạn bấm…") is fine.
  const pressNow = text.split(/[.!?\n]/).map((sentence) => ` ${normalizeVietnamese(sentence)} `)
    .some((sentence) => sentence.includes("xac nhan thao tac") && !/ (?:khong|chua|chi|sau khi|neu|khi nao) /.test(sentence));
  if (evidence.proposalPending === false && pressNow)
    problems.push("Chưa có đề xuất nào chờ khách xác nhận: muốn thêm/đổi/xoá thì gọi propose_cart_change trước, nếu không thì đừng nhắc nút “Xác nhận thao tác”.");
  for (const url of text.match(/https?:\/\/\S+/gi) ?? [])
    if (!/^https:\/\/kfcvietnam\.com\.vn(?:\/|$)/i.test(url)) problems.push("Chỉ được dẫn link kfcvietnam.com.vn.");

  const names = evidence.catalog
    .map((item) => ({ ...item, key: normalizeVietnamese(item.name) }))
    .filter((item) => item.key.length >= 5)
    .sort((a, b) => b.key.length - a.key.length);
  const referencedIds: string[] = [];

  // A bullet introduces a product: every word of its head must exist somewhere in the real menu.
  const vocabulary = new Set(evidence.catalog.flatMap((item) => normalizeVietnamese(`${item.name} ${item.category ?? ""}`).split(" ")));
  if (vocabulary.size > 0) {
    for (const line of text.split("\n")) {
      const bullet = BULLET.exec(line);
      if (!bullet) continue;
      // "7Up" keeps its digit (no space after it).
      const head = bulletHead(bullet[1]);
      // "- Tổng: 57.000 ₫", "- Còn dư 3.000 ₫" are arithmetic lines, not products.
      if (new RegExp(`^(?:${TOTAL_WORDS.source})`).test(normalizeVietnamese(head))) continue;
      // Only bullets shaped like a product are checked: with an amount or a "+" composition, or
      // short and not a question. "- Hay bạn muốn mình tìm các combo sẵn có?" or
      // "- Xem bảng thành phần trên trang KFC" are sentences, not products.
      const headWords = normalizeVietnamese(head).split(" ").filter(Boolean);
      const productShaped = amounts(` ${normalizeVietnamese(separateNumbers(line))} `).length > 0 || line.includes("+")
        || (headWords.length <= 5 && !/\?\s*$/.test(line));
      if (!productShaped) continue;
      const unknown = headWords.filter((word) => !vocabulary.has(word) && !LIST_WORDS.has(word));
      if (unknown.length) problems.push(`"${head.trim()}" không có trong thực đơn; chỉ nhắc món có trong kết quả search_menu.`);
    }
    // An enumeration in prose ("có nước ngọt, cà phê, trà hay…") lists products too. It is
    // recognised by shape: three or more items, every one short. A sentence that merely has
    // clauses ("…gần bạn, mình có thể giúp tìm địa chỉ và liên hệ") is not an enumeration.
    // "13.000" does not end a sentence; bracketed notes ("(13.000 ₫)") are not item names.
    for (const sentence of text.split(/[.?!](?!\d)|\n/)) {
      if (BULLET.test(sentence)) continue;
      const parts = sentence.replace(/\([^)]*\)/g, " ").split(/,|\s(?:hay|hoặc|và)\s/)
        .map((part) => part.trim()).filter(Boolean);
      const words = parts.map((part) => normalizeVietnamese(part).split(" ").filter(Boolean));
      if (parts.length < 3 || words.some((item) => item.length > 4)) continue;
      const unknown = (word: string) => !vocabulary.has(word) && !LIST_WORDS.has(word);
      parts.forEach((part, index) => {
        // The first part carries the lead-in ("Bạn thích gà rán", "Có nước ngọt"): its item is at the end.
        if (index === 0 ? unknown(words[0].at(-1) ?? "") : words[index].some(unknown))
          problems.push(`"${part}" không có trong thực đơn; chỉ nhắc món có trong kết quả search_menu.`);
      });
    }
  }

  // Check each clause separately: a price belongs to the product named just before it.
  for (const clause of text.split(/\n|;|\s\/\s/)) {
    const original = ` ${normalizeVietnamese(separateNumbers(clause))} `;
    let folded = original;
    const hits: { item: (typeof names)[number]; at: number; end: number }[] = [];
    for (const item of names) {
      let at = folded.indexOf(` ${item.key} `);
      while (at >= 0) {
        hits.push({ item, at, end: at + item.key.length + 1 });
        // Blank the match so a shorter name inside it ("Pepsi (Lon)" in "Pepsi Không Đường (Lon)") is not counted twice.
        folded = folded.slice(0, at + 1) + "#".repeat(item.key.length) + folded.slice(at + 1 + item.key.length);
        at = folded.indexOf(` ${item.key} `, at + 1);
      }
    }
    hits.sort((a, b) => a.at - b.at);
    // A size or variant line under a product ("- Vừa: 17.000 ₫" after "Pepsi") is fine when a real
    // item whose name holds those words costs exactly that; "- Gà rán – từ 25–50 nghìn" is not.
    const bulletBody = BULLET.exec(clause)?.[1];
    const variantPrice = () => {
      const alternatives = bulletHead(bulletBody ?? "").split("/").map((part) =>
        normalizeVietnamese(part).split(" ").filter((word) => word && !LIST_WORDS.has(word))).filter((words) => words.length);
      const candidates = evidence.catalog.filter((item) => {
        const nameWords = new Set(normalizeVietnamese(item.name).split(" "));
        return alternatives.some((words) => words.every((word) => nameWords.has(word)));
      });
      return amounts(original).every((m) => candidates.some((item) => m.value % item.price === 0 && m.value / item.price <= 20));
    };
    if (bulletBody && hits.length === 0 && amounts(original).length > 0 && !TOTAL_WORDS.test(original) && !variantPrice())
      problems.push(`"${clause.trim()}": số tiền phải gắn với một món cụ thể có trong kết quả search_menu (tên và giá đúng), không ước lượng theo nhóm.`);
    // Amounts are read from the unblanked clause: positions are identical, and names
    // that contain numbers ("Xô Zòn Zã 159K") are skipped because they lie inside a hit.
    const money = amounts(original).filter((m) => !hits.some((hit) => m.at > hit.at && m.at < hit.end));
    hits.forEach((hit, index) => {
      const nextName = hits[index + 1]?.at ?? Infinity;
      // Only an amount right after the name is its price ("Burger Tôm (45.000 ₫)",
      // "Burger Tôm: giá 45.000 ₫"); "…Mì Ý Gà Viên, tổng 88.000 ₫" is a total, not a price.
      const price = money.find((m) => m.at >= hit.end && m.at < nextName &&
        /^\s*(?:(?:gia|chi|la|co gia|moi phan|1 phan|mot phan)\s*)?$/.test(original.slice(hit.end, m.at)));
      // A product's price may be stated per unit or for several units ("2 × Pepsi (Đại): 40.000 ₫").
      if (price && !(price.value % hit.item.price === 0 && price.value / hit.item.price <= 20))
        problems.push(`Giá của "${hit.item.name}" là ${hit.item.price.toLocaleString("vi-VN")} ₫, không phải ${price.value.toLocaleString("vi-VN")} ₫.`);
      if (!hit.item.available && !UNAVAILABLE_WORDS.test(original))
        problems.push(hit.item.retired
          ? `"${hit.item.name}" đã ngừng bán (KFC không còn món này); nói rõ với khách và gợi ý món đang bán.`
          : `"${hit.item.name}" đang tạm hết; nói rõ với khách thay vì gợi ý món này.`);
      if (hit.item.available) referencedIds.push(hit.item.id);
    });
  }
  return { ok: problems.length === 0, problems: [...new Set(problems)], referencedIds: [...new Set(referencedIds)] };
}
