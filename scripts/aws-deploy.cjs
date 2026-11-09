/* eslint-disable @typescript-eslint/no-require-imports -- Explicit AWS infrastructure/release CLI. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
function loadTarget(filename) {
  const target = JSON.parse(fs.readFileSync(filename, 'utf8').replace(/^\uFEFF/, ''));
  const fields = ['profile', 'region', 'stackName', 'expectedAccount', 'amiId', 'cloudFrontPrefixListId', 'instanceType', 'dailyRequestLimit'];
  if (Object.keys(target).some(key => !fields.includes(key)) ||
      !/^[A-Za-z0-9_-]+$/.test(target.profile) || target.region !== 'us-west-2' ||
      !/^kfc-[a-z0-9-]{1,50}$/.test(target.stackName) || !/^(\d{12})?$/.test(target.expectedAccount) ||
      !/^(ami-[a-f0-9]{17})?$/.test(target.amiId) ||
      !/^pl-[a-f0-9]+$/.test(target.cloudFrontPrefixListId) || target.instanceType !== 't3.medium' ||
      !Number.isInteger(target.dailyRequestLimit) || target.dailyRequestLimit < 0 || target.dailyRequestLimit > 1000)
    throw new Error('Invalid target. Copy infra/aws/target.example.json and set the confirmed account.');
  return target;
}
function aws(target, operation) {
  return JSON.parse(execFileSync('aws', [...operation, '--profile', target.profile, '--region', target.region, '--output', 'json', '--no-cli-pager'], {
    encoding: 'utf8', windowsHide: true, timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, AWS_MAX_ATTEMPTS: '1', AWS_PAGER: '' },
  }) || '{}');
}
const canonical = value => JSON.stringify(value, (key, entry) => entry && typeof entry === 'object' && !Array.isArray(entry) ? Object.fromEntries(Object.keys(entry).sort().map(name => [name, entry[name]])) : entry);
const digest = data => crypto.createHash('sha256').update(data).digest('hex');
const shellQuote = value => "'" + value.replace(/'/g, "'\\''") + "'";
function releaseCommands(target, outputs, version, sha) {
  if (!/^[a-f0-9]{64}$/.test(sha) || !/^[a-z0-9.-]{3,63}$/.test(outputs.ArtifactBucket) || !version || version === 'null') throw new Error('Release must pin a versioned artifact.');
  const key = 'releases/' + sha + '.tar.gz';
  const archive = '/opt/kfc/artifacts/' + sha + '.tar.gz';
  const source = '/opt/kfc/releases/' + sha;
  return ['set -euo pipefail', 'umask 077', 'for attempt in $(seq 1 90); do if mountpoint -q /srv/kfc && docker info >/dev/null 2>&1; then break; fi; sleep 2; done', 'mountpoint -q /srv/kfc && docker info >/dev/null', 'mkdir -p /opt/kfc/artifacts ' + source,
    ['aws s3api get-object', '--bucket ' + shellQuote(outputs.ArtifactBucket), '--key ' + shellQuote(key), '--version-id ' + shellQuote(version), '--region ' + shellQuote(target.region), shellQuote(archive), '>/dev/null'].join(' '),
    "printf '%s  %s\\n' " + shellQuote(sha) + ' ' + shellQuote(archive) + ' | sha256sum -c -',
    'python3 - ' + shellQuote(archive) + ' ' + shellQuote(source) + " <<'PY'\n" +
      "import pathlib,sys,tarfile\nroot=pathlib.Path(sys.argv[2]).resolve()\nwith tarfile.open(sys.argv[1]) as archive:\n members=archive.getmembers()\n names=[m.name for m in members]\n assert len(names)==len(set(names))\n for member in members:\n  name=pathlib.PurePosixPath(member.name)\n  assert member.isfile() and not name.is_absolute() and '..' not in name.parts\n  (root/member.name).resolve().relative_to(root)\n archive.extractall(root,members=members)\nPY",
    "printf '%s' " + shellQuote(sha) + ' > /etc/kfc/release-sha',
    'bash ' + shellQuote(source + '/infra/aws/release.sh')];
}
function assertCreateChangeSet(change, stackState, stored, reviewed, target) {
  if (stackState !== 'REVIEW_IN_PROGRESS' || change.Status !== 'CREATE_COMPLETE' || change.ExecutionStatus !== 'AVAILABLE' || change.NextToken)
    throw new Error('Unexpected CREATE change set state.');
  if (canonical(stored) !== canonical(reviewed)) throw new Error('Change set template differs from reviewed source.');
  const changes = change.Changes ?? [];
  const names = changes.map(entry => entry.ResourceChange?.LogicalResourceId);
  if (new Set(names).size !== names.length || names.length !== Object.keys(reviewed.Resources).length ||
      changes.some(entry => entry.ResourceChange?.Action !== 'Add' ||
        reviewed.Resources[entry.ResourceChange.LogicalResourceId]?.Type !== entry.ResourceChange.ResourceType))
    throw new Error('Change set must add exactly the reviewed resources.');
  const parameters = Object.fromEntries((change.Parameters ?? []).map(parameter => [parameter.ParameterKey, parameter.ParameterValue]));
  if (parameters.InstanceType !== target.instanceType || parameters.CloudFrontPrefixListId !== target.cloudFrontPrefixListId ||
      parameters.DailyRequestLimit !== String(target.dailyRequestLimit) ||
      parameters.AmiId !== target.amiId)
    throw new Error('Change set parameters differ from reviewed target.');
}
async function main() {
  const [command = 'plan', ...values] = process.argv.slice(2);
  const args = {};
  for (let index = 0; index < values.length; index += 2) {
    if (!['--config', '--change-set', '--artifact', '--sha256'].includes(values[index]) || !values[index + 1]) throw new Error('Unknown or incomplete deployment argument.');
    args[values[index]] = values[index + 1];
  }
  if (!['plan', 'prepare', 'execute', 'release-plan', 'release'].includes(command)) throw new Error('Use plan, prepare, execute, release-plan or release.');
  const target = loadTarget(path.resolve(args['--config'] || path.join(root, 'infra/aws/target.example.json')));
  const identity = aws(target, ['sts', 'get-caller-identity']);
  const template = fs.readFileSync(path.join(root, 'infra/aws/stack.json'));
  if (command !== 'plan' && (!target.expectedAccount || target.expectedAccount !== identity.Account)) throw new Error('Confirm the exact AWS account in the private target file before mutations.');
  if (target.expectedAccount && target.expectedAccount !== identity.Account) throw new Error('AWS account mismatch.');
  if (command !== 'plan' && !target.amiId) throw new Error('Pin the reviewed AMI ID in the private target file.');
  if (command === 'plan') {
    const amiId = target.amiId || aws(target, ['ssm', 'get-parameter', '--name', '/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64']).Parameter.Value;
    const image = aws(target, ['ec2', 'describe-images', '--image-ids', amiId, '--owners', 'amazon']).Images?.[0];
    if (!image || image.State !== 'available' || image.Architecture !== 'x86_64') throw new Error('Expected an available Amazon x86_64 image.');
    const report = { accountLast4: identity.Account.slice(-4), accountConfirmed: !!target.expectedAccount,
      region: target.region, stackName: target.stackName, templateSha256: digest(template),
      proposedAmiId: amiId, amiPinned: !!target.amiId,
      resources: Object.keys(JSON.parse(template).Resources).length, instanceType: target.instanceType,
      dailyInferenceRequests: target.dailyRequestLimit, mutationPerformed: false,
      persistentData: '20 GiB encrypted EBS, retained on replacement/deletion',
      nextStep: 'Review costs and target; prepare a CREATE change set after approval' };
    fs.mkdirSync(path.join(root, 'output/verification'), { recursive: true });
    fs.writeFileSync(path.join(root, 'output/verification/aws-deployment-plan.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  if (command === 'prepare') {
    const name = 'kfc-create-' + Date.now();
    const parameters = [
      { ParameterKey: 'AmiId', ParameterValue: target.amiId },
      { ParameterKey: 'CloudFrontPrefixListId', ParameterValue: target.cloudFrontPrefixListId },
      { ParameterKey: 'InstanceType', ParameterValue: target.instanceType },
      { ParameterKey: 'DailyRequestLimit', ParameterValue: String(target.dailyRequestLimit) },
    ];
    const result = aws(target, ['cloudformation', 'create-change-set', '--stack-name', target.stackName, '--change-set-name', name,
      '--change-set-type', 'CREATE', '--capabilities', 'CAPABILITY_IAM', '--template-body', 'file://' + path.join(root, 'infra/aws/stack.json'), '--parameters', JSON.stringify(parameters)]);
    console.log(JSON.stringify({ changeSet: name, id: result.Id, executed: false }, null, 2));
    return;
  }
  if (command === 'execute') {
    if (!/^kfc-create-\d+$/.test(args['--change-set'] || '')) throw new Error('An explicitly named KFC CREATE change set is required.');
    const options = ['--stack-name', target.stackName, '--change-set-name', args['--change-set']];
    const change = aws(target, ['cloudformation', 'describe-change-set', ...options]);
    const stackState = aws(target, ['cloudformation', 'describe-stacks', '--stack-name', target.stackName]).Stacks[0].StackStatus;
    const stored = aws(target, ['cloudformation', 'get-template', ...options]).TemplateBody;
    assertCreateChangeSet(change, stackState, typeof stored === 'string' ? JSON.parse(stored) : stored, JSON.parse(template), target);
    aws(target, ['cloudformation', 'execute-change-set', ...options]);
    console.log(JSON.stringify({ executed: true, stackName: target.stackName, nextStep: 'Monitor CREATE_COMPLETE before releasing source.' }));
    return;
  }
  const stack = aws(target, ['cloudformation', 'describe-stacks', '--stack-name', target.stackName]).Stacks[0];
  if (stack.StackStatus !== 'CREATE_COMPLETE') throw new Error('This first-release CLI requires a CREATE_COMPLETE pilot stack.');
  const outputs = Object.fromEntries(stack.Outputs.map(value => [value.OutputKey, value.OutputValue]));
  const deployed = aws(target, ['cloudformation', 'get-template', '--stack-name', target.stackName]).TemplateBody;
  if (canonical(typeof deployed === 'string' ? JSON.parse(deployed) : deployed) !== canonical(JSON.parse(template))) throw new Error('Deployed stack template differs from the reviewed source.');

  const data = fs.readFileSync(path.resolve(args['--artifact'] || ''));
  const sha = digest(data);
  if (args['--sha256'] !== sha) throw new Error('Artifact digest mismatch.');
  if (command === 'release-plan') {
    console.log(JSON.stringify({ sha256: sha, instance: outputs.HostId, url: outputs.Url, mutationPerformed: false }, null, 2));
    return;
  }
  const uploaded = aws(target, ['s3api', 'put-object', '--bucket', outputs.ArtifactBucket, '--key', 'releases/' + sha + '.tar.gz',
    '--body', path.resolve(args['--artifact']), '--checksum-algorithm', 'SHA256', '--if-none-match', '*']);
  if (!uploaded.VersionId || uploaded.VersionId === 'null') throw new Error('Artifact upload did not return an immutable object version. Stop before SSM.');
  const commandResult = aws(target, ['ssm', 'send-command', '--document-name', 'AWS-RunShellScript', '--instance-ids', outputs.HostId,
    '--parameters', JSON.stringify({ commands: releaseCommands(target, outputs, uploaded.VersionId, sha) }), '--timeout-seconds', '3600', '--comment', 'KFC source release ' + sha.slice(0, 12)]);
  console.log(JSON.stringify({ commandId: commandResult.Command.CommandId, artifactVersion: uploaded.VersionId, sha256: sha, url: outputs.Url,
    nextStep: 'Monitor this SSM command, then run HTTPS and AI acceptance. No inference is invoked by this CLI.' }, null, 2));
}
module.exports = { loadTarget, releaseCommands, assertCreateChangeSet };
if (require.main === module) main().catch(error => {
  console.error(error instanceof Error ? error.message : 'AWS deployment preparation failed');
  process.exitCode = 1;
});
