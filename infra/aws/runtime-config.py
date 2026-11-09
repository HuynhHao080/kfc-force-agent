"""Materialize server-only configuration without printing secret values."""
import json
import os
import re
import subprocess
from pathlib import Path

config = json.loads(Path('/etc/kfc/config.json').read_text())

def secret(arn):
    result = subprocess.run(['aws', 'secretsmanager', 'get-secret-value', '--secret-id', arn,
                             '--region', config['region'], '--output', 'json', '--no-cli-pager'],
                            check=True, capture_output=True, text=True)
    value = json.loads(result.stdout)['SecretString']
    if not re.fullmatch(r'[A-Za-z0-9]{64}', value):
        raise ValueError('Unexpected secret format')
    return value

admin = secret(config['adminSecret'])
session = secret(config['sessionSecret'])
origin = secret(config['originSecret'])
environment = {'AI_PROVIDER': 'bedrock', 'PERSISTENCE_DRIVER': 'local', 'LOCAL_DATA_DIR': '/data',
               'AWS_REGION': config['region'], 'BEDROCK_MODEL_ID': config['model'],
               'BEDROCK_DAILY_REQUEST_LIMIT': str(config['dailyLimit']),
               'ADMIN_PASSWORD': admin, 'SESSION_SECRET': session}
Path('/etc/kfc/runtime.env').write_text(''.join(f'{key}={value}\n' for key, value in environment.items()))
os.chmod('/etc/kfc/runtime.env', 0o600)
nginx = '''events { worker_connections 256; }
http {
  access_log off;
  server {
    listen 80;
    client_max_body_size 32k;
    if ($http_x_kfc_origin != "ORIGIN_TOKEN") { return 403; }
    location / {
      proxy_pass http://127.0.0.1:3000;
      proxy_set_header Host $http_host;
      proxy_set_header X-Forwarded-Host $http_host;
      proxy_set_header X-Forwarded-Proto https;
      proxy_set_header X-KFC-Origin "";
      proxy_read_timeout 30s;
      proxy_buffering off;
    }
  }
}
'''
Path('/etc/kfc/nginx.conf').write_text(nginx.replace('ORIGIN_TOKEN', origin))
os.chmod('/etc/kfc/nginx.conf', 0o600)
