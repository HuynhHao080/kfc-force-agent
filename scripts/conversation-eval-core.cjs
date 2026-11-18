/* Scoring core for the multi-turn agent conversation evaluation. Pure functions, no I/O.
 * Every check returns { name, ok, detail } so a failed turn says exactly why. */

/** Fold for comparison: no diacritics, lower case, single spaces (punctuation kept, so "20.000" stays). */
const fold = (value) => String(value ?? "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D")
  .toLowerCase().replace(/\s+/g, " ").trim();

const SAFE_FALLBACK = "Xin lỗi, mình chưa trả lời chắc chắn được.";

/** Parses one server-written proposal summary line (agent-core describeActions). */
function parseSummaryLine(line) {
  const text = String(line).normalize("NFC").replace(/\s+/g, " ").trim();
  let m;
  if ((m = /^Thêm (\d+) × (.+?): /.exec(text))) return { action: "add", quantity: Number(m[1]), name: m[2] };
  if ((m = /^Đổi (.+?) thành (\d+) phần/.exec(text))) return { action: "update", quantity: Number(m[2]), name: m[1] };
  if (/^Xoá toàn bộ/.test(text)) return { action: "clear" };
  if ((m = /^Xoá (.+?) khỏi giỏ hàng/.exec(text))) return { action: "remove", name: m[1] };
  return { action: "unknown", raw: text };
}

function proposalLines(response) {
  if (!response?.requiresConfirmation) return [];
  return (response.pendingConfirmation?.summary ?? []).map(parseSummaryLine);
}

/** Validates the dataset against the live catalog: every named product must exist and be on sale. */
function validateDataset(dataset, catalog) {
  const problems = [];
  const byName = new Map(catalog.map((item) => [fold(item.name), item]));
  const ids = new Set();
  const retired = new Set((dataset.catalogState?.retired ?? []).map(fold));
  const checkName = (where, name) => {
    const item = byName.get(fold(name));
    if (!item) problems.push(`${where}: "${name}" không có trong catalog`);
    else if (retired.has(fold(name))) return;
    else if (!item.isActive || !item.isAvailable) problems.push(`${where}: "${name}" không còn bán`);
  };
  for (const cv of dataset.conversations ?? []) {
    if (!/^CV-\d{2,}$/.test(cv.id ?? "")) problems.push(`id không hợp lệ: ${cv.id}`);
    if (ids.has(cv.id)) problems.push(`trùng id ${cv.id}`);
    ids.add(cv.id);
    if (!cv.turns?.length) problems.push(`${cv.id}: không có lượt nào`);
    let pendingPossible = false;
    (cv.turns ?? []).forEach((turn, index) => {
      const where = `${cv.id}#${index + 1}`;
      if (!!turn.user === !!turn.confirm) problems.push(`${where}: mỗi lượt phải có đúng một trong "user" hoặc "confirm"`);
      if (turn.user !== undefined && (typeof turn.user !== "string" || !turn.user.trim())) problems.push(`${where}: "user" rỗng`);
      if (turn.confirm && !pendingPossible) problems.push(`${where}: xác nhận nhưng lượt trước không kỳ vọng đề xuất`);
      const e = turn.expect ?? {};
      for (const item of e.proposal?.items ?? []) for (const name of item.anyOf ?? []) checkName(where, name);
      for (const item of e.proposalOrClarify?.items ?? []) for (const name of item.anyOf ?? []) checkName(where, name);
      if (Array.isArray(e.cart)) for (const line of e.cart) checkName(where, line.name);
      for (const name of e.mustNotRecommend ?? []) if (!byName.has(fold(name))) problems.push(`${where}: "${name}" không có trong catalog`);
      pendingPossible = !!(e.proposal || e.proposalOrClarify);
    });
  }
  return problems;
}

function matchProposal(spec, lines, catalogByName) {
  const checks = [];
  const add = (name, ok, detail) => checks.push({ name, ok, detail });
  if (!lines.length) { add("proposal", false, "không có đề xuất nào"); return checks; }
  const wrongAction = lines.filter((l) => l.action !== spec.action);
  add("proposal.action", wrongAction.length === 0, wrongAction.length ? `có dòng ${wrongAction.map((l) => l.action).join(",")} thay vì ${spec.action}` : spec.action);
  if (spec.items) {
    const used = new Set();
    for (const want of spec.items) {
      const index = lines.findIndex((line, i) => !used.has(i) && want.anyOf.some((n) => fold(n) === fold(line.name)));
      if (index < 0) { add("proposal.item", false, `thiếu ${want.anyOf.join(" | ")}; có: ${lines.map((l) => l.name).join(", ")}`); continue; }
      used.add(index);
      if (want.quantity !== undefined) add("proposal.quantity", lines[index].quantity === want.quantity, `${lines[index].name}: ${lines[index].quantity} (cần ${want.quantity})`);
    }
    add("proposal.noExtra", lines.length === spec.items.length, `${lines.length} dòng, cần ${spec.items.length}`);
  }
  if (spec.quantity !== undefined)
    add("proposal.quantity", lines.every((l) => l.quantity === spec.quantity), lines.map((l) => `${l.name}×${l.quantity}`).join(", "));
  const price = (line) => catalogByName.get(fold(line.name))?.price;
  if (spec.maxTotal !== undefined) {
    const total = lines.reduce((sum, l) => sum + (price(l) ?? Infinity) * (l.quantity ?? 1), 0);
    add("proposal.maxTotal", total <= spec.maxTotal, `tổng ${total}, trần ${spec.maxTotal}`);
  }
  if (spec.maxUnitPrice !== undefined)
    add("proposal.maxUnitPrice", lines.every((l) => (price(l) ?? Infinity) <= spec.maxUnitPrice), lines.map((l) => `${l.name}=${price(l)}`).join(", "));
  return checks;
}

