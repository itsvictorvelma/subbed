# 030 — Go live on subbed.ca

Status: draft

<!-- Written 2026-11-22. Runs after spec 029 (phone polish) is merged and the user says go.
Builds on spec 020 (Docker and Caddy) and 028 (the Subbed name). -->

## Goal

Subbed is live at `https://subbed.ca` on the user's droplet, survives a reboot, and backs up its database every night. The main session sets the server up over `ssh droplet` and shows every command it runs.

## What is known (checked read-only on 2026-11-22)

- Droplet `143.110.223.217`: Ubuntu 24.04, 1 vCPU, 2 GB memory, 48 GB disk, no swap, no Docker, firewall off.
- SSH: key only (password login already off), root login with the key. Automatic security updates already on.
- DNS: `subbed.ca` is on Cloudflare; no `A` record yet.
- Repo: `github.com/itsvictorvelma/subbed` (public), so the server clones over HTTPS with no key.

## In scope

Repo changes (one small PR)
- `Caddyfile`: `www.subbed.ca` redirects permanently to `https://subbed.ca`, keeping the path.
- `scripts/backup.sh` (new, run on the server by cron): a safe SQLite copy of the live database into `/root/backups/subbed-YYYY-MM-DD.db`, keeping the newest 14.
- README Deploy section: the Cloudflare "DNS only" rule, the `www` record, the nightly backup line, and moving a local database to the server.
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

The user's side
- In Cloudflare, add two `A` records, both **DNS only (grey cloud)**: `subbed.ca` → `143.110.223.217` and `www` → `143.110.223.217`. No `AAAA` records.

## Out of scope

- Feature or page changes; CI/CD; monitoring or alerting; email.
- Cloudflare's proxy (orange cloud). If it is ever wanted, it needs its own spec: the client IP would come from Cloudflare, and the daily caps per guest would need Cloudflare's header.
- A non-root login user (on a one-app box behind a key it adds steps without real gain; revisit if others get access).
- Backups off the server (DigitalOcean's paid weekly backups are an option the user can switch on in the panel).

## Rules

- Every server command is shown before it runs. Nothing is deleted on the server except old backup files beyond the newest 14.
- Secrets: `.env` goes from the Mac to the server by `scp` only. No command prints it (`cat .env`, `docker compose config`, `env`).
- DNS must be DNS only before the first start, or Caddy cannot get the certificate and guests all share Cloudflare's addresses.
- `scripts/backup.sh` uses SQLite's backup API inside the running container, so the copy is consistent while the app runs. A failed backup exits non-zero and leaves older copies alone.
- Moving the local database: stop the local backend, make a safe copy on the Mac, copy it to the server, put it on the `subbed-data` volume owned by the app user (uid 10001) while the app is stopped, start it again.

## Security

- Only 22, 80, and 443 answer from the internet; the app's port 8000 is never published.
- SSH stays key only. Docker's published ports bypass `ufw`, which is fine here because only Caddy publishes any.
- `www` and plain HTTP both end at `https://subbed.ca`, with HSTS (spec 020).
- Backups hold password hashes and session hashes; they stay in `/root/backups` (root only, `chmod 700`).

## Decisions for the user (before go)

- D-1: Move the local database (your account, saved songs, and the cached songs, which save translator quota) or start empty? Proposed: move it.
- D-2: Redirect `www.subbed.ca`? Proposed: yes.
- D-3: Switch on DigitalOcean's paid weekly backups as well? Proposed: your call; the nightly copies cover a broken update, not a lost droplet.

## Acceptance checks

- AC-1: `scripts/backup.sh` makes a consistent copy and keeps only the newest 14 (test with a temporary folder and a fake `docker`, no network).
- AC-2: The Caddyfile redirects `www.` to the bare domain (checked with `caddy validate` in the local compose run, and on the server in AC-4).
- AC-3 (server): `https://subbed.ca` loads with a valid Let's Encrypt certificate; `http://subbed.ca` and `https://www.subbed.ca/library` end at `https://subbed.ca/...`.
- AC-4 (server): `/api/health` is ok; `docker compose ps` shows `subbed` healthy and `caddy` up.
- AC-5 (server): From the Mac, port 8000 does not answer, and `ufw status` lists only 22, 80, 443.
- AC-6 (server): Sign up (or sign in, if the database was moved), search, open a song, save it. The server log shows the Mac's public IP, not Caddy's.
- AC-7 (server): After `reboot`, the site comes back by itself.
- AC-8 (server): Running the cron line by hand writes a backup file; `crontab -l` shows the nightly entry.

## Plan

Added after approval.
