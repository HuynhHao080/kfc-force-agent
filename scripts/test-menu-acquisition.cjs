/* eslint-disable @typescript-eslint/no-require-imports -- Offline project TS loader and local fixtures. */
require("./register-typescript.cjs");
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const net = require("node:net");
const http = require("node:http");
const https = require("node:https");
// Install BEFORE importing pipeline modules. Any attempted network is a failure.
const networkCalls = [];
function noNetwork() { networkCalls.push(true); throw new Error("Network forbidden in acquisition tests"); }
global.fetch = noNetwork;
net.Socket.prototype.connect = noNetwork;
net.Server.prototype.listen = noNetwork;
require("node:tls").connect = noNetwork;
http.request = http.get = https.request = https.get = noNetwork;
const { readSnapshot, MAX_SNAPSHOT_BYTES } = require("../src/lib/menu/acquisition/snapshot-reader.ts");
const { normalizeSnapshot } = require("../src/lib/menu/acquisition/normalize.ts");
const { diffStaging } = require("../src/lib/menu/acquisition/diff.ts");
const { menuAcquisitionManifestSchema } = require("../src/lib/validation/menu-acquisition.ts");
const { menuDatasetSchema } = require("../src/lib/validation/menu-data.ts");
const fixtures = path.join(__dirname, "../tests/fixtures/menu/acquisition");
const rawFixture = fs.readFileSync(path.join(fixtures, "demo.snapshot.json"));
const manifestFixture = JSON.parse(fs.readFileSync(path.join(fixtures, "demo.manifest.json"), "utf8"));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "kfc-acquisition-"));
const hash = (b) => crypto.createHash("sha256").update(b).digest("hex");
const source = () => JSON.parse(rawFixture);
const manifest = () => structuredClone(manifestFixture);
const checkCode = (result, code, status = "rejected") => {
  assert.equal(result.status, status, JSON.stringify(result));
  assert.ok(result.issues.some((i) => i.code === code), JSON.stringify(result.issues));
  assert.equal(result.dataset, undefined);
};
async function intake(raw = rawFixture, m = manifest(), changeManifest = () => {}) {
  m = structuredClone(m);
  const dir = fs.mkdtempSync(path.join(temp, "case-"));
  const bytes = Buffer.isBuffer(raw) ? raw : Buffer.from(typeof raw === "string" ? raw : JSON.stringify(raw));
  m.payloadPath = m.contentType === "text/html" ? "snapshot.html" : "snapshot.json";
  m.contentHash = hash(bytes);
  changeManifest(m);
  // All writes are isolated synthetic test setup; pipeline only reads.
  fs.writeFileSync(path.join(dir, m.contentType === "text/html" ? "snapshot.html" : "snapshot.json"), bytes);
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(m));
  return readSnapshot({ allowedRoot: dir, manifestPath: "manifest.json" });
}
const stage = async (raw = source(), m = manifest()) => normalizeSnapshot(await intake(raw, m));
const requireStage = (r) => { assert.equal(r.status, "staged", JSON.stringify(r)); assert.equal(menuDatasetSchema.safeParse(r.dataset).success, true); return r; };
const offer = (s) => s.dataset.products.find((p) => p.name === "Burger Gà Rán");
function scoped(m, store = "test-store-a", channel = "pickup") {
  const value = (v) => ({ status: "verified", value: v, reference: "synthetic-scope-evidence", reason: null });
  m.scope.store = value(store); m.scope.region = value("test-region"); m.scope.channel = value(channel);
  return m;
}

after(() => {
  assert.deepEqual(networkCalls, [], "Pipeline attempted network access");
  // Only the exact temp root created above is removed; never application data.
  assert.ok(path.basename(temp).startsWith("kfc-acquisition-"));
  fs.rmSync(temp, { recursive: true, force: true });
});

