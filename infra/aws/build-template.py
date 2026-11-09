"""Generate the reviewable CloudFormation template. This command is local only."""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parent
ref = lambda name: {'Ref': name}
sub = lambda value: {'Fn::Sub': value}
attr = lambda name, field: {'Fn::GetAtt': [name, field]}
resources = {}

def resource(name, kind, properties, **extra):
    resources[name] = {'Type': kind, 'Properties': properties, **extra}

resource('Vpc', 'AWS::EC2::VPC', {'CidrBlock': '10.42.0.0/16', 'EnableDnsHostnames': True, 'EnableDnsSupport': True})
resource('InternetGateway', 'AWS::EC2::InternetGateway', {})
resource('GatewayAttachment', 'AWS::EC2::VPCGatewayAttachment', {'VpcId': ref('Vpc'), 'InternetGatewayId': ref('InternetGateway')})
resource('Subnet', 'AWS::EC2::Subnet', {'VpcId': ref('Vpc'), 'CidrBlock': '10.42.1.0/24', 'MapPublicIpOnLaunch': True,
    'AvailabilityZone': {'Fn::Select': [0, {'Fn::GetAZs': ''}]}})
resource('RouteTable', 'AWS::EC2::RouteTable', {'VpcId': ref('Vpc')})
resource('DefaultRoute', 'AWS::EC2::Route', {'RouteTableId': ref('RouteTable'), 'DestinationCidrBlock': '0.0.0.0/0', 'GatewayId': ref('InternetGateway')}, DependsOn='GatewayAttachment')
resource('SubnetRoute', 'AWS::EC2::SubnetRouteTableAssociation', {'SubnetId': ref('Subnet'), 'RouteTableId': ref('RouteTable')})
resource('OriginSecurityGroup', 'AWS::EC2::SecurityGroup', {'VpcId': ref('Vpc'), 'GroupDescription': 'CloudFront origin HTTP only; administration through SSM',
    'SecurityGroupIngress': [{'IpProtocol': 'tcp', 'FromPort': 80, 'ToPort': 80, 'SourcePrefixListId': ref('CloudFrontPrefixListId')}]})
resource('Artifacts', 'AWS::S3::Bucket', {'VersioningConfiguration': {'Status': 'Enabled'},
    'BucketEncryption': {'ServerSideEncryptionConfiguration': [{'ServerSideEncryptionByDefault': {'SSEAlgorithm': 'AES256'}}]},
    'PublicAccessBlockConfiguration': {'BlockPublicAcls': True, 'BlockPublicPolicy': True, 'IgnorePublicAcls': True, 'RestrictPublicBuckets': True}},
    DeletionPolicy='Retain', UpdateReplacePolicy='Retain')
resource('ArtifactPolicy', 'AWS::S3::BucketPolicy', {'Bucket': ref('Artifacts'), 'PolicyDocument': {'Version': '2012-10-17', 'Statement': [
    {'Effect': 'Deny', 'Principal': '*', 'Action': 's3:*', 'Resource': [attr('Artifacts', 'Arn'), sub('${Artifacts.Arn}/*')], 'Condition': {'Bool': {'aws:SecureTransport': 'false'}}}]}})
for name in ['AdminSecret', 'SessionSecret', 'OriginSecret']:
    resource(name, 'AWS::SecretsManager::Secret', {'Description': 'KFC graduation ' + name,
        'GenerateSecretString': {'PasswordLength': 64, 'ExcludePunctuation': True}}, DeletionPolicy='Retain', UpdateReplacePolicy='Retain')
model = 'anthropic.claude-haiku-4-5-20251001-v1:0'
resource('HostRole', 'AWS::IAM::Role', {'AssumeRolePolicyDocument': {'Version': '2012-10-17', 'Statement': [
    {'Effect': 'Allow', 'Principal': {'Service': 'ec2.amazonaws.com'}, 'Action': 'sts:AssumeRole'}]},
    'ManagedPolicyArns': [sub('arn:${AWS::Partition}:iam::aws:policy/AmazonSSMManagedInstanceCore')],
    'Policies': [{'PolicyName': 'KfcScopedRuntime', 'PolicyDocument': {'Version': '2012-10-17', 'Statement': [
        {'Effect': 'Allow', 'Action': ['bedrock:InvokeModel'], 'Resource': [
            sub('arn:${AWS::Partition}:bedrock:${AWS::Region}:${AWS::AccountId}:inference-profile/us.' + model),
            *[sub('arn:${AWS::Partition}:bedrock:' + region + '::foundation-model/' + model) for region in ['us-east-1', 'us-east-2', 'us-west-2']]]},
        {'Effect': 'Allow', 'Action': ['secretsmanager:GetSecretValue'], 'Resource': [ref(name) for name in ['AdminSecret', 'SessionSecret', 'OriginSecret']]},
        {'Effect': 'Allow', 'Action': ['s3:GetObjectVersion'], 'Resource': [sub('${Artifacts.Arn}/releases/*')]}
    ]}}]})
resource('HostProfile', 'AWS::IAM::InstanceProfile', {'Roles': [ref('HostRole')]})
resource('DataVolume', 'AWS::EC2::Volume', {'AvailabilityZone': {'Fn::Select': [0, {'Fn::GetAZs': ''}]},
    'Size': 20, 'VolumeType': 'gp3', 'Encrypted': True}, DeletionPolicy='Retain', UpdateReplacePolicy='Retain')
