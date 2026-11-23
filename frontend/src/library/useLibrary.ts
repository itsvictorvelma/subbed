// The person's saved songs, the home page's recent songs, and removing a song with Undo.
import { useCallback, useRef, useState } from "react";
import { errorMessage, listRecentSongs, listSavedSongs, saveSong, unsaveSong } from "../api";
import type { RecentSong, SavedSong } from "../types";

// `removeSong` and `undoRemove` resolve to whether they worked, so the caller can update the
// search results' "saved" marks.
export function useLibrary(onError: (message: string | null) => void) {
  const [savedSongs, setSavedSongs] = useState<SavedSong[]>([]);
  const [recentSongs, setRecentSongs] = useState<RecentSong[]>([]);
  // The song just removed, while its Undo message shows.
  const [removed, setRemoved] = useState<SavedSong | null>(null);
  // A ref, not state, so the refresh callbacks stay the same across sign-ins.
  const signedIn = useRef(false);

  // A guest has no saved songs, so the server is not asked. A failed load keeps the list as it was.
  const refreshSavedSongs = useCallback(async () => {
    if (!signedIn.current) {
      setSavedSongs([]);
      return;
    }
    const result = await listSavedSongs();
    if (result.kind === "ok") {
      setSavedSongs(result.value);
    }
  }, []);

  // A failed load keeps the row as it was; the home page hides it when empty.
  const refreshRecentSongs = useCallback(async () => {
    const result = await listRecentSongs();
    if (result.kind === "ok") {
      setRecentSongs(result.value);
    }
  }, []);

  const setSignedIn = useCallback((value: boolean) => {
    signedIn.current = value;
    if (!value) {
      setSavedSongs([]);
      setRemoved(null);
    }
  }, []);

  // No confirm box: the Undo message puts the song back, with its video and sync.
  async function removeSong(song: SavedSong): Promise<boolean> {
    onError(null);
    const result = await unsaveSong(song.id);
    if (result.kind !== "ok") {
      onError(errorMessage(result));
      return false;
    }
    setSavedSongs((songs) => songs.filter((saved) => saved.id !== song.id));
    setRemoved(song);
    return true;
  }

  async function undoRemove(song: SavedSong): Promise<boolean> {
    setRemoved(null);
    const result = await saveSong(song.id, { videoId: song.videoId, offsetMs: song.offsetMs });
    if (result.kind !== "ok") {
      onError(errorMessage(result));
      return false;
    }
    void refreshSavedSongs();
    return true;
  }

  const clearRemoved = useCallback(() => {
    setRemoved(null);
  }, []);

  return {
    savedSongs,
    recentSongs,
    removed,
    refreshSavedSongs,
    refreshRecentSongs,
    setSignedIn,
    removeSong,
    undoRemove,
    clearRemoved,
  };
}
