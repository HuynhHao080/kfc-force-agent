"""Offline AWS source-package and infrastructure safety regressions."""
import contextlib
import hashlib
import importlib.util
import io
import json
import tarfile
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('aws_release', ROOT / 'scripts/build-aws-release.py')
package = importlib.util.module_from_spec(spec)
spec.loader.exec_module(package)

class AwsPreparationTests(unittest.TestCase):
    def test_reviewed_network_and_runtime_scope(self):
        resources = json.loads((ROOT / 'infra/aws/stack.json').read_text())['Resources']
        ingress = resources['OriginSecurityGroup']['Properties']['SecurityGroupIngress']
        self.assertEqual(len(ingress), 1)
        self.assertEqual(ingress[0]['SourcePrefixListId'], {'Ref': 'CloudFrontPrefixListId'})
        self.assertEqual(ingress[0]['FromPort'], 80)
        self.assertEqual(resources['DataVolume']['DeletionPolicy'], 'Retain')
        self.assertTrue(resources['DataVolume']['Properties']['Encrypted'])
        self.assertEqual(resources['Host']['Properties']['MetadataOptions']['HttpTokens'], 'required')
        behavior = resources['Distribution']['Properties']['DistributionConfig']['DefaultCacheBehavior']
        self.assertEqual(behavior['ViewerProtocolPolicy'], 'redirect-to-https')
        self.assertEqual(behavior['CachePolicyId'], '4135ea2d-6df8-44a3-9df3-4b5a84be39ad')
        self.assertIn('POST', behavior['AllowedMethods'])
        statement = resources['HostRole']['Properties']['Policies'][0]['PolicyDocument']['Statement'][0]
        self.assertEqual(statement['Action'], ['bedrock:InvokeModel'])
        self.assertEqual(len(statement['Resource']), 4)
        for name in ['AdminSecret', 'SessionSecret', 'OriginSecret']:
            self.assertEqual(resources[name]['Properties']['GenerateSecretString']['PasswordLength'], 64)

    def test_archive_excludes_private_runtime_and_has_reproducible_hashes(self):
        with tempfile.TemporaryDirectory(prefix='kfc-aws-package-') as directory:
            root = Path(directory).resolve()
            root.relative_to(Path(tempfile.gettempdir()).resolve())
            self.assertTrue(root.name.startswith("kfc-aws-package-"))
            for name in package.FILES:
                (root / name).parent.mkdir(parents=True, exist_ok=True)
                (root / name).write_text('Synthetic source\n')
            for name in ['src/app/page.tsx', 'public/test.svg', 'infra/aws/release.sh',
                         '.local/store.json', '.env.local', 'output/secret.txt', 'node_modules/private.txt', 'src/.env.private']:
                path = root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text('Synthetic data\n')
            previous_root, previous_output = package.ROOT, package.OUTPUT
            package.ROOT, package.OUTPUT = root, root / 'output/aws'
            try:
                with contextlib.redirect_stdout(io.StringIO()):
                    package.build()
                archive = next(package.OUTPUT.glob('*.tar.gz'))
                first = archive.read_bytes()
                with contextlib.redirect_stdout(io.StringIO()):
                    package.build()
                self.assertEqual(first, archive.read_bytes())
                with tarfile.open(archive) as packed:
                    names = packed.getnames()
                    self.assertFalse(any('.local' in name or '.env' in name or 'node_modules' in name for name in names))
                    manifest = json.load(packed.extractfile('release-manifest.json'))
                    for entry in manifest['files']:
                        self.assertEqual(hashlib.sha256(packed.extractfile(entry['path']).read()).hexdigest(), entry['sha256'])
            finally:
                package.ROOT, package.OUTPUT = previous_root, previous_output

    def test_real_release_context_contains_only_allowed_roots(self):
        entries = package.source_entries()
        self.assertIn('src/lib/aws/invocation-budget.ts', entries)
        self.assertIn('infra/aws/release.sh', entries)
        self.assertNotIn('.env.local', entries)
        self.assertFalse(any(name.startswith(('.local/', 'output/', 'node_modules/')) for name in entries))
        dockerignore = (ROOT / '.dockerignore').read_text()
        self.assertIn('**/.env*', dockerignore)
        self.assertIn('.local', dockerignore)

if __name__ == '__main__':
    unittest.main()