config_parts = ['#!/bin/bash\nset -euo pipefail\numask 077\nmkdir -p /etc/kfc\ncat > /etc/kfc/config.json <<\'KFCCONFIG\'\n',
    '{"region":"', ref('AWS::Region'), '","volume":"', ref('DataVolume'), '","adminSecret":"', ref('AdminSecret'),
    '","sessionSecret":"', ref('SessionSecret'), '","originSecret":"', ref('OriginSecret'),
    '","model":"us.' + model + '","dailyLimit":', ref('DailyRequestLimit'), '}\nKFCCONFIG\n',
    (ROOT / 'bootstrap.sh').read_text(encoding='utf-8-sig')]
resource('Host', 'AWS::EC2::Instance', {'ImageId': ref('AmiId'), 'InstanceType': ref('InstanceType'),
    'IamInstanceProfile': ref('HostProfile'), 'SubnetId': ref('Subnet'), 'SecurityGroupIds': [ref('OriginSecurityGroup')],
    'MetadataOptions': {'HttpTokens': 'required', 'HttpEndpoint': 'enabled', 'HttpPutResponseHopLimit': 1},
    'BlockDeviceMappings': [{'DeviceName': '/dev/xvda', 'Ebs': {'VolumeSize': 32, 'VolumeType': 'gp3', 'Encrypted': True, 'DeleteOnTermination': True}}],
    'UserData': {'Fn::Base64': {'Fn::Join': ['', config_parts]}},
    'Tags': [{'Key': 'Name', 'Value': sub('${AWS::StackName}-host')}, {'Key': 'Project', 'Value': 'kfc-force-agent'}]},
    DependsOn=['DefaultRoute', 'SubnetRoute'])
resource('DataAttachment', 'AWS::EC2::VolumeAttachment', {'InstanceId': ref('Host'), 'VolumeId': ref('DataVolume'), 'Device': '/dev/sdf'})
resource('Address', 'AWS::EC2::EIP', {'Domain': 'vpc'})
resource('AddressAttachment', 'AWS::EC2::EIPAssociation', {'InstanceId': ref('Host'), 'AllocationId': attr('Address', 'AllocationId')})
resource('Distribution', 'AWS::CloudFront::Distribution', {'DistributionConfig': {'Enabled': True, 'HttpVersion': 'http2', 'IPV6Enabled': True,
    'PriceClass': 'PriceClass_100', 'ViewerCertificate': {'CloudFrontDefaultCertificate': True},
    'Origins': [{'Id': 'KfcHost', 'DomainName': attr('Host', 'PublicDnsName'),
        'OriginCustomHeaders': [{'HeaderName': 'X-KFC-Origin', 'HeaderValue': sub('{{resolve:secretsmanager:${OriginSecret}:SecretString}}')}],
        'CustomOriginConfig': {'HTTPPort': 80, 'OriginProtocolPolicy': 'http-only', 'OriginReadTimeout': 30}}],
    'DefaultCacheBehavior': {'TargetOriginId': 'KfcHost', 'ViewerProtocolPolicy': 'redirect-to-https',
        'AllowedMethods': ['GET', 'HEAD', 'OPTIONS', 'PUT', 'POST', 'PATCH', 'DELETE'], 'CachedMethods': ['GET', 'HEAD'],
        'CachePolicyId': '4135ea2d-6df8-44a3-9df3-4b5a84be39ad',
        'OriginRequestPolicyId': '216adef6-5c7f-47e4-b989-5492eafa07d3', 'Compress': True},
    'CustomErrorResponses': [{'ErrorCode': status, 'ErrorCachingMinTTL': 0} for status in [400, 403, 404, 500, 502, 503, 504]]}},
    DependsOn='AddressAttachment')
template = {'AWSTemplateFormatVersion': '2010-09-09', 'Description': 'KFC graduation single-process EC2/EBS and Bedrock pilot. Source release is a separate step.',
    'Parameters': {
        'AmiId': {'Type': 'AWS::EC2::Image::Id', 'Description': 'Explicitly reviewed Amazon Linux 2023 x86_64 AMI ID'},
        'CloudFrontPrefixListId': {'Type': 'String', 'AllowedPattern': '^pl-[a-f0-9]+$'},
        'InstanceType': {'Type': 'String', 'Default': 't3.medium', 'AllowedValues': ['t3.medium']},
        'DailyRequestLimit': {'Type': 'Number', 'Default': 25, 'MinValue': 0, 'MaxValue': 1000}},
    'Resources': resources,
    'Outputs': {'Url': {'Value': sub('https://${Distribution.DomainName}')}, 'HostId': {'Value': ref('Host')},
        'ArtifactBucket': {'Value': ref('Artifacts')}, 'DataVolumeId': {'Value': ref('DataVolume')},
        'AdminSecretArn': {'Value': ref('AdminSecret')}, 'DistributionId': {'Value': ref('Distribution')}}}
(ROOT / 'stack.json').write_text(json.dumps(template, indent=2) + '\n', encoding='utf-8')
print('Wrote infra/aws/stack.json locally with ' + str(len(resources)) + ' resources.')
