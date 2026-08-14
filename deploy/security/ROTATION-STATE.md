# Deploy key rotation — incident state

Editing this file triggers `.github/workflows/revoke-old-deploy-key.yml`.

## Incident

The GitHub Actions deploy key was printed in plaintext in the logs of 7
public workflow runs, because the "Prepare SSH key" step base64-decoded
`SSH_PRIVATE_KEY_B64` and passed the result through `$GITHUB_ENV`.
GitHub only auto-masks values referenced directly via the `secrets.*`
context, so the decoded value was echoed in every later step's `env:`
block. Fixed by registering every line of the decoded key with
`::add-mask::` immediately after decoding.

## Keys

| Role | Type | Fingerprint | Comment |
| --- | --- | --- | --- |
| Exposed, being revoked | ED25519 | `SHA256:NrTF6iy/8qYWL662L0Z+FRCohINqrNhljomafqxcXOY` | `github-actions-asensios` |
| Rotated replacement | ED25519 | `SHA256:MW/RWTGOYpbmwOSrzb4UQlcS4mhjpoPgSqSkfJDTeSw` | `github-actions-asensios-rotated-20260814-185255` |

## Timeline

- **18:52** — new ed25519 keypair generated; private half delivered out of
  band, never committed or logged.
- **18:55** — new public key appended to `authorized_keys`. The append
  landed on a line with no trailing newline and concatenated onto the
  `github-actions-asensios` entry, leaving one unparseable line. Both
  deploy keys stopped authenticating; personal keys were unaffected.
- **~19:5x** — `SSH_PRIVATE_KEY_B64` updated with the rotated key.
- **20:03** — line boundaries repaired from the Hostinger browser
  terminal. Backup: `/root/.ssh/authorized_keys.backup-20260814-200333`.
- **20:06 / 20:09 / 20:10** — blog and apex pipelines deploy successfully;
  sshd logs record 14 `Accepted publickey` events for the rotated
  fingerprint.
- **Now** — old exposed key revoked by fingerprint.

## Unexpected RSA key — resolved, no action taken

An RSA key `SHA256:pTthshlrcrdAuhT57Sz29QWQB37FHp6LKrPNBlGT4oI` was
briefly observed in `authorized_keys`. It is **not** a remediation
artifact: only one keypair was generated during this incident (the
ed25519 above), and the CI secret verifiably contains that ed25519.

sshd logs show it authenticated twice, both at 20:03:28, from
`169.254.0.1` — a link-local address, i.e. Hostinger's browser-terminal
gateway, at exactly the moment the console session was used to repair
the file. The same pattern appears with distinct one-time RSA keys on
Aug 7 (`rrUali…`), Aug 10 (`wqgwJdq…`) and Aug 12 (`7EL1+d/…`), each
since removed. It is an ephemeral console session key injected and
reaped by the hosting panel, and it was already absent from
`authorized_keys` by 20:10. Nothing was done to it.

## Known pre-existing issue, left alone

`github-actions-deploy` is a malformed entry: an X.509 SubjectPublicKeyInfo
DER blob wrapped in an `ssh-rsa` header. It does not parse and has never
been usable. Left untouched — it is not part of this incident.
