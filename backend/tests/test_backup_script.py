"""Tests for scripts/backup.sh (spec 030 AC-1), run with a fake `docker` and no network."""

import os
import shutil
import subprocess
from datetime import date
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKUP_SCRIPT = REPO_ROOT / "scripts" / "backup.sh"

# Records each call; `compose cp <from> <to>` writes a stand-in database file at <to>.
FAKE_DOCKER = """#!/usr/bin/env bash
echo "$*" >> "$FAKE_DOCKER_LOG"
if [[ -n "${FAKE_DOCKER_FAIL:-}" ]]; then exit 1; fi
if [[ "$1 $2" == "compose cp" ]]; then echo "database" > "$4"; fi
"""


@pytest.fixture
def backup_dir(tmp_path: Path) -> Path:
    return tmp_path / "backups"


def run_backup(
    tmp_path: Path, backup_dir: Path, fail: bool = False
) -> subprocess.CompletedProcess[str]:
    """Runs a copy of the script from a temporary repo, with the fake docker first on PATH."""
    (tmp_path / "scripts").mkdir(exist_ok=True)
    script = tmp_path / "scripts" / "backup.sh"
    shutil.copy(BACKUP_SCRIPT, script)
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir(exist_ok=True)
    docker = bin_dir / "docker"
    docker.write_text(FAKE_DOCKER)
    docker.chmod(0o755)
    environment = {
        **os.environ,
        "PATH": f"{bin_dir}:{os.environ['PATH']}",
        "SUBBED_BACKUP_DIR": str(backup_dir),
        "FAKE_DOCKER_LOG": str(tmp_path / "docker.log"),
    }
    if fail:
        environment["FAKE_DOCKER_FAIL"] = "1"
    return subprocess.run(
        ["bash", str(script)], env=environment, capture_output=True, text=True, timeout=30
    )


def make_old_backups(backup_dir: Path, count: int) -> list[Path]:
    backup_dir.mkdir(parents=True)
    old = [backup_dir / f"subbed-2026-01-{day:02d}.db" for day in range(1, count + 1)]
    for file in old:
        file.write_text("old")
    return old


def test_ac1_a_backup_is_made_through_the_backup_api_and_the_newest_14_are_kept(
    tmp_path: Path, backup_dir: Path
) -> None:
    old = make_old_backups(backup_dir, 15)

    finished = run_backup(tmp_path, backup_dir)

    assert finished.returncode == 0, finished.stderr
    today = backup_dir / f"subbed-{date.today():%Y-%m-%d}.db"
    assert today.read_text() == "database\n"
    kept = sorted(backup_dir.iterdir())
    assert len(kept) == 14
    assert old[0] not in kept and old[1] not in kept
    assert oct(backup_dir.stat().st_mode & 0o777) == "0o700"
    calls = (tmp_path / "docker.log").read_text()
    assert ".backup(" in calls
    assert "rm -f /data/backup.db" in calls


def test_ac1_a_failed_backup_exits_non_zero_and_leaves_older_copies(
    tmp_path: Path, backup_dir: Path
) -> None:
    old = make_old_backups(backup_dir, 15)

    finished = run_backup(tmp_path, backup_dir, fail=True)

    assert finished.returncode != 0
    assert sorted(backup_dir.iterdir()) == old
