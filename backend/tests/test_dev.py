"""Tests for the `fastapi dev` entry point: it loads the repo's `.env`, then builds the app."""

import importlib
import sys
import tomllib
from pathlib import Path

import dotenv
import pytest
from fastapi import FastAPI

BACKEND = Path(__file__).resolve().parents[1]


def test_fastapi_dev_points_at_the_dev_app() -> None:
    settings = tomllib.loads((BACKEND / "pyproject.toml").read_text())

    assert settings["tool"]["fastapi"]["entrypoint"] == "subbed.dev:app"


def test_the_dev_app_loads_the_repo_env_file_and_is_the_server(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Record the file instead of reading it, so no real key reaches the tests.
    loaded: list[Path] = []

    def record_load(path: Path) -> bool:
        loaded.append(path)
        return True

    monkeypatch.setattr(dotenv, "load_dotenv", record_load)
    monkeypatch.delitem(sys.modules, "subbed.dev", raising=False)

    dev = importlib.import_module("subbed.dev")

    assert loaded == [BACKEND.parent / ".env"]
    assert isinstance(dev.app, FastAPI)
