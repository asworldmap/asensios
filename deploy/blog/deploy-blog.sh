#!/usr/bin/env bash
# Manual/ops deploy of the static blog to the Hostinger VPS.
# Run this ON THE VPS (or adapt for a push-based deploy) — it is not
# executed by this session, which has no access to the production server.
set -euo pipefail

STAGING="${1:-/tmp/papeles-desde-santiago}"
TARGET="/var/www/blog.asensios.com"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/var/backups/blog.asensios.com-${STAMP}"

test -d "$STAGING" || { echo "Staging not found: $STAGING" >&2; exit 1; }

mkdir -p /var/backups
if [ -d "$TARGET" ]; then
  cp -a "$TARGET" "$BACKUP"
  echo "Backup: $BACKUP"
fi

mkdir -p "$TARGET"
rsync -a --delete "$STAGING"/ "$TARGET"/

find "$TARGET" -type d -exec chmod 755 {} \;
find "$TARGET" -type f -exec chmod 644 {} \;

echo "Static files deployed to $TARGET"
echo "Next: validate Caddy, then reload only on success."
