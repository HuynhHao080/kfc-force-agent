set -euo pipefail
umask 077
source_root=$(cd "$(dirname "$0")/../.." && pwd)
cd "$source_root"
mountpoint -q /srv/kfc || { echo 'Persistent data volume is not mounted'; exit 1; }
[ "$(findmnt -n -o UUID /srv/kfc)" = "$(cat /etc/kfc/data-volume-uuid)" ] || { echo 'Data volume identity mismatch'; exit 1; }
python3 infra/aws/runtime-config.py
release_sha=$(cat /etc/kfc/release-sha)
[[ "$release_sha" =~ ^[a-f0-9]{64}$ ]] || exit 1
# Build fully before stopping the running application.
docker build --pull -t "kfc-force-agent:$release_sha" .
previous=$(docker inspect --format '{{.Config.Image}}' kfc-app 2>/dev/null || true)
if [ -n "$previous" ]; then
  docker stop --time 30 kfc-app
  docker rename kfc-app kfc-app-previous
fi
restore_previous() {
  docker rm -f kfc-app 2>/dev/null || true
  if [ -n "$previous" ]; then
    docker rename kfc-app-previous kfc-app
    docker start kfc-app
  fi
}
if ! docker run -d --name kfc-app --restart unless-stopped --network host \
  --log-opt max-size=10m --log-opt max-file=3 --env-file /etc/kfc/runtime.env \
  --mount type=bind,source=/srv/kfc/data,target=/data "kfc-force-agent:$release_sha"; then
  restore_previous
  exit 1
fi
healthy=false
for attempt in $(seq 1 30); do
  if docker exec kfc-app node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; then
    healthy=true
    break
  fi
  sleep 2
done
if [ "$healthy" != true ]; then
  restore_previous
  exit 1
fi
# The previous container holds only code. /srv/kfc/data remains mounted on EBS.
docker rm kfc-app-previous 2>/dev/null || true
docker pull nginx:stable-alpine
docker rm -f kfc-proxy 2>/dev/null || true
docker run -d --name kfc-proxy --restart unless-stopped --network host \
  --log-opt max-size=10m --log-opt max-file=3 \
  --mount type=bind,source=/etc/kfc/nginx.conf,target=/etc/nginx/nginx.conf,readonly nginx:stable-alpine
printf 'Release started. Run HTTPS acceptance separately.\n'
