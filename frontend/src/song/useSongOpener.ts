// Searching and opening songs: the loading stage, the search results, and the song shown.
import { useCallback, useRef, useState } from "react";
import { errorMessage, getSongVersions, searchSongs } from "../api";
import { HOME_PATH, navigate, songPath } from "../routing";
import type { Stage } from "../search/SearchProgress";
import type { Line, Playback, SearchResult, Song } from "../types";

export type Status = "idle" | Stage;

export interface Shown {
  song: Song;
  lines: Line[];
  fromLibrary: boolean;
  playback: Playback;
  saved: boolean;
  // When this open happened; it keys the song page, so every open starts it fresh.
  openedAt: number;
  // How long the search and the open took, in milliseconds.
  findMs?: number;
  versionsMs: number;
}

// "Found in 0.4 s · versions in 12.3 s", or the already-translated or versions part alone.
export function timingText(shown: Pick<Shown, "fromLibrary" | "findMs" | "versionsMs">): string {
  const versions = formatSeconds(shown.versionsMs);
  if (shown.fromLibrary) {
    return `Already translated · opened in ${versions}`;
  }
  return shown.findMs === undefined
    ? `Versions in ${versions}`
    : `Found in ${formatSeconds(shown.findMs)} · versions in ${versions}`;
}

function formatSeconds(milliseconds: number): string {
  return `${(milliseconds / 1000).toFixed(1)} s`;
}

interface Options {
  onError: (message: string | null) => void;
  // Called after a song opens, since opening it updates its "last opened" in the library.
  onOpened: () => void;
}

export function useSongOpener({ onError, onOpened }: Options) {
  const [status, setStatus] = useState<Status>("idle");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [shown, setShown] = useState<Shown | null>(null);
  // The song shown or being opened. A reply for any other song arrived too late and is dropped.
  const openedId = useRef<number | null>(null);
  // How long the search took, handed to the open that follows it.
  const pendingFindMs = useRef<number | undefined>(undefined);

  const openSong = useCallback(
    async (id: number) => {
      openedId.current = id;
      const findMs = pendingFindMs.current;
      pendingFindMs.current = undefined;
      setStatus(findMs === undefined ? "opening" : "opening-found");
      setShown(null);
      onError(null);
      const started = performance.now();
      const result = await getSongVersions(id);
      if (openedId.current !== id) {
        return;
      }
      setStatus("idle");
      if (result.kind === "ok") {
        const versionsMs = performance.now() - started;
        setShown({ ...result.value, findMs, openedAt: started, versionsMs });
        onOpened();
        return;
      }
      openedId.current = null;
      // A song the server does not have is an unknown address: show home instead.
      if (result.kind === "error" && result.code === "song_not_found") {
        navigate(HOME_PATH, { replace: true });
      }
      onError(errorMessage(result));
    },
    [onError, onOpened],
  );

  // Opens the song a route names, unless it is already shown or opening.
  const openIfNew = useCallback(
    (id: number) => {
      if (openedId.current !== id) {
        void openSong(id);
      }
    },
    [openSong],
  );

  // Leaving the song page: a song still opening is dropped, and opening it again fetches it fresh.
  // A search in progress keeps going.
  const leaveSong = useCallback(() => {
    openedId.current = null;
    setStatus((current) => (current === "finding" ? current : "idle"));
  }, []);

  // The best match opens at once; the rest stay as "Not this one?" choices.
  async function find(query: string) {
    // A song still opening must not end this search when its reply arrives.
    openedId.current = null;
    setStatus("finding");
    setResults([]);
    onError(null);
    const started = performance.now();
    const result = await searchSongs(query);
    const findMs = performance.now() - started;
    if (result.kind !== "ok") {
      setStatus("idle");
      onError(errorMessage(result));
      return;
    }
    setResults(result.value);
    const best = result.value[0];
    if (best === undefined) {
      setStatus("idle");
      return;
    }
    pendingFindMs.current = findMs;
    navigate(songPath(best.id));
  }

  // Keeps the search results' "saved" marks in step with the library.
  const markSaved = useCallback((id: number, saved: boolean) => {
    setResults((found) => found.map((match) => (match.id === id ? { ...match, saved } : match)));
  }, []);

  const clearResults = useCallback(() => {
    setResults([]);
  }, []);

  return { status, results, shown, find, openIfNew, leaveSong, markSaved, clearResults };
}
