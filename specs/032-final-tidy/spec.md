# 032 — Final tidy: database connections and a smaller frontend

Status: approved

## Goal

Development of this repo stops after this spec. Before it does, the database is set up once at
start and opened safely by many requests at once, and the frontend is smaller and easier to read.
The learner sees no change.

## In scope

### A. Database connections (`backend/src/subbed/database.py`)

- **Set up once.** The `CREATE TABLE` statements and the old-file upgrade run once when the app
  starts (in the lifespan of `create_app`), not on every connection as they do today.
- **WAL mode.** Set `journal_mode=WAL` at start. It is stored in the file, so it stays on. Readers
  no longer wait for a writer, and a writer no longer waits for readers.
- **Every connection** sets `busy_timeout = 5000` so a request that meets a lock waits instead of
  failing at once, and `synchronous = NORMAL` (safe with WAL, fewer disk syncs).
- `connect()` stays a context manager: one `with` block is one transaction, the same as today.
- The backup script already uses SQLite's backup API, which is correct with WAL. It is checked,
  not changed.

### B. Frontend: same page, less code

1. **`App.tsx` becomes layout and routing only.** Opening a song and searching move to a
   `useSongOpener` hook. Saved songs, recent songs, and remove with Undo move to a `useLibrary`
   hook. Target: `App.tsx` under 180 lines.
2. **`PlayerBar.tsx` is split up.** Volume and speed move to a `usePlayerSettings` hook. The
   phone sheet (open, close, focus return, close when the window widens) moves to its own hook or
   component. Target: `PlayerBar.tsx` under 300 lines.
3. **`api.ts` uses one request helper.** Small shared reply checks (`isRecord`, `field`,
   `arrayOf`) replace the hand-written guards that repeat for every reply, and the unwrap
   boilerplate repeated in each call goes. Every reply is still checked before use.
4. **The stylesheet is split by feature.** `styles.css` keeps only the design tokens, the reset,
   and shared patterns. Each feature folder gets its own CSS file, imported by its component.
   The rules do not change, only where they live. `styles.test.ts` reads the new files.
5. **Prettier `printWidth: 100`**, the same as the backend's ruff line length.
6. **Comments explain why, not what.** Comments that only repeat the code are removed. Comments
   that say why (a browser quirk, a race, a security reason) stay.

## Out of scope

- CI (the repo is frozen and v2 is a new repo).
- A numbered migrations system (no more schema changes are planned here).
- New features or visual changes of any kind.
- Backend changes beyond `database.py` and the lifespan hook that calls it.

## Rules

- **No change for the learner.** The same pages, text, layout, keyboard shortcuts, and replies.
- Every existing test still passes. Tests may move or follow renamed modules, but no assertion
  about behaviour is weakened or deleted.
- No new dependencies.
- Measured result: non-test frontend TypeScript (`src/**/*.ts(x)`, excluding tests and
  `fakeSongPage.tsx`) goes from **4,925 lines to under 4,200** (about −15%), counted after
  Prettier at the new width.

## Security

- No new input, outside call, or stored data.
- SQL stays parameterised. The only formatted SQL is still the fixed column list in the
  old-file upgrade.
- The reply checks in `api.ts` stay at least as strict: a reply in the wrong shape is still
  refused.

## Acceptance checks

- AC-1: Opening many connections runs `CREATE TABLE` and the upgrade check zero times; starting
  the app runs them once (test counts the statements with a trace callback).
- AC-2: After start, `PRAGMA journal_mode` reads `wal` on the database file.
- AC-3: Every connection from `connect()` has `busy_timeout` 5000 and `synchronous` NORMAL.
- AC-4: A write in progress on one connection does not block a read on another (WAL test).
- AC-5: A file from before accounts (with `saved_songs`) is still upgraded once at start (the
  existing upgrade tests pass against the start-up path).
- AC-6: `App.tsx` < 180 lines, `PlayerBar.tsx` < 300 lines, and non-test frontend TS < 4,200
  lines.
- AC-7: `styles.css` holds only tokens, reset, and shared patterns; each feature's rules are in
  its folder; `npm run build` emits the same set of CSS rules (compared before and after, order
  aside).
- AC-8: `scripts/check.sh` passes: ruff, mypy strict, pytest, Prettier, ESLint, tsc, Vitest,
  build.
- AC-9: Clicking through home, search, a song with a video, the library, remove and Undo, sign
  in and sign out, and the phone sheet looks and behaves as before.

## Plan

Added after approval.
