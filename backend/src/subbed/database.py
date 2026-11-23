"""The one SQLite file: its connections, its one-time setup, every table, and the upgrade of an
older file."""

import sqlite3
import threading
from collections.abc import Iterator
from contextlib import closing, contextmanager
from pathlib import Path

from subbed import config

CREATE_TABLES = (
    # The shared song cache: every song anyone opened, with its lines.
    """CREATE TABLE IF NOT EXISTS songs (
        id INTEGER PRIMARY KEY,
        track TEXT NOT NULL,
        artist TEXT NOT NULL,
        album TEXT NOT NULL,
        duration_seconds INTEGER NOT NULL,
        lines_json TEXT NOT NULL,
        cached_at REAL NOT NULL,
        last_opened_at REAL NOT NULL
    )""",
    # One row per song a person saved. `user_id` is NULL only for songs saved before accounts.
    """CREATE TABLE IF NOT EXISTS library_entries (
        user_id INTEGER,
        song_id INTEGER NOT NULL,
        video_id TEXT,
        offset_ms INTEGER NOT NULL DEFAULT 0,
        saved_at REAL NOT NULL,
        last_opened_at REAL NOT NULL,
        UNIQUE (user_id, song_id)
    )""",
    """CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at REAL NOT NULL
    )""",
    # Only the SHA-256 hash of each session token is kept, never the token.
    """CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        expires_at REAL NOT NULL
    )""",
    # How many times `who` did `kind` in the window that starts at `window_start`.
    """CREATE TABLE IF NOT EXISTS request_counts (
        kind TEXT NOT NULL,
        who TEXT NOT NULL,
        window_start INTEGER NOT NULL,
        count INTEGER NOT NULL,
        PRIMARY KEY (kind, who, window_start)
    )""",
)

# Columns the old `saved_songs` table gained over time, for files made before them.
OLD_ADDED_COLUMNS = {
    "video_id": "TEXT",
    "offset_ms": "INTEGER NOT NULL DEFAULT 0",
    "saved": "INTEGER NOT NULL DEFAULT 1",
}


# How long a connection waits for another's lock before it gives up.
BUSY_TIMEOUT_SECONDS = 5.0

# The files already set up by this process, so setup runs once per file, not once per request.
ready_files: set[Path] = set()
setup_lock = threading.Lock()


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    """A connection to the file at `config.DATABASE_PATH`, set up the first time it is used.

    The `with` block is one transaction: committed when it ends, rolled back on an error.
    """
    path = config.DATABASE_PATH
    if path not in ready_files:
        set_up(path)
    with closing(open_connection(path)) as connection, connection:
        yield connection


def open_connection(path: Path) -> sqlite3.Connection:
    """A connection that waits for locks, and syncs to disk at checkpoints rather than on
    every commit (safe in WAL mode: a crash can lose the last commits, never corrupt the file)."""
    connection = sqlite3.connect(path, timeout=BUSY_TIMEOUT_SECONDS)
    connection.execute("PRAGMA synchronous = NORMAL")
    return connection


def set_up(path: Path) -> None:
    """Creates the folder and the tables, upgrades an older file, and turns on WAL, once.

    WAL (write-ahead log) lets readers keep reading while one request writes. The mode is stored
    in the file, so it stays on. A failure is not remembered, so the next request tries again.
    """
    with setup_lock:
        if path in ready_files:
            return
        path.parent.mkdir(parents=True, exist_ok=True)
        with closing(open_connection(path)) as connection:
            connection.execute("PRAGMA journal_mode = WAL")
            with connection:
                for statement in CREATE_TABLES:
                    connection.execute(statement)
                upgrade_saved_songs(connection)
        ready_files.add(path)


def upgrade_saved_songs(connection: sqlite3.Connection) -> None:
    """Moves a file from before accounts to the new tables, once.

    Every old song goes to the cache; the saved ones become library rows with no owner, which
    the first account created claims.
    """
    if not has_saved_songs(connection):
        return
    # Takes the write lock, then looks again: another request may have just upgraded the file.
    connection.execute("BEGIN IMMEDIATE")
    present = {row[1] for row in connection.execute("PRAGMA table_info(saved_songs)")}
    if not present:
        return
    for name, definition in OLD_ADDED_COLUMNS.items():
        if name not in present:
            # Only names and definitions from OLD_ADDED_COLUMNS above are formatted in.
            connection.execute(f"ALTER TABLE saved_songs ADD COLUMN {name} {definition}")
    connection.execute(
        "INSERT OR IGNORE INTO songs (id, track, artist, album, duration_seconds, lines_json,"
        " cached_at, last_opened_at) SELECT id, track, artist, album, duration_seconds,"
        " lines_json, saved_at, last_opened_at FROM saved_songs"
    )
    connection.execute(
        "INSERT INTO library_entries (user_id, song_id, video_id, offset_ms, saved_at,"
        " last_opened_at) SELECT NULL, id, video_id, offset_ms, saved_at, last_opened_at"
        " FROM saved_songs WHERE saved = 1"
    )
    connection.execute("DROP TABLE saved_songs")


def has_saved_songs(connection: sqlite3.Connection) -> bool:
    row = connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'saved_songs'"
    ).fetchone()
    return row is not None
