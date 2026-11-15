"""Offline AWS source-package and infrastructure safety regressions."""
import contextlib
import hashlib
import importlib.util
import io
import json
import runpy
import tarfile
import tempfile
import unittest
from unittest.mock import patch
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
        statements = resources['HostRole']['Properties']['Policies'][0]['PolicyDocument']['Statement']
        grants = [statement for statement in statements if statement['Action'] == ['bedrock:InvokeModel']]
        self.assertEqual(len(grants), 3)
        model = 'anthropic.claude-haiku-5-5'
        profile = {'Fn::Sub': 'arn:${AWS::Partition}:bedrock:${AWS::Region}:${AWS::AccountId}:inference-profile/global.' + model}
        self.assertEqual(grants[0]['Resource'], [profile])
        self.assertEqual(grants[0]['Condition']['StringEquals'], {'aws:RequestedRegion': {'Ref': 'AWS::Region'}})
        self.assertEqual(grants[1]['Resource'], [{'Fn::Sub': 'arn:${AWS::Partition}:bedrock:${AWS::Region}::foundation-model/' + model}])
        self.assertEqual(grants[1]['Condition']['StringEquals'], {
            'aws:RequestedRegion': {'Ref': 'AWS::Region'}, 'bedrock:InferenceProfileArn': profile})
        self.assertEqual(grants[2]['Resource'], [{'Fn::Sub': 'arn:${AWS::Partition}:bedrock:::foundation-model/' + model}])
        self.assertEqual(grants[2]['Condition']['StringEquals'], {
            'aws:RequestedRegion': 'unspecified', 'bedrock:InferenceProfileArn': profile})
        self.assertTrue(all(statement['Effect'] == 'Allow' for statement in grants))
        bootstrap = resources['Host']['Properties']['UserData']['Fn::Base64']['Fn::Join'][1]
        self.assertTrue(any(isinstance(part, str) and '"model":"global.' + model + '"' in part for part in bootstrap))
        for name in ['AdminSecret', 'SessionSecret', 'OriginSecret']:
            self.assertEqual(resources[name]['Properties']['GenerateSecretString']['PasswordLength'], 64)

    def test_committed_template_matches_generator(self):
        with patch.object(Path, 'write_text') as write, contextlib.redirect_stdout(io.StringIO()):
            runpy.run_path(str(ROOT / 'infra/aws/build-template.py'))
        write.assert_called_once()
        self.assertEqual(json.loads(write.call_args.args[0]), json.loads((ROOT / 'infra/aws/stack.json').read_text()))

    def test_windows_shell_sources_are_packaged_with_linux_line_endings(self):
        with tempfile.TemporaryDirectory(prefix='kfc-shell-package-') as directory:
            root = Path(directory)
            for name in package.FILES:
                target = root / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(b'synthetic\r\n')
            (root / 'src').mkdir()
            (root / 'public').mkdir()
            shell = root / 'infra/aws/release.sh'
            shell.write_bytes(b'set -euo pipefail\r\nprintf "ready\\n"\r\n')
            entries = package.source_entries(root)
            self.assertEqual(entries['infra/aws/release.sh'], b'set -euo pipefail\nprintf "ready\\n"\n')
            self.assertEqual(entries['package.json'], b'synthetic\r\n')
            previous = package.ROOT
            package.ROOT = root
            try:
                self.assertEqual(package.source_entries(), entries)
            finally:
                package.ROOT = previous

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