test("checked-in manifest and exact-byte fixture are accepted offline", async () => {
  const r = await readSnapshot({allowedRoot: fixtures, manifestPath: "demo.manifest.json"});
  assert.equal(r.status, "accepted");
  assert.equal(menuAcquisitionManifestSchema.safeParse(manifestFixture).success, true);
});
test("synthetic acquisition fixture preserves S1.2 demo prices and fixed components", () => {
  const legacy=JSON.parse(fs.readFileSync(path.join(fixtures,"../demo-v1.json"),"utf8")), raw=source();
  const localToLegacy=new Map();
  for (const row of raw.products) {
    const original=legacy.products.find((p)=>p.name===row.name);
    assert.ok(original);assert.equal(row.price.current.amount,original.price.amount);
    assert.equal(row.availability,null);localToLegacy.set(row.key,original.id);
  }
  for (const combo of raw.combos) {
    const original=legacy.combos.find((c)=>c.name===combo.name);
    assert.equal(combo.price.current.amount,original.price.amount);
    assert.deepEqual(raw.comboItems.filter((c)=>c.comboKey===combo.key).map((c)=>[localToLegacy.get(c.productKey),c.quantity]),legacy.comboItems.filter((c)=>c.comboId===original.id).map((c)=>[c.productId,c.quantity]));
  }
});
test("HTTP 200 application shell is rejected", async () => {
  const m = manifest(); m.contentType = "text/html"; m.httpStatus = 200;
  checkCode(await intake(fs.readFileSync(path.join(fixtures, "shell.html")), m), "HTML_SHELL");
});
test("non-shell HTML has no implicit HTML menu parser", async () => {
  const m = manifest(); m.contentType = "text/html";
  checkCode(await intake("<table><tr><td>Menu 89000</td></tr></table>", m), "UNSUPPORTED_FORMAT");
});
test("hash mismatch fails before JSON parsing", async () => {
  checkCode(await intake("not JSON", manifest(), (m) => { m.contentHash = "0".repeat(64); }), "HASH_MISMATCH");
});
test("malformed JSON and invalid UTF-8 reject", async () => {
  checkCode(await intake("{"), "INVALID_JSON");
  checkCode(await intake(Buffer.from([0xff, 0xfe, 0xfd])), "INVALID_ENCODING");
});
test("empty menu and invalid snapshot are not accepted", async () => {
  const d = source(); d.products = []; d.combos = [];
  checkCode(await intake(d), "NO_MENU_DATA");
  checkCode(await intake(fs.readFileSync(path.join(fixtures, "invalid.json"))), "SNAPSHOT_SCHEMA", "quarantined");
});
test("oversized input is rejected before reading all bytes", async () => {
  checkCode(await intake(Buffer.alloc(MAX_SNAPSHOT_BYTES + 1, 32)), "SIZE_LIMIT");
});
for (const payloadPath of ["../outside.json", "/outside.json", "C:\\outside.json", "\\\\server\\share\\x.json", "nested/../../x.json", "snapshot.json:stream", "file:///x.json", "%2e%2e/x.json"]) {
  test(`reject unsafe payload path ${payloadPath}`, async () => {
    checkCode(await intake(rawFixture, manifest(), (m) => { m.payloadPath = payloadPath; }), "UNSAFE_PATH");
  });
}
test("manifest path cannot escape allowed root", async () => {
  checkCode(await readSnapshot({allowedRoot: fixtures, manifestPath: "../demo-v1.json"}), "UNSAFE_PATH");
});
test("symlink/junction directories cannot redirect intake outside root", async () => {
  const root = fs.mkdtempSync(path.join(temp, "link-")), outside = fs.mkdtempSync(path.join(temp, "outside-"));
  fs.writeFileSync(path.join(outside, "manifest.json"), JSON.stringify(manifest()));
  fs.symlinkSync(outside, path.join(root, "redirect"), "junction");
  checkCode(await readSnapshot({allowedRoot: root, manifestPath: "redirect/manifest.json"}), "UNSAFE_PATH");
});
test("missing files produce structured errors", async () => {
  checkCode(await readSnapshot({allowedRoot: fixtures, manifestPath: "absent.json"}), "FILE_READ");
});
test("rights unknown/unverified quarantine; denial rejects", async () => {
  for (const status of ["unknown", "unverified"]) {
    const m = manifest(); m.rights = {status, reference: null, reason: "Not reviewed"};
    checkCode(await intake(rawFixture, m), "RIGHTS_UNRESOLVED", "quarantined");
  }
  const m = manifest(); m.rights = {status: "denied", reference: null, reason: "No reuse"};
  checkCode(await intake(rawFixture, m), "RIGHTS_DENIED");
});
test("verified rights without evidence and missing provenance reject", async () => {
  const m = manifest(); m.rights.reference = null;
  checkCode(await intake(rawFixture, m), "MANIFEST_SCHEMA");
  const missing = manifest(); delete missing.source;
  checkCode(await intake(rawFixture, missing), "MANIFEST_SCHEMA");
});
test("unknown source evidence quarantines; rejected review cannot enter staging", async () => {
  const m = manifest(); m.source.evidence = {status:"unknown", reference:null, reason:"Unresolved origin"};
  checkCode(await intake(rawFixture, m), "SOURCE_UNRESOLVED", "quarantined");
  const rejected = manifest(); rejected.review = {status:"rejected", reviewer:"test", reviewedAt:rejected.capturedAt, reference:"test-review", reason:"Rejected"};
  checkCode(await intake(rawFixture, rejected), "REVIEW_REJECTED");
});
test("unsupported source claims and future verification metadata are rejected", async () => {
  const m = manifest(); m.source.type = "kfc_official";
  checkCode(await intake(rawFixture, m), "MANIFEST_SCHEMA");
  const unknown = manifest(); unknown.classification = "kfc_verified";
  checkCode(await intake(rawFixture, unknown), "MANIFEST_SCHEMA");
});
test("staging reuses S1.2 strictly and preserves source manifest", async () => {
  const m = manifest(), before = structuredClone(m), result = requireStage(await stage(source(), m));
  assert.deepEqual(m, before);
  assert.equal(result.dataset.classification, "seed_demo");
  assert.equal(result.reviewStatus, "pending");
  assert.equal(result.evidence.manifest.source.namespace, m.source.namespace);
  assert.equal(result.dataset.provenance[0].rawSha256, hash(Buffer.from(JSON.stringify(source()))));
  assert.ok(result.evidence.fields.some((f) => f.pointer === "/products/0/price/current"));
  assert.ok(!("category" in offer(result)));
  assert.ok(result.evidence.categories.some((c) => c.category === "Bữa trưa"));
});
test("current price never comes from strikethrough", async () => {
  const d = source(); d.products[0].price.strikethrough = {amount:99000, currency:"VND"};
  const r = requireStage(await stage(d));
  assert.equal(offer(r).price.amount, 89000);
  assert.ok(r.evidence.referencePrices.some((p) => p.price.amount === 99000));
  d.products[0].price.current = null;
  assert.equal(offer(requireStage(await stage(d))).price.status, "unknown");
});
test("missing facts remain unknown; variants/options are never generated", async () => {
  const d = source(); delete d.products[0].price; delete d.products[0].availability;
  d.variants = []; d.options = []; d.optionValues = [];
  const r = requireStage(await stage(d));
  assert.equal(offer(r).price.status, "unknown");
  assert.equal(offer(r).availability.status, "unknown");
  assert.deepEqual(r.dataset.variants, []); assert.deepEqual(r.dataset.options, []);
});
test("unresolved combo remains unknown despite numbers in raw text", async () => {
  const d = source(); d.combos[0].composition = {status:"unresolved", reason:"Choice not resolved", rawText:"2 gà hoặc 1 burger"}; d.comboItems = [];
  const r = requireStage(await stage(d));
  assert.equal(r.dataset.combos[0].compositionStatus, "unknown");
  assert.deepEqual(r.dataset.comboItems, []);
  assert.ok(r.unresolved.some((v) => v.field === "composition"));
});
test("unresolved combo cannot secretly assert components", async () => {
  const d = source(); d.combos[0].composition = {status:"unresolved", reason:"Not known", rawText:"2 gà"};
  checkCode(await stage(d), "CONTRACT_INVALID", "quarantined");
});
test("broken parent references and duplicate raw keys quarantine", async () => {
  const d = source(); d.options[0].variantKey = "missing";
  checkCode(await stage(d), "CONTRACT_INVALID", "quarantined");
  const duplicate = source(); duplicate.products.push({...duplicate.products[0]});
  checkCode(await stage(duplicate), "DUPLICATE_KEY", "quarantined");
});
test("negative/current ambiguous amounts and non-VND input quarantine", async () => {
  for (const value of [-1, 1.5, "89.000", null]) {
    const d = source(); d.products[0].price.current.amount = value;
    checkCode(await intake(d), "SNAPSHOT_SCHEMA", "quarantined");
  }
  const d = source(); d.products[0].price.current.currency = "USD";
  checkCode(await intake(d), "SNAPSHOT_SCHEMA", "quarantined");
});
test("availability is explicit and its observation cannot follow capture", async () => {
  const m = manifest(); m.source.type = "manual_capture"; m.captureMethod = "manual_capture"; m.source.url = "https://example.invalid/menu";
  m.source.evidence = {status:"unverified",reference:"test-provenance",reason:"No source verification"};
  const d = source(); d.products[0].availability = {status:"available", observedAt:m.capturedAt};
  const r = requireStage(await stage(d,m));
  assert.equal(offer(r).availability.status,"available");
  assert.equal(r.dataset.classification,"unverified");
  assert.equal(r.dataset.provenance[0].sourceKind,"manual");
  assert.equal(r.dataset.provenance[0].verificationStatus,"unverified");
  d.products[0].availability.observedAt = "2099-01-01T00:00:00Z";
  checkCode(await stage(d,m),"OBSERVATION_TIME","quarantined");
});
test("even approved source metadata cannot promote KFC verification", async () => {
  const m = manifest(); m.source.type="provided_export"; m.captureMethod="provided_export"; m.source.url="https://example.invalid/menu";
  m.source.evidence = {status:"verified",reference:"synthetic-reviewed-source",reason:null};
  m.review = {status:"approved",reviewer:"test",reviewedAt:m.capturedAt,reference:"synthetic-review",reason:null};
  const r = requireStage(await stage(source(),m));
  assert.equal(r.dataset.classification,"unverified"); assert.equal(r.reviewStatus,"pending");
  assert.equal(r.dataset.provenance[0].sourceUrl,m.source.url);
  assert.equal(r.dataset.provenance[0].verifiedBy,null);
});
test("normalization is deterministic, including reordered record collections", async () => {
  const d = source(), reordered = structuredClone(d);
  for (const key of ["products","comboItems","optionValues"]) reordered[key].reverse();
  const first = requireStage(await stage(d)), again = requireStage(await stage(d));
  assert.deepEqual(first,again);
  const other = requireStage(await stage(reordered));
  // Raw-byte provenance differs, but internal identities and semantic facts do not.
  assert.deepEqual(first.dataset.products,other.dataset.products);
});
test("same scoped key preserves local ID across rename; different scopes never merge", async () => {
  const a = requireStage(await stage(source(),scoped(manifest())));
  const d = source(); d.products[0].name="Tên demo được sửa";
  const b = requireStage(await stage(d,scoped(manifest())));
  assert.equal(offer(a).id,b.dataset.products.find((p)=>p.name===d.products[0].name).id);
  for (const m of [scoped(manifest(),"test-store-b"),scoped(manifest(),"test-store-a","delivery")]) {
    const other=requireStage(await stage(source(),m));
    assert.notEqual(offer(a).id,offer(other).id);
    assert.equal(diffStaging(a,other).status,"scope_mismatch");
  }
  assert.ok(offer(a).id.startsWith("local_"));
});
test("unknown scope isolates snapshots rather than guessing identity", async () => {
  const m=scoped(manifest()); m.scope.store={status:"unknown",value:null,reference:null,reason:"Unknown store"};
  const first=requireStage(await stage(source(),m));
  m.snapshotId="snapshot-second";
  const second=requireStage(await stage(source(),m));
  assert.notEqual(offer(first).id,offer(second).id);
});
test("diff reports price, composition and option changes deterministically", async () => {
  const a=requireStage(await stage()), d=source();
  d.products[0].price.current.amount=99000; d.comboItems[0].quantity=3; d.optionValues[0].price.current.amount=5000;
  const b=requireStage(await stage(d)); const changes=diffStaging(a,b);
  assert.equal(changes.status,"compared");
  for (const kind of ["price_changed","composition_changed","options_changed"]) assert.ok(changes.changes.some((c)=>c.kind===kind));
  assert.deepEqual(changes,diffStaging(a,b));
  assert.deepEqual(diffStaging(a,a).changes,[]);
});
test("missing item is not reclassified as unavailable and does not modify previous staging", async () => {
  const a=requireStage(await stage()), before=structuredClone(a), d=source();
  d.products.shift(); d.options=[]; d.optionValues=[]; d.comboItems=d.comboItems.filter((c)=>c.productKey!=="burger");
  const changes=diffStaging(a,requireStage(await stage(d)));
  assert.ok(changes.changes.some((c)=>c.kind==="missing_from_snapshot"));
  assert.ok(changes.changes.every((c)=>c.kind!=="unavailable")); assert.deepEqual(a,before);
  const rejected=await intake("bad",manifest(),(m)=>{m.contentHash="0".repeat(64);});
  assert.equal(diffStaging(a,normalizeSnapshot(rejected)).status,"skipped"); assert.deepEqual(a,before);
});
test("pipeline performs no writes or repository/network calls", async () => {
  const writeMethods=["writeFileSync","appendFileSync","mkdirSync","renameSync","unlinkSync","rmSync","copyFileSync","truncateSync","symlinkSync","linkSync"];
  const old=writeMethods.map((k)=>[k,fs[k]]);
  const asyncFs=require("node:fs/promises"), asyncWrites=["writeFile","appendFile","mkdir","rename","unlink","rm","copyFile","truncate","symlink","link"];
  const oldAsync=asyncWrites.map((k)=>[k,asyncFs[k]]), open=asyncFs.open;
  try {
    for (const key of writeMethods) fs[key]=()=>{throw new Error("Pipeline write forbidden");};
    for (const key of asyncWrites) asyncFs[key]=()=>{throw new Error("Async pipeline write forbidden");};
    asyncFs.open=(filename,flags,...args)=>{
      assert.equal(flags & (fs.constants.O_WRONLY | fs.constants.O_RDWR | fs.constants.O_CREAT),0);
      return open(filename,flags,...args);
    };
    const input=await readSnapshot({allowedRoot:fixtures,manifestPath:"demo.manifest.json"});
    requireStage(normalizeSnapshot(input));
  } finally {
    for (const [key,fn] of old) fs[key]=fn;
    for (const [key,fn] of oldAsync) asyncFs[key]=fn;
    asyncFs.open=open;
  }
  assert.deepEqual(networkCalls,[]);
  for (const loaded of Object.keys(require.cache)) assert.ok(!/[/\\](repositories|aws)[/\\]|agent-core/.test(loaded),loaded);
});
test("accepted observations cannot be mutated or forged after hash verification", async () => {
  const accepted=await intake();
  assert.equal(accepted.status,"accepted");
  assert.ok(Object.isFrozen(accepted.snapshot.products[0]));
  assert.equal(Reflect.set(accepted.snapshot.products[0],"name","forged"),false);
  checkCode(normalizeSnapshot(structuredClone(accepted)),"UNTRUSTED_INTAKE");
});
test("unverified origin without any evidence reference quarantines", async () => {
  const m=manifest(); m.source.evidence={status:"unverified",reference:null,reason:"No source evidence"};
  checkCode(await intake(rawFixture,m),"SOURCE_UNRESOLVED","quarantined");
});
test("future observation cannot be erased by demo conversion", async () => {
  const d=source(); d.products[0].availability={status:"available",observedAt:"2099-01-01T00:00:00Z"};
  checkCode(await stage(d),"OBSERVATION_TIME","quarantined");
});
test("hard-linked payloads reject instead of reading an alias to outside data", async () => {
  const root=fs.mkdtempSync(path.join(temp,"hardlink-"));
  const outside=path.join(temp,"hardlink-source.json"); fs.writeFileSync(outside,rawFixture);
  fs.linkSync(outside,path.join(root,"payload.json"));
  const m=manifest();m.payloadPath="payload.json";
  fs.writeFileSync(path.join(root,"manifest.json"),JSON.stringify(m));
  checkCode(await readSnapshot({allowedRoot:root,manifestPath:"manifest.json"}),"UNSAFE_PATH");
  fs.unlinkSync(path.join(root,"payload.json"));
});
test("reference price and variant attribute changes are separately visible", async () => {
  const a=requireStage(await stage()), d=source();
  d.products[0].price.strikethrough={amount:99000,currency:"VND"};
  d.variants[0].attributes.volume="synthetic-changed-attribute";
  const result=diffStaging(a,requireStage(await stage(d)));
  assert.ok(result.changes.some((c)=>c.kind==="reference_price_changed"));
  assert.ok(result.changes.some((c)=>c.kind==="variant_changed"));
  assert.ok(!result.changes.some((c)=>c.kind==="price_changed"));
});
test("recapture changes provenance but not identity or semantic diff", async () => {
  const m=scoped(manifest()), a=requireStage(await stage(source(),m));
  m.snapshotId="snapshot-recapture";m.capturedAt="2026-11-10T00:00:00.000Z";
  const b=requireStage(await stage(source(),m));
  assert.equal(offer(a).id,offer(b).id);
  assert.notEqual(a.dataset.provenance[0].id,b.dataset.provenance[0].id);
  assert.deepEqual(diffStaging(a,b).changes,[]);
});
test("identical names with different local keys do not fuzzy-merge", async () => {
  const d=source(); d.products.push({...d.products[0],key:"different-explicit-key"});
  const r=requireStage(await stage(d)), same=r.dataset.products.filter((p)=>p.name==="Burger Gà Rán");
  assert.equal(same.length,2);assert.notEqual(same[0].id,same[1].id);
});
test("rights not applicable is not permission; raw verified classifications are rejected", async () => {
  const m=manifest();m.rights={status:"not_applicable",reference:null,reason:"Not reviewed"};
  checkCode(await intake(rawFixture,m),"RIGHTS_UNRESOLVED","quarantined");
  const d=source();d.classification="kfc_verified";
  checkCode(await intake(d),"SNAPSHOT_SCHEMA","quarantined");
});