/**
 * Scores one turn.
 * ctx: { turn, response, cart: [{name, quantity}] | null, cartTotal, catalog: [{id,name,price,isActive,isAvailable}],
 *        guard: (reply) => {ok, problems} }
 */
function scoreTurn(ctx) {
  const { turn, response } = ctx;
  const e = turn.expect ?? {};
  const checks = [];
  const add = (name, ok, detail = "") => checks.push({ name, ok: !!ok, detail });
  const reply = String(response?.reply ?? "");
  const r = fold(reply);
  const lines = proposalLines(response);
  const catalogByName = new Map(ctx.catalog.map((item) => [fold(item.name), item]));
  const catalogById = new Map(ctx.catalog.map((item) => [item.id, item]));
  const products = (response?.products ?? []).map((p) => catalogById.get(p.id) ?? p);

  // Universal checks.
  add("noError", !response?.error && reply.length > 0, response?.error ?? "");
  if (!turn.confirm) {
    add("notFallback", !reply.startsWith(SAFE_FALLBACK), reply.startsWith(SAFE_FALLBACK) ? "agent trả câu dự phòng" : "");
    const guard = ctx.guard(reply);
    add("factCheck", guard.ok, guard.problems.join(" | "));
  }

  if (e.proposal === null) add("noProposal", lines.length === 0, lines.map((l) => `${l.action} ${l.name ?? ""}`).join(", "));
  else if (e.proposal) checks.push(...matchProposal(e.proposal, lines, catalogByName));
  if (e.proposalOrClarify) {
    const asked = lines.length === 0 && reply.includes("?");
    const proposed = matchProposal(e.proposalOrClarify, lines, catalogByName);
    add("proposalOrClarify", asked || proposed.every((c) => c.ok), asked ? "hỏi lại" : proposed.filter((c) => !c.ok).map((c) => c.detail).join("; "));
  }
  if (e.clarify) add("clarify", lines.length === 0 && reply.includes("?"), lines.length ? "đề xuất thay vì hỏi lại" : "không có câu hỏi");
  for (const name of e.proposalMustNotInclude ?? [])
    add("proposalMustNotInclude", !lines.some((l) => fold(l.name).includes(fold(name))), `${name}: ${lines.map((l) => l.name).join(", ")}`);
  for (const group of e.mention ?? [])
    add("mention", group.some((s) => r.includes(fold(s))), `cần một trong: ${group.join(" | ")}`);
  for (const s of e.mustNot ?? []) add("mustNot", !r.includes(fold(s)), s);
  for (const name of e.mustNotRecommend ?? []) {
    const shown = products.some((p) => fold(p.name) === fold(name)) || lines.some((l) => fold(l.name) === fold(name));
    add("mustNotRecommend", !shown, name);
  }
  if (e.minProducts !== undefined) add("minProducts", products.length >= e.minProducts, `${products.length} thẻ món, cần ≥ ${e.minProducts}`);
  if (e.maxProductPrice !== undefined) {
    const over = products.filter((p) => !(p.price <= e.maxProductPrice));
    add("maxProductPrice", over.length === 0, over.map((p) => `${p.name}=${p.price}`).join(", "));
  }
  if (e.cart !== undefined || e.cartLines !== undefined || e.minCartLines !== undefined || e.mentionCartTotal) {
    if (!ctx.cart) add("cart", false, "không đọc được giỏ (chỉ hỗ trợ target local)");
    else {
      if (e.cart === "empty") add("cart", ctx.cart.length === 0, ctx.cart.map((l) => `${l.name}×${l.quantity}`).join(", "));
      else if (Array.isArray(e.cart)) {
        const have = ctx.cart.map((l) => `${fold(l.name)}×${l.quantity}`).sort().join(", ");
        const want = e.cart.map((l) => `${fold(l.name)}×${l.quantity}`).sort().join(", ");
        add("cart", have === want, `có [${have}], cần [${want}]`);
      }
      if (e.cartLines !== undefined) add("cartLines", ctx.cart.length === e.cartLines, `${ctx.cart.length} dòng, cần ${e.cartLines}`);
      // A suggestion such as "phương án 1" may hold several products.
      if (e.minCartLines !== undefined) add("minCartLines", ctx.cart.length >= e.minCartLines, `${ctx.cart.length} dòng, cần ≥ ${e.minCartLines}`);
      if (e.mentionCartTotal) {
        const total = ctx.cartTotal ?? 0;
        const forms = [total.toLocaleString("vi-VN"), String(total), `${Math.round(total / 1000)}k`, `${Math.round(total / 1000)} nghin`].map(fold);
        add("mentionCartTotal", total > 0 && forms.some((f) => r.includes(f)), `tổng giỏ ${total}`);
      }
    }
  }
  return { pass: checks.every((c) => c.ok), checks };
}

module.exports = { fold, parseSummaryLine, proposalLines, validateDataset, scoreTurn };
