# 030 — Go live on subbed.ca

Status: draft

<!-- Written 2026-11-22. Runs after spec 029 (phone polish) is merged and the user says go.
Builds on spec 020 (Docker and Caddy) and 028 (the Subbed name). -->

## Goal

Subbed is live at `https://subbed.ca` on the user's droplet, behind Cloudflare's proxy (orange cloud), survives a reboot, and backs up its database every night. The main session sets the server up over `ssh droplet` and shows every command it runs.

## What is known (checked read-only on 2026-11-22)

- Droplet `143.110.223.217`: Ubuntu 24.04, 1 vCPU, 2 GB memory, 48 GB disk, no swap, no Docker, firewall off.
- SSH: key only (password login already off), root login with the key. Automatic security updates already on.
- DNS: `subbed.ca` is on Cloudflare; no `A` record yet.
- Repo: `github.com/itsvictorvelma/subbed` (public), so the server clones over HTTPS with no key.

## In scope

Repo changes (one small PR)
- `Caddyfile`: `www.subbed.ca` redirects permanently to `https://subbed.ca`, keeping the path.
- `Caddyfile`: Cloudflare's published address ranges (from `cloudflare.com/ips-v4` and `/ips-v6`, copied in when built) are trusted proxies, and the visitor's IP is read from `CF-Connecting-IP`. Caddy passes the app one `X-Forwarded-For` value, the resolved visitor IP (`header_up X-Forwarded-For {client_ip}`): appending would put a Cloudflare address last, and the app would take that as the guest. No app change.
- `scripts/backup.sh` (new, run on the server by cron): a safe SQLite copy of the live database into `/root/backups/subbed-YYYY-MM-DD.db`, keeping the newest 14.
- README Deploy section: Cloudflare (records, SSL mode, when to turn the proxy on, refreshing the ranges), the `www` record, the DigitalOcean Cloud Firewall, the nightly backup line, and moving a local database to the server.
- `specs/README.md`: 020 and 028 to `done`, 030 added.

Server setup (run by the main session, after the PR is merged)
1. `apt update && apt upgrade -y`; reboot if the system asks for it.
2. 1 GB swap file (headroom for the page build on 2 GB).
3. Docker Engine and Compose from Docker's own install script.
4. Firewall (`ufw`): allow OpenSSH, 80/tcp, 443/tcp, 443/udp; deny the rest; enable.
5. SSH: `PermitRootLogin prohibit-password` (key only, stated outright).
6. `git clone` the repo to `/root/subbed`.
7. `.env`: copied from the user's Mac with `scp` (the keys are never printed or read into the chat), then `SUBBED_DOMAIN=subbed.ca` set, `chmod 600`.
8. `scripts/deploy.sh`.
9. Local database moved over, if the user chooses that (see Decisions).
10. Cron: `scripts/backup.sh` every night at 03:30 server time.

