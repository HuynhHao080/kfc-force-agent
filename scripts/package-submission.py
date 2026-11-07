"""Create a reviewable source/evidence archive, excluding local credentials/data."""
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
import json
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "submission"
OUTPUT.resolve().relative_to(ROOT)
OUTPUT.mkdir(parents=True, exist_ok=True)
version = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["version"]
created = datetime.now(timezone.utc)
archive = OUTPUT / f"kfc-force-agent-{version}-{created:%Y%m%dT%H%M%SZ}-source.zip"

# Explicit source roots: never recurse through .local, .git, .next or node_modules.
roots = ["src", "public", "docs", "scripts", "tests", ".github"]
root_files = [
    "README.md", "AGENTS.md", "CLAUDE.md", "package.json", "package-lock.json",
    "next.config.ts", "tsconfig.json", "eslint.config.mjs", "postcss.config.mjs",
    ".gitignore", ".env.example",
]
entries = {}
for directory in roots:
    for path in (ROOT / directory).rglob("*"):
        if (path.is_file() and not path.is_symlink() and "__pycache__" not in path.parts
                and path.suffix != ".kfcbackup"
                and not any(part.startswith(".kfc-restore-") for part in path.parts)
                and path.name not in {"store.json", "session-secret", "admin-credentials.json", "admin-bootstrap.txt"}):
            entries[path.relative_to(ROOT).as_posix()] = path
for name in root_files:
    path = ROOT / name
    if path.is_file():
        entries[name] = path

for name in ["intent-report.json", "intent-report.md", "language-safety-report.json"]:
    path = ROOT / "output" / "evaluation" / name
    if path.is_file():
        entries[f"evidence/evaluation/{name}"] = path
log = ROOT / "output" / "verification" / "check.log"
if log.is_file():
    entries["evidence/check.log"] = log
readiness = ROOT / "output" / "verification" / "demo-readiness.json"
if readiness.is_file():
    entries["evidence/demo-readiness.json"] = readiness
csv = ROOT / "output" / "verification" / "filtered-orders-demo.csv"
if csv.is_file():
    entries["evidence/report/filtered-orders-demo.csv"] = csv
promo_csv = ROOT / "output" / "verification" / "promotion-orders-demo.csv"
if promo_csv.is_file():
    entries["evidence/report/promotion-orders-demo.csv"] = promo_csv
for name in ["cart-atomic-before.json", "cart-atomic-after.json"]:
    path = ROOT / "output" / "verification" / name
    if path.is_file():
        entries[f"evidence/cart/{name}"] = path
for name in ["sales-report-demo.json", "product-sales-ui.csv"]:
    path = ROOT / "output" / "verification" / name
    if path.is_file():
        entries[f"evidence/report/{name}"] = path
for name in [
    "admin-desktop.png", "admin-report-desktop.png", "admin-mobile.png",
    "admin-menu-editor.png", "graduation-customer-order.png",
    "chat-panel-mobile.png",
    "review-logout-network-error.png", "review-admin-save-network-error.png",
    "account-settings-desktop.png", "account-settings-mobile.png",
    "receipt-desktop.png", "receipt-mobile.png", "receipt-print-layout.png",
    "admin-filtered-report.png", "admin-report-filter-mobile.png",
    "admin-categories-desktop.png", "admin-category-guard-mobile.png",
    "full-logout-snapshot-error.png", "full-admin-auto-sync.png",
    "catalog-audit-desktop.png", "catalog-audit-mobile.png",
    "address-book-desktop.png", "address-book-mobile.png", "address-checkout-mobile.png", "address-conflict-mobile.png",
    "tonight-chat-preview.png", "tonight-order.png",
    "promotions-admin-desktop.png", "promotions-admin-mobile.png",
    "promotions-checkout-mobile.png", "promotions-order-mobile.png",
    "promotions-receipt-desktop.png", "promotions-receipt-mobile.png", "promotions-conflict-mobile.png",
    "order-history-desktop.png", "order-history-mobile.png",
    "reorder-preview-desktop.png", "reorder-preview-mobile.png", "reorder-stale-mobile.png",
    "reorder-retry-mobile.png", "reorder-order-desktop.png", "reorder-order-mobile.png",
    "language-help-desktop.png", "language-help-mobile.png", "language-remove-preview-mobile.png", "language-order-mobile.png",
    "feedback-customer-mobile.png", "feedback-admin-mobile.png", "feedback-reply-mobile.png", "feedback-stale-mobile.png", "feedback-customer-reply-mobile.png",
    "shop-settings-mobile.png", "shop-public-closed-mobile.png", "shop-checkout-mobile.png", "shop-delivery-address-mobile.png", "shop-receipt.png",
    "cart-stale-mobile.png", "cart-retry-mobile.png", "cart-repriced-mobile.png",
    "kitchen-desktop.png", "kitchen-mobile.png", "kitchen-filter-mobile.png",
    "admin-cancel-reason-mobile.png", "customer-cancel-reason-mobile.png", "admin-cancel-conflict-mobile.png",
    "checkout-recovered-mobile.png", "checkout-check-again-mobile.png", "checkout-stale-quote-mobile.png",
    "sales-products-desktop.png", "sales-products-mobile.png", "sales-products-filtered-mobile.png", "sales-expired-view-mobile.png",
]:
    path = ROOT / "output" / "playwright" / name
    if path.is_file():
        entries[f"evidence/ui/{name}"] = path

records = []
with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as zipped:
    for name, path in sorted(entries.items()):
        parts = Path(name).parts
        if any(part in {".local", ".git", ".next", "node_modules", ".playwright-cli"} for part in parts):
            raise RuntimeError(f"Forbidden archive path: {name}")
        if Path(name).name.startswith(".env") and name != ".env.example":
            raise RuntimeError(f"Forbidden environment file: {name}")
        data = path.read_bytes()
        records.append({"path": name, "bytes": len(data), "sha256": sha256(data).hexdigest()})
        zipped.writestr(name, data)
    manifest = {
        "project": "KFC Force Agent", "version": version,
        "createdAt": created.isoformat(), "files": records,
        "exclusions": ["credentials", "runtime customer data", "dependencies", "compiled build", "Git history"],
    }
    zipped.writestr("submission-manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))

digest = sha256(archive.read_bytes()).hexdigest()
archive.with_suffix(".sha256").write_text(f"{digest}  {archive.name}\n", encoding="utf-8")
print(json.dumps({"archive": str(archive), "files": len(records), "sha256": digest}, indent=2))
