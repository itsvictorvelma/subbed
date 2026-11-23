# 030 — Go live on subbed.ca

Status: approved

<!-- Written 2026-11-22. Builds on spec 020 (Docker and Caddy) and 028 (the Subbed name). -->

## Goal

Subbed is live at `https://subbed.ca` behind Cloudflare's proxy (orange cloud), comes back by itself after a reboot, and backs up its database every night.

## In scope

- `Caddyfile`: `www.subbed.ca` redirects permanently to `https://subbed.ca`, keeping the path.
- `Caddyfile`: Cloudflare's published address ranges (`cloudflare.com/ips-v4` and `/ips-v6`) are trusted proxies, and the visitor's IP is read from `CF-Connecting-IP`. Caddy passes the app one `X-Forwarded-For` value, the resolved visitor IP (`header_up X-Forwarded-For {client_ip}`): appending would put a Cloudflare address last, and the app would take that as the guest. No app change.
- `scripts/backup.sh` (new, run on the server by cron): a consistent SQLite copy of the live database into a backups folder, `subbed-YYYY-MM-DD.db`, keeping the newest 14.
- README Deploy section: Cloudflare (records, SSL mode, when to turn the proxy on, the ranges), the `www` record, the DigitalOcean Cloud Firewall, nightly backups, and moving a local database to the server.
- `specs/README.md`: 020, 028, and 029 to `done`, 030 added.

Server setup follows the README's Deploy section. Server details (addresses, accounts, what is installed, progress) stay out of the repo, specs, commits, and PRs.

Cloudflare and the firewall, in this order:
1. `A` records for `subbed.ca` and `www`, **DNS only** at first. No `AAAA` records (Cloudflare serves IPv6 to visitors itself once proxied).
2. SSL/TLS mode **Full (strict)** (never Flexible: it loops with Caddy's HTTP→HTTPS redirect).
3. After the first deploy has a valid Let's Encrypt certificate and this PR is deployed: both records to **Proxied**.
4. A DigitalOcean Cloud Firewall: inbound SSH from anywhere, 80 and 443 only from Cloudflare's ranges. This stops anyone skipping Cloudflare by using the server's address.

## Out of scope

- Feature or page changes; CI/CD; monitoring or alerting; email.
- Cloudflare rules beyond the defaults (WAF, rate limiting, bot settings).
- Paid backups (decided: no paid extras).

## Rules

- No server address, account, or setup detail is written to the repo, a spec, a commit, or a PR.
- Secrets: `.env` goes to the server by `scp` only; no command prints it.
- The proxy goes on only after Caddy holds a valid certificate, and only with Full (strict). Renewals then run through the proxy: Cloudflare forwards `/.well-known/acme-challenge/` over HTTP to the origin. If one ever fails (`docker compose logs caddy`), the fallback is a Cloudflare Origin Certificate, as its own small change.
- Guest IPs: only Cloudflare's ranges may name the visitor to Caddy, and only Caddy may to the app (spec 020). A request from anywhere else cannot fake one.
- `scripts/backup.sh` uses SQLite's backup API inside the running container, so the copy is consistent while the app runs. A failed backup exits non-zero and leaves older copies alone.

## Security

- Only SSH, 80, and 443 answer from the internet; the app's port 8000 is never published. After step 4, 80 and 443 answer only Cloudflare.
- Docker's published ports bypass `ufw`, which is why the Cloudflare-only rule lives in the DigitalOcean Cloud Firewall.
- The server's address is treated as known (DNS history keeps it from the DNS-only start); the Cloud Firewall, not secrecy, keeps visitors going through Cloudflare.
- Backups hold password and session hashes; their folder is `chmod 700`.

## Decisions (2026-11-22)

- The local database moves to the server.
- `www.subbed.ca` sends visitors on to `subbed.ca`.
- No paid extras; the nightly copies are the backup.
- Cloudflare proxied.

## Acceptance checks

- AC-1: `scripts/backup.sh` makes a copy and keeps only the newest 14; a failure leaves older copies (test with a fake `docker`, no network).
- AC-2: The Caddyfile is valid, redirects `www.` to the bare domain, and the app logs the `CF-Connecting-IP` visitor only when the request comes from a trusted range (local compose run with a test range).
- AC-3 (server): `https://subbed.ca` loads with a valid certificate, through Cloudflare once proxied; `http://` and `www.` end at `https://subbed.ca/...`.
- AC-4 (server): `/api/health` is ok; `subbed` healthy and `caddy` up.
- AC-5 (server): Port 8000 does not answer from outside. After the Cloud Firewall, a request straight to the server's address gets no answer while the site still loads.
- AC-6 (server): Sign in, search, open a song, save it; the log shows the visitor's own IP.
- AC-7 (server): After a reboot, the site comes back by itself.
- AC-8 (server): The cron line run by hand writes a backup file.

## Plan

- `Caddyfile`: a global `servers` block with `trusted_proxies static` and `client_ip_headers CF-Connecting-IP`; a `www.{$SUBBED_DOMAIN}` site with `redir ... permanent`; `header_up X-Forwarded-For {client_ip}`.
- `scripts/backup.sh` and `backend/tests/test_backup_script.py` (AC-1; backups folder from `SUBBED_BACKUP_DIR`, default `~/backups`).
- README Deploy section; `specs/README.md`.
