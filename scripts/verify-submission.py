"""Verify a handoff ZIP without extracting or executing its contents."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import stat
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def require(condition, message):
    if not condition:
        raise ValueError(message)


def safe_path(name):
    parts = PurePosixPath(name).parts
    require(bool(parts) and not name.startswith("/") and "\\" not in name
            and ":" not in name and all(p not in {".", "..", ""} for p in name.split("/")),
            f"Unsafe path: {name}")
    require(not any(p in {".local", ".git", ".next", "node_modules", ".playwright-cli", "__pycache__"}
                    or p.startswith(".kfc-restore-") for p in parts), f"Private/runtime path: {name}")
    require(parts[-1] not in {"store.json", "session-secret", "admin-credentials.json", "admin-bootstrap.txt"}
            and not name.endswith(".kfcbackup"), f"Private data path: {name}")
    require(not parts[-1].startswith(".env") or name == ".env.example", f"Environment secret path: {name}")


def inspect_archive(archive):
    require(archive.stat().st_size <= 128 * 1024 * 1024, "Archive exceeds 128 MiB")
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    sidecar = archive.with_suffix(".sha256").read_text(encoding="utf-8").strip()
    require(sidecar == f"{digest}  {archive.name}", "Archive SHA256 sidecar mismatch")
    with zipfile.ZipFile(archive) as zipped:
        infos = zipped.infolist()
        names = [i.filename for i in infos]
        require(len(names) == len(set(names)), "Duplicate archive entries")
        require(len(names) <= 5000 and sum(i.file_size for i in infos) <= 256 * 1024 * 1024,
                "Archive expansion limit exceeded")
        require(len({n.casefold() for n in names}) == len(names), "Case-insensitive path collision")
        for info in infos:
            safe_path(info.filename)
            require(not stat.S_ISLNK(info.external_attr >> 16), "Symlink in archive")
            require(info.file_size <= 32 * 1024 * 1024, "Entry exceeds 32 MiB")
        manifest = json.loads(zipped.read("submission-manifest.json"))
        records = manifest["files"]
        require(isinstance(records, list) and len(records) > 0, "Empty manifest")
        paths = [r["path"] for r in records]
        require(len(paths) == len(set(paths)), "Duplicate manifest paths")
        require(set(names) == set(paths) | {"submission-manifest.json"}, "Unlisted or missing archive files")
        contents = {}
        for record in records:
            name = record["path"]
            safe_path(name)
            data = zipped.read(name)
            require(len(data) == record["bytes"] and hashlib.sha256(data).hexdigest() == record["sha256"],
                    f"File digest/size mismatch: {name}")
            contents[name] = data
    return digest, manifest, contents


def inspect_evidence(contents):
    log = contents["evidence/check.log"].decode("utf-8-sig")
    patterns = [r"(\d+) chat regression checks passed", r"(\d+) local backup/recovery checks passed",
                r"(\d+) HTTP integration checks passed"]
    counts = []
    for pattern in patterns:
        matches = re.findall(pattern, log)
        require(len(matches) == 1 and int(matches[0]) > 0, f"Missing/ambiguous check result: {pattern}")
        counts.append(int(matches[0]))
    for stage in ["eslint", "tsc --noEmit", "next build", "Compiled successfully"]:
        require(stage in log, f"Missing check stage: {stage}")
    require(not re.search(r"AssertionError|Error:|FAIL|ELIFECYCLE", log), "Check log contains failure markers")
    readiness = json.loads(contents["evidence/demo-readiness.json"])
    require(readiness.get("passed") is True and len(readiness.get("results", [])) == 7
            and all(r.get("passed") is True for r in readiness["results"]), "Demo readiness failed")
    for filename, dataset in [
        ("intent-report.json", "tests/data/intent-cases.vi.json"),
        ("language-safety-report.json", "tests/data/language-safety.vi.json"),
    ]:
        report = json.loads(contents[f"evidence/evaluation/{filename}"])
        require(hashlib.sha256(contents[dataset]).hexdigest() == report["datasetSha256"], "Evaluation dataset drift")
        require(bool(report.get("parserSources")), "Missing parser source provenance")
        for source in report["parserSources"]:
            require(hashlib.sha256(contents[source["path"]]).hexdigest() == source["sha256"], "Parser source drift")
        if filename == "intent-report.json":
            require(hashlib.sha256(contents["scripts/evaluate-intents.cjs"]).hexdigest() == report["evaluatorSha256"],
                    "Evaluator source drift")
        else:
            require(report["passed"] == report["total"] and report["total"] > 0, "Language safety regression failed")
    return {"unitGroups": counts[0], "recoveryGroups": counts[1], "httpGroups": counts[2], "totalGroups": sum(counts)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path, nargs="?")
    parser.add_argument("--current", action="store_true", help="Also compare archived source files with this checkout")
    args = parser.parse_args()
    archives = sorted((ROOT / "output/submission").glob("*-source.zip"))
    archive = args.archive or (archives[-1] if archives else None)
    require(archive is not None, "No submission ZIP; run npm run submission:pack")
    digest, manifest, contents = inspect_archive(archive)
    evidence = inspect_evidence(contents)
    if args.current:
        for record in manifest["files"]:
            if not record["path"].startswith("evidence/"):
                current = ROOT / record["path"]
                require(current.is_file() and not current.is_symlink()
                        and hashlib.sha256(current.read_bytes()).hexdigest() == record["sha256"],
                        f"Checkout differs: {record['path']}")
    result = {"passed": True, "archive": archive.name, "sha256": digest, "files": len(manifest["files"]),
              "currentSourcesCompared": args.current, **evidence,
              "scope": "Artifact integrity, recorded local check results and evaluation provenance; not an independent test run or secret-content scanner"}
    archive.with_suffix(".verified.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, TypeError, OSError, zipfile.BadZipFile) as error:
        raise SystemExit(f"Submission verification failed: {error}") from None
