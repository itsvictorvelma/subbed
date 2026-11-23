// The Subbed app: the header, then home at `/`, your songs at `/library`, a song at `/song/{id}`,
// or signing in at `/account`. State lives in two hooks: `useSongOpener` and `useLibrary`.
import { useCallback, useEffect, useState } from "react";
import { AccountPage } from "./account/AccountPage";
import { AccountContext } from "./account/account";
import { useAccountState } from "./account/useAccountState";
import { Header } from "./header/Header";
import { HomePage } from "./home/HomePage";
import { LibraryPage } from "./library/LibraryPage";
import { RemovedMessage } from "./library/RemovedMessage";
import { useLibrary } from "./library/useLibrary";
import { HOME_PATH, navigate, pageTitle, songPath, useRoute } from "./routing";
import type { Route } from "./routing";
import { SearchProgress } from "./search/SearchProgress";
import { SiteShortcuts } from "./shortcuts/SiteShortcuts";
import { SongPage } from "./song/SongPage";
import { timingText, useSongOpener } from "./song/useSongOpener";
import type { SavedSong } from "./types";

function openSongPage(song: { id: number }) {
  navigate(songPath(song.id));
}

export function App() {
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState(false);
  const library = useLibrary(setError);
  const { refreshSavedSongs, refreshRecentSongs } = library;
  const loadSavedSongs = useCallback(() => void refreshSavedSongs(), [refreshSavedSongs]);
  const [account, setUsername] = useAccountState(library.setSignedIn, loadSavedSongs);
  const opener = useSongOpener({
    onError: setError,
    onOpened: loadSavedSongs,
  });
  const { leaveSong, openIfNew, markSaved } = opener;
  const busy = opener.status !== "idle";

  // Every move clears the error and Focus mode. Home and the library refresh their songs.
  const handleRouteChange = useCallback(
    (next: Route) => {
      setError(null);
      setFocus(false);
      if (next.page !== "song") {
        leaveSong();
        void refreshSavedSongs();
      }
      if (next.page === "home") {
        void refreshRecentSongs();
      }
    },
    [leaveSong, refreshSavedSongs, refreshRecentSongs],
  );
  const route = useRoute(handleRouteChange);

  useEffect(() => {
    void refreshRecentSongs();
  }, [refreshRecentSongs]);

  useEffect(() => {
    if (route.page === "song") {
      openIfNew(route.id);
    }
  }, [route, openIfNew]);

  const shown = route.page === "song" && opener.shown?.song.id === route.id ? opener.shown : null;

  useEffect(() => {
    document.title = pageTitle(route, shown?.song ?? null, account.username !== null);
  }, [route, shown, account]);

  // Back to the song that sent the guest to sign in, replacing /account so Back skips it.
  function handleSignedIn(username: string, returnTo: string | null) {
    setUsername(username);
    navigate(returnTo ?? HOME_PATH, { replace: true });
  }

  function handleSignedOut() {
    setUsername(null);
    opener.clearResults();
    navigate(HOME_PATH);
  }

  // Remove (with its Undo message) or Undo, keeping the search results' "saved" marks in step.
  async function changeSaved(song: SavedSong, saved: boolean) {
    const done = await (saved ? library.undoRemove(song) : library.removeSong(song));
    if (done) {
      markSaved(song.id, saved);
    }
  }

  function search(query: string) {
    void opener.find(query);
  }

  function renderPage() {
    if (opener.status !== "idle") {
      return <SearchProgress stage={opener.status} />;
    }
    switch (route.page) {
      case "home":
        return (
          <HomePage
            savedSongs={library.savedSongs}
            recentSongs={library.recentSongs}
            onSearch={search}
            onOpenSong={(id) => {
              openSongPage({ id });
            }}
          />
        );
      case "account":
        return (
          <AccountPage
            onSignedIn={(username) => {
              handleSignedIn(username, route.returnTo);
            }}
            onSignedOut={handleSignedOut}
          />
        );
      case "library":
        return (
          <LibraryPage
            songs={library.savedSongs}
            onOpen={openSongPage}
            onRemove={(song) => void changeSaved(song, false)}
          />
        );
      case "song":
        return (
          shown !== null && (
            <SongPage
              key={shown.openedAt}
              song={shown.song}
              lines={shown.lines}
              playback={shown.playback}
              saved={shown.saved}
              timing={timingText(shown)}
              otherMatches={opener.results.filter((result) => result.id !== shown.song.id)}
              focus={focus}
              onPickMatch={openSongPage}
              onFocusChange={setFocus}
              onSavedChange={(saved) => {
                markSaved(shown.song.id, saved);
              }}
            />
          )
        );
    }
  }

  return (
    <AccountContext.Provider value={account}>
      <div className={shown !== null && !busy ? "app is-song" : "app"}>
        {!focus && (
          <Header
            busy={busy}
            showSearch={route.page !== "home"}
            currentPage={route.page}
            onSearch={search}
          />
        )}
        {route.page !== "song" && <SiteShortcuts />}
        <main className="app-main">
          {error !== null && (
            <p role="alert" className="error page-error">
              <strong>Error:</strong> {error}
            </p>
          )}
          {renderPage()}
        </main>
        <RemovedMessage
          song={library.removed}
          onUndo={(song) => void changeSaved(song, true)}
          onDone={library.clearRemoved}
        />
      </div>
    </AccountContext.Provider>
  );
}
