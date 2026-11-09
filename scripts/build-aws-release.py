"""Build a source-only Docker context with a checksum manifest. No AWS calls."""
import gzip
import hashlib
import io
import json
import tarfile
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'output/aws'
FILES = ['Dockerfile', '.dockerignore', 'package.json', 'package-lock.json', 'next.config.ts',
         'tsconfig.json', 'postcss.config.mjs', 'eslint.config.mjs',
         'infra/aws/release.sh', 'infra/aws/runtime-config.py']
ROOTS = ['src', 'public']

def source_entries(root=ROOT):
    result = {}
    for name in FILES:
        path = root / name
        if path.is_symlink() or not path.is_file():
            raise ValueError('Missing or symlink source: ' + name)
        result[name] = path.read_bytes()
    for folder in ROOTS:
        for path in (root / folder).rglob('*'):
            if path.is_symlink():
                raise ValueError('Symlink source refused')
            if not path.is_file() or '__pycache__' in path.parts:
                continue
            if path.name.startswith('.env') or path.suffix in {'.kfcbackup', '.pyc'} or path.name in {'store.json', 'session-secret', 'admin-credentials.json', 'admin-bootstrap.txt'}:
                continue
            result[path.relative_to(root).as_posix()] = path.read_bytes()
    return result

def build():
    entries = source_entries()
    records = [{'path': name, 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)}
               for name, data in sorted(entries.items())]
    entries['release-manifest.json'] = json.dumps({'files': records}, indent=2).encode()
    buffer = io.BytesIO()
    with gzip.GzipFile(fileobj=buffer, mode='wb', filename='', mtime=0) as compressed:
        with tarfile.open(fileobj=compressed, mode='w') as archive:
            for name, data in sorted(entries.items()):
                info = tarfile.TarInfo(name)
                info.size = len(data)
                info.mode = 0o644
                info.mtime = 0
                archive.addfile(info, io.BytesIO(data))
    data = buffer.getvalue()
    digest = hashlib.sha256(data).hexdigest()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    archive = OUTPUT / ('kfc-' + digest + '.tar.gz')
    archive.write_bytes(data)
    archive.with_suffix('.manifest.json').write_text(json.dumps({'sha256': digest, 'files': records}, indent=2) + '\n')
    print(json.dumps({'artifact': str(archive), 'sha256': digest, 'sourceFiles': len(records)}, indent=2))

if __name__ == '__main__':
    build()
