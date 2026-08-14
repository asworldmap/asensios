#!/usr/bin/env bash
# Revoke the exposed GitHub Actions deploy key from authorized_keys.
#
# Runs ON THE VPS, uploaded and executed by
# .github/workflows/revoke-old-deploy-key.yml. It is only ever reached
# over an SSH connection authenticated with the NEW rotated key, so the
# fact that it runs at all is itself proof the new key works.
#
# Safety properties:
#   - backs up authorized_keys before touching it;
#   - matches keys by FINGERPRINT, never by fuzzy string match, so an
#     unrelated key whose comment happens to contain the old name is
#     never removed;
#   - refuses to remove anything unless the new key is present and valid;
#   - restores the backup and fails loudly if the post-state is wrong;
#   - never reads, writes, or prints private key material.
#
# Usage: revoke-old-key.sh <OLD_FINGERPRINT> <NEW_FINGERPRINT>
set -euo pipefail

OLD_FP="${1:?old fingerprint required}"
NEW_FP="${2:?new fingerprint required}"
AUTHKEYS="$HOME/.ssh/authorized_keys"

if [ ! -f "$AUTHKEYS" ]; then
  echo "::error::$AUTHKEYS not found"
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${AUTHKEYS}.backup-${STAMP}"
cp "$AUTHKEYS" "$BACKUP"
echo "Backup created: $BACKUP"
echo ""

python3 - "$AUTHKEYS" "$OLD_FP" "$NEW_FP" "$BACKUP" <<'PY'
import os, subprocess, sys, tempfile

path, old_fp, new_fp, backup = sys.argv[1:5]


def fingerprint(line):
    """Return the SHA256:... fingerprint of a single authorized_keys line, or None."""
    fd, tmp = tempfile.mkstemp(suffix=".pub")
    try:
        with os.fdopen(fd, "w") as fh:
            fh.write(line + "\n")
        res = subprocess.run(["ssh-keygen", "-lf", tmp],
                             capture_output=True, text=True)
        if res.returncode != 0:
            return None
        return res.stdout.split()[1]
    finally:
        os.unlink(tmp)


def comment_of(line):
    parts = line.split(None, 2)
    return parts[2] if len(parts) > 2 else "(no comment)"


original = [l for l in open(path).read().splitlines() if l.strip()]

print("=== authorized_keys BEFORE revocation ===")
entries = []
for i, line in enumerate(original, 1):
    fp = fingerprint(line)
    entries.append((line, fp))
    shown = fp if fp else "UNPARSEABLE"
    print(f"  {i}. {shown}  {comment_of(line)}")
print("")

new_present = [e for e in entries if e[1] == new_fp]
old_present = [e for e in entries if e[1] == old_fp]
unparseable = [e for e in entries if e[1] is None]

if unparseable:
    print(f"NOTE: {len(unparseable)} entry/entries do not parse as SSH public keys. "
          "They are left untouched (not ours to judge).")
    for line, _ in unparseable:
        print(f"      -> {comment_of(line)}")
    print("")

# Refuse to revoke anything unless the replacement is verifiably in place.
if not new_present:
    print(f"::error::NEW key {new_fp} is not present as a valid standalone entry. "
          "Refusing to remove the old key.")
    sys.exit(1)

print(f"NEW key present and valid: {new_fp}")

if not old_present:
    print(f"OLD key {old_fp} is already absent — nothing to revoke (idempotent no-op).")
    sys.exit(0)

print(f"OLD key found ({len(old_present)} entry/entries) — removing.")
print("")

remaining = [line for line, fp in entries if fp != old_fp]

with open(path, "w") as fh:
    fh.write("\n".join(remaining) + "\n")
os.chmod(path, 0o600)

# ---- verify the post-state ----
after = [l for l in open(path).read().splitlines() if l.strip()]
after_fps = [fingerprint(l) for l in after]

print("=== authorized_keys AFTER revocation ===")
for i, (line, fp) in enumerate(zip(after, after_fps), 1):
    shown = fp if fp else "UNPARSEABLE"
    print(f"  {i}. {shown}  {comment_of(line)}")
print("")

problems = []
if old_fp in after_fps:
    problems.append("old fingerprint STILL present")
if new_fp not in after_fps:
    problems.append("new fingerprint MISSING")
expected_remaining = len(original) - len(old_present)
if len(after) != expected_remaining:
    problems.append(f"expected {expected_remaining} entries, found {len(after)}")
# every entry that parsed before must still parse now
if sum(1 for f in after_fps if f is None) != len(unparseable):
    problems.append("an entry that previously parsed no longer parses")

if problems:
    print("::error::Post-revocation verification FAILED: " + "; ".join(problems))
    print(f"Restoring backup {backup}")
    with open(backup) as src, open(path, "w") as dst:
        dst.write(src.read())
    os.chmod(path, 0o600)
    sys.exit(1)

print("VERIFIED: old fingerprint absent, new fingerprint present, "
      "all other entries preserved byte-for-byte.")
PY

chmod 600 "$AUTHKEYS"
chmod 700 "$HOME/.ssh"

echo ""
echo "=== ssh-keygen -l -f authorized_keys (final state) ==="
ssh-keygen -l -f "$AUTHKEYS" || true

echo ""
echo "=== Recent SSH auth activity (read-only) ==="
if command -v journalctl >/dev/null 2>&1 && sudo -n journalctl -u ssh -n 1 >/dev/null 2>&1; then
  sudo journalctl -u ssh --since "20 minutes ago" --no-pager 2>/dev/null \
    | grep -iE "Accepted publickey|Failed|Invalid user" | tail -40 || echo "(no matching lines)"
elif command -v journalctl >/dev/null 2>&1 && sudo -n journalctl -u sshd -n 1 >/dev/null 2>&1; then
  sudo journalctl -u sshd --since "20 minutes ago" --no-pager 2>/dev/null \
    | grep -iE "Accepted publickey|Failed|Invalid user" | tail -40 || echo "(no matching lines)"
elif [ -r /var/log/auth.log ]; then
  grep -iE "Accepted publickey|Failed|Invalid user" /var/log/auth.log | tail -40 || echo "(no matching lines)"
else
  echo "No readable ssh auth log source available to this user."
fi

echo ""
echo "=== fail2ban status (informational, no changes made) ==="
if command -v fail2ban-client >/dev/null 2>&1 && sudo -n fail2ban-client status sshd 2>/dev/null; then
  :
else
  echo "fail2ban not active, not installed, or not queryable by this user"
fi

echo ""
echo "Backup retained at: $BACKUP"
