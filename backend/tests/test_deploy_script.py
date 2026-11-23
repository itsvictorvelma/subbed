"""Tests for scripts/deploy.sh: Caddy restarts only when the Caddyfile changed (spec 030), with
fake `git` and `docker` and no network."""

import os
import shutil
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
DEPLOY_SCRIPT = REPO_ROOT / "scripts" / "deploy.sh"

# `rev-parse` gives the Caddyfile's id: "before" on the first call, $CADDYFILE_AFTER later.
FAKE_GIT = """#!/usr/bin/env bash
if [[ "$1" == "rev-parse" ]]; then
  if [[ -f "$FAKE_STATE/pulled" ]]; then echo "$CADDYFILE_AFTER"; else echo before; fi
elif [[ "$1" == "pull" ]]; then
  touch "$FAKE_STATE/pulled"
fi
"""

# Records each call; the app container is always healthy.
FAKE_DOCKER = """#!/usr/bin/env bash
echo "$*" >> "$FAKE_STATE/docker.log"
if [[ "$1 $2" == "compose ps" ]]; then echo container-id; fi
if [[ "$1" == "inspect" ]]; then echo healthy; fi
"""


def run_deploy(tmp_path: Path, caddyfile_after: str) -> tuple[int, str]:
    """Runs a copy of the script from a temporary repo; returns its exit code and docker calls."""
    (tmp_path / "scripts").mkdir()
    shutil.copy(DEPLOY_SCRIPT, tmp_path / "scripts" / "deploy.sh")
    (tmp_path / ".env").write_text("SUBBED_DOMAIN=example.test\n")
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    for name, body in (("git", FAKE_GIT), ("docker", FAKE_DOCKER)):
        (bin_dir / name).write_text(body)
        (bin_dir / name).chmod(0o755)
    environment = {
        **os.environ,
        "PATH": f"{bin_dir}:{os.environ['PATH']}",
        "FAKE_STATE": str(tmp_path),
        "CADDYFILE_AFTER": caddyfile_after,
    }
    finished = subprocess.run(
        ["bash", str(tmp_path / "scripts" / "deploy.sh")],
        env=environment,
        capture_output=True,
        text=True,
        timeout=30,
    )
    return finished.returncode, (tmp_path / "docker.log").read_text()


@pytest.mark.parametrize(("caddyfile_after", "restarted"), [("before", False), ("after", True)])
def test_caddy_restarts_only_when_the_caddyfile_changed(
    tmp_path: Path, caddyfile_after: str, restarted: bool
) -> None:
    exit_code, docker_calls = run_deploy(tmp_path, caddyfile_after)

    assert exit_code == 0
    assert "compose up -d --build" in docker_calls
    assert ("compose restart caddy" in docker_calls) is restarted
