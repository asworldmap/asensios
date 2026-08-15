#!/usr/bin/env bash
# Installs or UPDATES the blog.asensios.com site block in /etc/caddy/Caddyfile.
#
# The first version of this deploy only ever appended the block, and skipped
# entirely when it was already present. That made the Caddy config effectively
# write-once: any later correction to headers or caching could never reach
# production. This script instead owns a marked region and rewrites it every
# time, so the file on the VPS always matches the snippet in the repository.
#
# The apex site block in the same Caddyfile is never touched. Every run backs
# the file up, validates before reloading, and restores the backup if either
# validation or the post-reload health check of the apex site fails.
#
# Usage (on the VPS):  apply-caddy-block.sh /tmp/blog-caddy-snippet.conf
set -euo pipefail

SNIPPET="${1:?usage: apply-caddy-block.sh <snippet-path>}"
CADDYFILE=/etc/caddy/Caddyfile
TARGET=/var/www/blog.asensios.com
BEGIN='# >>> managed: blog.asensios.com >>>'
END='# <<< managed: blog.asensios.com <<<'

if ! sudo -n true 2>/dev/null; then
  echo "::error::Deploy user has no passwordless sudo -- cannot edit $CADDYFILE or reload Caddy. Not adding sudo rules to work around this."
  exit 1
fi

sudo mkdir -p "$TARGET"

STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="${CADDYFILE}.backup-${STAMP}"
sudo cp "$CADDYFILE" "$BACKUP"
echo "Backup created: $BACKUP"

# Strip any previous version of our block: both the marked region and, for the
# first run after this script is introduced, a legacy unmarked
# `blog.asensios.com { ... }` block matched by brace depth.
sudo awk -v b="$BEGIN" -v e="$END" '
  index($0, b) == 1 { inmarked = 1; next }
  index($0, e) == 1 { inmarked = 0; next }
  inmarked { next }
  !inlegacy && /^blog\.asensios\.com[[:space:]]*\{/ {
    inlegacy = 1
    depth = gsub(/\{/, "{") - gsub(/\}/, "}")
    if (depth <= 0) inlegacy = 0
    next
  }
  inlegacy {
    depth += gsub(/\{/, "{") - gsub(/\}/, "}")
    if (depth <= 0) inlegacy = 0
    next
  }
  { print }
' "$CADDYFILE" | sudo tee "${CADDYFILE}.new" > /dev/null

# Collapse trailing blank lines, then append the fresh block.
{
  sudo sed -e :a -e '/^\n*$/{$d;N;};/\n$/ba' "${CADDYFILE}.new"
  echo
  echo "$BEGIN"
  cat "$SNIPPET"
  echo "$END"
} | sudo tee "$CADDYFILE" > /dev/null

sudo rm -f "${CADDYFILE}.new" "$SNIPPET"
sudo caddy fmt --overwrite "$CADDYFILE"

if ! sudo caddy validate --config "$CADDYFILE"; then
  echo "::error::caddy validate failed -- restoring backup, NOT reloading."
  sudo cp "$BACKUP" "$CADDYFILE"
  exit 1
fi

sudo systemctl reload caddy
sleep 2

if ! curl -fsS -o /dev/null https://asensios.com/ || ! curl -fsS -o /dev/null https://www.asensios.com/; then
  echo "::error::apex unhealthy after reload -- rolling back Caddy immediately."
  sudo cp "$BACKUP" "$CADDYFILE"
  sudo caddy validate --config "$CADDYFILE"
  sudo systemctl reload caddy
  exit 1
fi

echo "Caddy block for blog.asensios.com installed/updated. Apex verified healthy from the VPS."
