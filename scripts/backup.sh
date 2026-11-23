#!/usr/bin/env bash
# Run on the server (nightly by cron): a consistent copy of the live database, keeping the newest 14.
set -euo pipefail

KEEP=14

main() {
  local repo_root backup_dir name files old
  repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  cd "$repo_root"
  backup_dir="${SUBBED_BACKUP_DIR:-/root/backups}"
  name="subbed-$(date +%F).db"
  mkdir -p "$backup_dir"
  chmod 700 "$backup_dir"

  # SQLite's backup API, inside the running app container: consistent while the app writes.
  docker compose exec -T subbed python -c "import sqlite3; destination = sqlite3.connect('/data/backup.db'); sqlite3.connect('/data/subbed.db').backup(destination); destination.close()"
  docker compose cp subbed:/data/backup.db "$backup_dir/$name.partial"
  docker compose exec -T subbed rm -f /data/backup.db
  # Only a complete copy gets the real name; older copies are removed only after that.
  mv "$backup_dir/$name.partial" "$backup_dir/$name"

  # Dated names sort oldest first.
  files=("$backup_dir"/subbed-*.db)
  old=$((${#files[@]} - KEEP))
  if ((old > 0)); then
    rm -- "${files[@]:0:old}"
  fi
  echo "Backed up to $backup_dir/$name"
}

main "$@"
exit
