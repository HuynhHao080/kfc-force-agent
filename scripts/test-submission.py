"""Synthetic tamper/path tests for the handoff verifier; no runtime data."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location("verify_submission", Path(__file__).with_name("verify-submission.py"))
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)


class SubmissionTests(unittest.TestCase):
    def make_archive(self, directory, actual=b"safe source", extra=None):
        archive = Path(directory) / "synthetic-source.zip"
        source = b"safe source"
        manifest = {"files": [{"path": "README.md", "bytes": len(source), "sha256": hashlib.sha256(source).hexdigest()}]}
        with zipfile.ZipFile(archive, "w") as zipped:
            zipped.writestr("README.md", actual)
            zipped.writestr("submission-manifest.json", json.dumps(manifest))
            if extra:
                zipped.writestr(extra, b"synthetic")
        archive.with_suffix(".sha256").write_text(f"{hashlib.sha256(archive.read_bytes()).hexdigest()}  {archive.name}", encoding="utf-8")
        return archive

    def test_valid_and_individual_file_tampering(self):
        with tempfile.TemporaryDirectory(prefix="kfc-submission-test-") as directory:
            verifier.inspect_archive(self.make_archive(directory))
            with self.assertRaisesRegex(ValueError, "digest/size mismatch"):
                verifier.inspect_archive(self.make_archive(directory, actual=b"tampered"))

    def test_private_traversal_and_unlisted_files(self):
        with tempfile.TemporaryDirectory(prefix="kfc-submission-test-") as directory:
            for name in ["../outside", "C:/outside", "src/../outside", ".local/store.json", "src/.env.local", "extra.txt"]:
                with self.subTest(name=name), self.assertRaises(ValueError):
                    verifier.inspect_archive(self.make_archive(directory, extra=name))

    def test_outer_checksum_and_failed_evidence(self):
        with tempfile.TemporaryDirectory(prefix="kfc-submission-test-") as directory:
            archive = self.make_archive(directory)
            archive.with_suffix(".sha256").write_text("wrong", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "sidecar mismatch"):
                verifier.inspect_archive(archive)
        with self.assertRaises(ValueError):
            verifier.inspect_evidence({"evidence/check.log": b"FAIL: no tests ran"})


if __name__ == "__main__":
    unittest.main()
