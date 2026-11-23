"""The app for `uv run fastapi dev`: loads the repo's `.env` first, then builds the server."""

import logging
from pathlib import Path

from dotenv import load_dotenv

# `config` reads the environment when it is imported, so `.env` must be loaded before the app is.
# Values already set in the shell win over the file.
load_dotenv(Path(__file__).resolve().parents[3] / ".env")

from subbed import config  # noqa: E402
from subbed.app import create_app  # noqa: E402

logging.getLogger("subbed").setLevel(config.LOG_LEVEL)

app = create_app()