Cloudflare and the firewall (in this order)
1. Now (user): two `A` records, **DNS only (grey cloud)** for the moment: `subbed.ca` and `www`, both → `143.110.223.217`. No `AAAA` records (Cloudflare serves IPv6 to visitors itself once proxied).
2. User: SSL/TLS mode **Full (strict)** (never Flexible: it loops with Caddy's HTTP→HTTPS redirect). "Always Use HTTPS" may stay on.
3. After the first deploy shows a valid Let's Encrypt certificate (AC-3 on grey): the user switches both records to **Proxied**.
4. After AC-3 passes again through the proxy: the user adds a DigitalOcean Cloud Firewall (free, in the panel) on the droplet: inbound 22 from anywhere, 80 and 443 (TCP) only from Cloudflare's ranges. The main session gives the exact list. This stops anyone skipping Cloudflare by using the IP.

## Out of scope

- Feature or page changes; CI/CD; monitoring or alerting; email.
- Cloudflare rules beyond the defaults (WAF rules, rate limiting, Bot Fight Mode settings). Their defaults stay.
- A non-root login user (on a one-app box behind a key it adds steps without real gain; revisit if others get access).
- Backups off the server (DigitalOcean's paid weekly backups are an option the user can switch on in the panel).

## Rules

- Every server command is shown before it runs. Nothing is deleted on the server except old backup files beyond the newest 14.
- Secrets: `.env` goes from the Mac to the server by `scp` only. No command prints it (`cat .env`, `docker compose config`, `env`).
- The proxy goes on only after Caddy holds a valid certificate, and only with SSL mode Full (strict). Renewal then runs through the proxy: in Full mode Cloudflare reaches the origin on port 80 for HTTP requests and does not redirect `/.well-known/acme-challenge/`, so Caddy's HTTP challenge still works. If a renewal ever fails (seen in `docker compose logs caddy`), the fallback is a Cloudflare Origin Certificate in Caddy, as its own small change.
- Guest IPs: only Cloudflare's ranges may set the visitor IP for Caddy, and only Caddy may for the app (spec 020). A request straight to the IP (before the Cloud Firewall) cannot fake one: its sender is not a trusted proxy.
- `scripts/backup.sh` uses SQLite's backup API inside the running container, so the copy is consistent while the app runs. A failed backup exits non-zero and leaves older copies alone.
- Moving the local database: stop the local backend, make a safe copy on the Mac, copy it to the server, put it on the `subbed-data` volume owned by the app user (uid 10001) while the app is stopped, start it again.

## Security

- Only 22, 80, and 443 answer from the internet; the app's port 8000 is never published. After step 4, 80 and 443 answer only Cloudflare.
- SSH stays key only. Docker's published ports bypass `ufw`, which is why the Cloudflare-only rule lives in the DigitalOcean Cloud Firewall, not `ufw`.
- The droplet's IP is not in public DNS once proxied (the domain is new, so no history exposes it).
- `www` and plain HTTP both end at `https://subbed.ca`, with HSTS (spec 020).
- Backups hold password hashes and session hashes; they stay in `/root/backups` (root only, `chmod 700`).

## Decisions for the user (before go)

- D-1: Move the local database (your account, saved songs, and the cached songs, which save translator quota) or start empty? Proposed: move it.
- D-2: Redirect `www.subbed.ca`? Proposed: yes.
- (Decided 2026-11-22: Cloudflare proxied, orange cloud.)
- D-3: Switch on DigitalOcean's paid weekly backups as well? Proposed: your call; the nightly copies cover a broken update, not a lost droplet.

## Acceptance checks

- AC-1: `scripts/backup.sh` makes a consistent copy and keeps only the newest 14 (test with a temporary folder and a fake `docker`, no network).
- AC-2: The Caddyfile is valid (`caddy validate` in the local compose run), redirects `www.` to the bare domain, and with a request from a trusted range carrying `CF-Connecting-IP` the app logs that IP; from an untrusted sender the header is ignored (local compose run with a test range).
- AC-3 (server): On grey, `https://subbed.ca` loads with a valid Let's Encrypt certificate. Proxied, it loads through Cloudflare (`cf-ray` header present); `http://subbed.ca` and `https://www.subbed.ca/library` end at `https://subbed.ca/...`.
- AC-4 (server): `/api/health` is ok; `docker compose ps` shows `subbed` healthy and `caddy` up.
- AC-5 (server): From the Mac, port 8000 does not answer, and `ufw status` lists only 22, 80, 443. After the Cloud Firewall, `curl https://143.110.223.217` from the Mac gets no answer while the site still loads.
- AC-6 (server): Sign up (or sign in, if the database was moved), search, open a song, save it. The server log shows the Mac's public IP, not a Cloudflare or Caddy address.
- AC-7 (server): After `reboot`, the site comes back by itself.
- AC-8 (server): Running the cron line by hand writes a backup file; `crontab -l` shows the nightly entry.

## Plan

Added after approval.
