#!/usr/bin/env bash
# READ-ONLY forensic inspection of the VPS deploy account.
#
# Changes nothing. Answers, with evidence:
#   - which keys are currently authorized (fingerprints + comments only);
#   - which fingerprints have actually authenticated, and from where;
#   - when the unexpected RSA key first appeared, using authorized_keys
#     backups as a crude timeline;
#   - whether that RSA key has ever authenticated successfully.
#
# Never prints private key material. Public keys/fingerprints only.
set -uo pipefail

NEW_ED25519="SHA256:MW/RWTGOYpbmwOSrzb4UQlcS4mhjpoPgSqSkfJDTeSw"
OLD_ED25519="SHA256:NrTF6iy/8qYWL662L0Z+FRCohINqrNhljomafqxcXOY"
MYSTERY_RSA="SHA256:pTthshlrcrdAuhT57Sz29QWQB37FHp6LKrPNBlGT4oI"
AUTHKEYS="$HOME/.ssh/authorized_keys"

echo "############ 1. CURRENT authorized_keys ############"
echo "path: $AUTHKEYS   (mode: $(stat -c '%a' "$AUTHKEYS" 2>/dev/null), owner: $(stat -c '%U' "$AUTHKEYS" 2>/dev/null))"
python3 - "$AUTHKEYS" <<'PY'
import os, subprocess, sys, tempfile
path = sys.argv[1]
for i, line in enumerate([l for l in open(path).read().splitlines() if l.strip()], 1):
    fd, tmp = tempfile.mkstemp(suffix=".pub")
    with os.fdopen(fd, "w") as fh:
        fh.write(line + "\n")
    r = subprocess.run(["ssh-keygen", "-lf", tmp], capture_output=True, text=True)
    os.unlink(tmp)
    parts = line.split(None, 2)
    comment = parts[2] if len(parts) > 2 else "(no comment)"
    if r.returncode == 0:
        f = r.stdout.split()
        print(f"  {i}. {f[0]:>5}  {f[1]}  {comment}  [{f[-1]}]")
    else:
        print(f"  {i}. UNPARSEABLE  {comment}")
PY

echo ""
echo "############ 2. authorized_keys BACKUP TIMELINE ############"
echo "Which backups contain the unexpected RSA key? (earliest containing it = when it appeared)"
shopt -s nullglob
found_any=0
for b in "$HOME"/.ssh/authorized_keys.backup-* "$HOME"/.ssh/authorized_keys.bak* "$HOME"/.ssh/authorized_keys.*; do
  [ -f "$b" ] || continue
  found_any=1
  mtime=$(stat -c '%y' "$b" 2>/dev/null | cut -d. -f1)
  n=$(grep -c . "$b" 2>/dev/null)
  if grep -qF "github-actions-asensios-rotated" "$b" 2>/dev/null; then
    rot="rotated-comment: YES"
  else
    rot="rotated-comment: no"
  fi
  # count how many distinct ssh-rsa entries carry the rotated comment
  rsa_rot=$(grep -c '^ssh-rsa .*rotated' "$b" 2>/dev/null || echo 0)
  echo "  $(basename "$b")  mtime=$mtime  lines=$n  $rot  rsa-with-rotated-comment=$rsa_rot"
done
[ "$found_any" = "0" ] && echo "  (no backup files found)"

echo ""
echo "############ 3. HAS EACH FINGERPRINT EVER AUTHENTICATED? ############"
LOGSRC=""
if command -v journalctl >/dev/null 2>&1 && sudo -n journalctl -u ssh -n 1 >/dev/null 2>&1; then
  LOGSRC="journalctl -u ssh"
elif command -v journalctl >/dev/null 2>&1 && sudo -n journalctl -u sshd -n 1 >/dev/null 2>&1; then
  LOGSRC="journalctl -u sshd"
fi

dump_logs() {
  if [ -n "$LOGSRC" ]; then
    sudo -n $LOGSRC --since "$1" --no-pager 2>/dev/null
  fi
  for f in /var/log/auth.log /var/log/auth.log.1 /var/log/secure; do
    [ -r "$f" ] && cat "$f"
  done
}

echo "log source: ${LOGSRC:-none} (plus /var/log/auth.log* if readable)"
echo "NOTE: coverage is limited by log retention; absence of evidence before the"
echo "      earliest retained entry is not evidence of absence."
echo ""
ALL=$(dump_logs "2026-01-01")
echo "earliest retained auth line:"
echo "$ALL" | grep -aiE "sshd" | head -1
echo ""
for pair in "NEW_ED25519:$NEW_ED25519" "OLD_ED25519:$OLD_ED25519" "MYSTERY_RSA:$MYSTERY_RSA"; do
  label="${pair%%:*}"; fp="${pair#*:}"
  count=$(echo "$ALL" | grep -aF "$fp" | grep -ac "Accepted publickey")
  echo "--- $label  $fp"
  echo "    successful authentications found: ${count:-0}"
  if [ "${count:-0}" != "0" ]; then
    echo "$ALL" | grep -aF "$fp" | grep -a "Accepted publickey" | tail -12 | sed 's/^/      /'
  fi
done

echo ""
echo "############ 4. ALL successful publickey logins (last 40) ############"
echo "$ALL" | grep -a "Accepted publickey" | tail -40 | sed 's/^/  /'

echo ""
echo "############ 5. Non-CI artifacts that might explain the RSA key ############"
echo "-- any RSA private keys in the deploy account's ~/.ssh --"
ls -la "$HOME/.ssh" 2>/dev/null | sed 's/^/  /'
echo "-- shell history mentioning ssh-keygen (best effort) --"
grep -ahE "ssh-keygen" "$HOME"/.bash_history "$HOME"/.zsh_history 2>/dev/null | tail -20 | sed 's/^/  /' || echo "  (no history available)"

echo ""
echo "############ 6. fail2ban ############"
if command -v fail2ban-client >/dev/null 2>&1; then
  sudo -n fail2ban-client status sshd 2>/dev/null | sed 's/^/  /' || echo "  (installed but not queryable)"
else
  echo "  fail2ban not installed"
fi

echo ""
echo "############ INVESTIGATION COMPLETE (nothing was modified) ############"
