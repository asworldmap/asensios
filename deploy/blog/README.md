# Deploying blog.asensios.com — VPS runbook

This session (Claude Code running in an isolated cloud container) has **no
SSH/sudo access to the Hostinger VPS**, no `caddy` binary, no `/var/www`, and
its outbound network is policy-blocked to `asensios.com` and its subdomains.
Everything in this folder was prepared and locally sanity-checked (Caddy
syntax validated against a local Caddy 2.6.2 install, not the production
Caddyfile) but **none of it has been run against production.** Run the
following on the actual VPS, over SSH, as a user with sudo.

## 1. Audit (read-only, run first)

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo grep -n -A25 -B8 'asensios.com' /etc/caddy/Caddyfile
curl -I https://asensios.com
curl -I https://www.asensios.com
dig NS asensios.com +short
dig asensios.com +short
dig blog.asensios.com +short
```

Confirm: Caddy is in fact the web server for asensios.com (this repo's
`.github/workflows/deploy.yml` currently deploys the apex site via rsync
over SSH to a document root — the README describes that target as
Apache/LiteSpeed. Verify which is actually true on this VPS before editing
any Caddyfile).

## 2. DNS

```bash
dig blog.asensios.com +short
```

If empty, create in whichever provider is authoritative (`dig NS
asensios.com +short` tells you):

```
Type: A
Name/Host: blog
Value: <the same public IPv4 currently serving asensios.com>
```

If Cloudflare is authoritative, match the existing proxy on/off convention
used for the apex/www records.

## 3. Caddy

```bash
sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.backup-$(date +%Y%m%d-%H%M%S)
```

Append the block from `Caddyfile.blog.snippet` (in this folder) to
`/etc/caddy/Caddyfile` as a separate site block. Do not touch the existing
apex block.

```bash
sudo caddy fmt --overwrite /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
# ONLY if validation succeeds:
sudo systemctl reload caddy
curl -I https://asensios.com
curl -I https://www.asensios.com
```

## 4. Deploy the static files

Either:

- **Manual**: copy `blog/` from this repo to the VPS (e.g. `rsync -az
  blog/ user@host:/tmp/papeles-desde-santiago/`), then run
  `sudo deploy-blog.sh /tmp/papeles-desde-santiago` (this folder's script —
  it backs up any existing `/var/www/blog.asensios.com` to `/var/backups/`
  before syncing).
- **CI**: set the `REMOTE_TARGET_BLOG` GitHub Actions secret to
  `/var/www/blog.asensios.com` and the existing `deploy-blog` job in
  `.github/workflows/deploy.yml` will rsync `blog/` there on every push to
  `main`, using the same SSH secrets already configured for the apex
  deploy. It never touches the apex deploy target.

## 5. Verify

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://blog.asensios.com/
curl -sS -o /dev/null -w '%{http_code}\n' https://blog.asensios.com/papeles/001-no-parti-el-dia-previsto.html
curl -sS -o /dev/null -w '%{http_code}\n' https://blog.asensios.com/papeles/002-una-bicicleta-ordeno-santiago.html
curl -sS -o /dev/null -w '%{http_code}\n' https://blog.asensios.com/papeles/003-dificil-arte-estarse-quieto.html
curl -sS -o /dev/null -w '%{http_code}\n' https://blog.asensios.com/robots.txt
curl -sS -o /dev/null -w '%{http_code}\n' https://blog.asensios.com/sitemap.xml
curl -sS -o /dev/null -w '%{http_code}\n' https://blog.asensios.com/this-page-does-not-exist
curl -I https://asensios.com
curl -I https://www.asensios.com
```

Expect 200 on the blog pages, robots.txt and sitemap.xml; 404 on the fake
URL; healthy apex/www.

## Rollback

```bash
# Caddy
sudo cp /etc/caddy/Caddyfile.backup-<timestamp> /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy

# Blog files
sudo rm -rf /var/www/blog.asensios.com
sudo cp -a /var/backups/blog.asensios.com-<timestamp> /var/www/blog.asensios.com
```
