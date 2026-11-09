set -euo pipefail
umask 077
dnf install -y docker
systemctl enable --now docker
volume=$(python3 -c 'import json; print(json.load(open("/etc/kfc/config.json"))["volume"])')
serial=$(printf '%s' "$volume" | tr -d '-')
device=''
for attempt in $(seq 1 90); do
  device=$(lsblk -ndo PATH,SERIAL | awk -v serial="$serial" '$2 == serial {print $1}')
  [ -n "$device" ] && break
  sleep 2
done
[ -b "$device" ] || { echo 'Expected retained data volume was not attached'; exit 1; }
filesystem=$(lsblk -ndo FSTYPE "$device")
if [ -z "$filesystem" ]; then
  [ "$(lsblk -n "$device" | wc -l)" -eq 1 ] || { echo 'Unexpected volume partitions'; exit 1; }
  mkfs.ext4 -L kfc-data "$device"
else
  [ "$filesystem" = 'ext4' ] || { echo 'Unexpected data filesystem'; exit 1; }
fi
mkdir -p /srv/kfc
uuid=$(blkid -s UUID -o value "$device")
grep -q "UUID=$uuid " /etc/fstab || printf 'UUID=%s /srv/kfc ext4 defaults,nofail 0 2\n' "$uuid" >> /etc/fstab
mountpoint -q /srv/kfc || mount /srv/kfc
[ "$(findmnt -n -o UUID /srv/kfc)" = "$uuid" ] || { echo 'Unexpected mounted data volume'; exit 1; }
printf '%s' "$uuid" > /etc/kfc/data-volume-uuid
mkdir -p /srv/kfc/data /opt/kfc/releases
chown 1000:1000 /srv/kfc/data
printf 'KFC host ready for a separately approved source release.\n'
