// Calls the Subbed server, checks every reply's shape before the page uses it, and words a failure.
import type {
  ApiResult,
  Line,
  Playback,
  RecentSong,
  SavedSong,
  SearchResult,
  Song,
  SongVersions,
} from "./types";

// The server's limits on a song's video id and sync nudge; replies outside them are not trusted.
export const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
export const MAX_OFFSET_MS = 30_000;

export const FALLBACK_MESSAGE = "Something went wrong. Try again.";
const SERVER_UNREACHABLE_MESSAGE = "Could not reach the Subbed server. Is it running?";

// ---- Reply checks: tiny type guards that compose, so each reply shape is declared once. ----

type Check<T> = (value: unknown) => value is T;

const isString: Check<string> = (value) => typeof value === "string";
const isBoolean: Check<boolean> = (value) => typeof value === "boolean";
const isInteger = (value: unknown): value is number => Number.isInteger(value);
const isNull: Check<null> = (value) => value === null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function orNull<T>(check: Check<T>): Check<T | null> {
  return (value): value is T | null => value === null || check(value);
}

function arrayOf<T>(check: Check<T>): Check<T[]> {
  return (value): value is T[] => Array.isArray(value) && value.every(check);
}

// An object whose listed fields pass their checks; other fields are ignored.
function object<T>(fields: { [K in keyof T]: Check<T[K]> }): Check<T> {
  return (value): value is T =>
    isRecord(value) &&
    Object.entries<Check<unknown>>(fields).every(([name, check]) => check(value[name]));
}

function both<A, B>(first: Check<A>, second: Check<B>): Check<A & B> {
  return (value): value is A & B => first(value) && second(value);
}

const isVideoId = (value: unknown): value is string => isString(value) && VIDEO_ID.test(value);
const isOffset = (value: unknown): value is number =>
  isInteger(value) && Math.abs(value) <= MAX_OFFSET_MS;
const isStartMs = orNull((value): value is number => isInteger(value) && value >= 0);

const isSong = object<Song>({
  id: isInteger,
  track: isString,
  artist: isString,
  album: isString,
  durationSeconds: isInteger,
});
const isPlayback = object<Playback>({ videoId: orNull(isVideoId), offsetMs: isOffset });
const isLine = object<Line>({
  index: isInteger,
  original: isString,
  hiragana: isString,
  romaji: isString,
  english: isString,
  startMs: isStartMs,
});
// Indexes must run 0, 1, 2… with no gaps, as the server promises.
const isLineList = (value: unknown): value is Line[] =>
  arrayOf(isLine)(value) && value.every((line, position) => line.index === position);

const isSearchResult: Check<SearchResult> = both(
  isSong,
  object({ looksJapanese: isBoolean, saved: isBoolean }),
);
const isSavedSong: Check<SavedSong> = both(
  both(isSong, isPlayback),
  object({ lastOpenedAt: isInteger }),
);
const isRecentSong: Check<RecentSong> = both(isSong, object({ videoId: orNull(isVideoId) }));
const isSongVersions = object<SongVersions>({
  song: isSong,
  lines: isLineList,
  fromLibrary: isBoolean,
  saved: isBoolean,
  playback: isPlayback,
});
const isAccountReply = object({ username: orNull(isString) });
const isErrorReply = object({ code: isString, message: isString });

// ---- Requests ----

type Method = "GET" | "POST" | "PUT" | "DELETE";

// One request. A reply with `okStatus` must pass `check`; any other must be the error shape.
async function request<Reply>(
  method: Method,
  url: string,
  body: unknown,
  check: Check<Reply>,
  okStatus = 200,
): Promise<ApiResult<Reply>> {
  let response: Response;
  let text: string;
  try {
    response = await fetch(url, {
      method,
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return { kind: "unreachable" };
  }
  try {
    text = await response.text();
  } catch {
    return { kind: "unreadable" };
  }
  // Only a 204 has no body; an error reply always carries its code and message.
  const reply = response.status === 204 ? null : parseJson(text);
  if (response.status === okStatus) {
    return check(reply) ? { kind: "ok", value: reply } : { kind: "unreadable" };
  }
  return isErrorReply(reply)
    ? { kind: "error", code: reply.code, message: reply.message }
    : { kind: "unreadable" };
}

// A request whose reply has no body (204 No Content).
function send(method: Method, url: string, body?: unknown): Promise<ApiResult<null>> {
  return request(method, url, body, isNull, 204);
}

// A GET or POST whose reply wraps the value in one field, such as `{ "songs": [...] }`.
async function requestField<Value>(
  method: Method,
  url: string,
  body: unknown,
  key: string,
  check: Check<Value>,
): Promise<ApiResult<Value>> {
  const isReply = (value: unknown): value is Record<string, Value> =>
    isRecord(value) && check(value[key]);
  const result = await request(method, url, body, isReply);
  return result.kind === "ok" ? { kind: "ok", value: result.value[key] as Value } : result;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

// ---- Endpoints ----

export function searchSongs(query: string): Promise<ApiResult<SearchResult[]>> {
  return requestField("POST", "/api/song-search", { query }, "results", arrayOf(isSearchResult));
}

export function getSongVersions(id: number): Promise<ApiResult<SongVersions>> {
  return request("POST", "/api/song-versions", { id }, isSongVersions);
}

export function listSavedSongs(): Promise<ApiResult<SavedSong[]>> {
  return requestField("GET", "/api/songs", undefined, "songs", arrayOf(isSavedSong));
}

// Songs anyone opened lately, newest first, for the home page row.
export function listRecentSongs(): Promise<ApiResult<RecentSong[]>> {
  return requestField("GET", "/api/recent-songs", undefined, "songs", arrayOf(isRecentSong));
}

export function saveSong(id: number, playback: Playback): Promise<ApiResult<null>> {
  return send("PUT", `/api/songs/${String(id)}/saved`, playback);
}

// The server keeps the song's translation; only the library entry goes.
export function unsaveSong(id: number): Promise<ApiResult<null>> {
  return send("DELETE", `/api/songs/${String(id)}/saved`);
}

// A 404 means the song is not saved, so nothing is kept.
export function savePlayback(id: number, playback: Playback): Promise<ApiResult<null>> {
  return send("PUT", `/api/songs/${String(id)}/playback`, playback);
}

// The signed-in username, or null for a guest.
export function getAccount(): Promise<ApiResult<string | null>> {
  return requestField("GET", "/api/account", undefined, "username", orNull(isString));
}

export type AccountMode = "sign-in" | "sign-up";

// Signs in, or creates the account and signs it in; the reply is the stored username.
export async function enterAccount(
  mode: AccountMode,
  username: string,
  password: string,
): Promise<ApiResult<string>> {
  const body = { username, password };
  const result = await request("POST", `/api/account/${mode}`, body, isAccountReply);
  if (result.kind !== "ok") {
    return result;
  }
  const stored = result.value.username;
  return stored === null ? { kind: "unreadable" } : { kind: "ok", value: stored };
}

export function signOut(): Promise<ApiResult<null>> {
  return send("POST", "/api/account/sign-out");
}

// The password is asked again before the account and its saved songs are deleted.
export function deleteAccount(password: string): Promise<ApiResult<null>> {
  return send("DELETE", "/api/account", { password });
}

// What the page says about a failed request: the server's own message when it sent one.
export function errorMessage(result: Exclude<ApiResult<unknown>, { kind: "ok" }>): string {
  switch (result.kind) {
    case "error":
      return result.message;
    case "unreadable":
      return FALLBACK_MESSAGE;
    case "unreachable":
      return SERVER_UNREACHABLE_MESSAGE;
  }
}
