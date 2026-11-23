// The player bar at the bottom of a song: audio controls, sync, the video window, and choosing audio.
// On a phone it is a slim bar that opens into a sheet with the rest of the controls.
import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { isGuest, useAccount } from "../account/account";
import { matchesMedia } from "../browser";
import { AudioFilePlayer } from "./AudioFilePlayer";
import { savePlayback } from "../api";
import {
  formatClock,
  nextSpeed,
  nudgeOffset,
  parseVideoId,
  storedVolume,
  storeVolume,
  toggledVolume,
  youTubeSearchUrl,
} from "./playback";
import type { AudioClock } from "./playback";
import { PlayerControls } from "./PlayerControls";
import type { Playback, Progress } from "../types";
import { YouTubePlayer } from "./YouTubePlayer";
import { ChevronUpIcon, CloseIcon, KeyboardIcon, LinkIcon, MusicIcon, VideoIcon } from "../icons";

export const BAD_LINK_MESSAGE = "That doesn't look like a YouTube link.";
const PLAYER_FAILED_MESSAGE = "Couldn't load the YouTube player. Try again.";
const SAVE_FAILED_MESSAGE = "Couldn't save the video and sync for this song.";
export const PLAY_ALONG_TITLE = "Play along with the song";
export const OPEN_SHEET_LABEL = "Open player controls";
export const CLOSE_SHEET_LABEL = "Close player controls";

// The width below which styles.css uses the phone layout.
const PHONE_QUERY = "(max-width: 719px)";

// The video window starts open, except on a phone, where it would leave little room for lyrics.
function startsWithVideoShown(): boolean {
  return !matchesMedia(PHONE_QUERY);
}

type Source = { kind: "youtube"; videoId: string } | { kind: "file"; file: File } | null;

// Whether an element is drawn; true where the browser can't tell (jsdom in tests has no checkVisibility).
function isShown(element: HTMLElement): boolean {
  return "checkVisibility" in element ? element.checkVisibility() : true;
}

interface PlayerBarProps {
  songId: number;
  track: string;
  artist: string;
  savedVideoId: string | null;
  offsetMs: number;
  hasTimings: boolean;
  progress: Progress;
  // The original text of the sung line, shown in the phone's slim bar.
  currentLineText: string | null;
  onOffsetChange: (offsetMs: number) => void;
  onVideoChange: (videoId: string) => void;
  onClock: (clock: AudioClock | null) => void;
  onTogglePlay: () => void;
  onSeek: (milliseconds: number) => void;
  onPreviousLine: () => void;
  onNextLine: () => void;
  looping: boolean;
  canLoop: boolean;
  onToggleLoop: () => void;
  shortcutListOpen: boolean;
  onToggleShortcutList: () => void;
}

export function PlayerBar(props: PlayerBarProps) {
  const { songId, savedVideoId, offsetMs, onOffsetChange } = props;
  const [link, setLink] = useState(savedVideoId === null ? "" : `https://youtu.be/${savedVideoId}`);
  const guest = isGuest(useAccount());
  const [videoId, setVideoId] = useState(savedVideoId);
  const [source, setSource] = useState<Source>(
    savedVideoId === null ? null : { kind: "youtube", videoId: savedVideoId },
  );
  const [choosing, setChoosing] = useState(false);
  const [videoShown, setVideoShown] = useState(startsWithVideoShown);
  const [error, setError] = useState<string | null>(null);
  const showPlayerFailed = useCallback(() => {
    setError(PLAYER_FAILED_MESSAGE);
  }, []);
  const [volume, setVolume] = useState(storedVolume);
  const volumeRef = useRef(volume);
  const beforeMute = useRef(volume);
  const clockRef = useRef<AudioClock | null>(null);
  const [speed, setSpeed] = useState(1);
  const speedRef = useRef(speed);
  // Phone only: the sheet with every control is open over the lyrics.
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetRef = useRef<HTMLElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const handleRef = useRef<HTMLButtonElement>(null);
  const sheetWasOpen = useRef(false);

  // Focus moves into the sheet when it opens and back to the button that opened it when it closes.
  useEffect(() => {
    if (sheetOpen) {
      handleRef.current?.focus();
    } else if (sheetWasOpen.current) {
      openButtonRef.current?.focus();
    }
    sheetWasOpen.current = sheetOpen;
  }, [sheetOpen]);

  // Turning a phone or widening the window past the phone layout closes the sheet.
  useEffect(() => {
    if (!sheetOpen || typeof window.matchMedia !== "function") {
      return;
    }
    const phone = window.matchMedia(PHONE_QUERY);
    function closeWhenWide() {
      if (!phone.matches) {
        setSheetOpen(false);
        setChoosing(false);
      }
    }
    phone.addEventListener("change", closeWhenWide);
    return () => {
      phone.removeEventListener("change", closeWhenWide);
    };
  }, [sheetOpen]);

  // Every new player starts at the current volume and speed.
  const { onClock } = props;
  const handleClock = useCallback(
    (clock: AudioClock | null) => {
      clockRef.current = clock;
      clock?.setVolume(volumeRef.current);
      clock?.setPlaybackRate(speedRef.current);
      onClock(clock);
    },
    [onClock],
  );

  function changeSpeed() {
    const next = nextSpeed(speed);
    speedRef.current = next;
    setSpeed(next);
    clockRef.current?.setPlaybackRate(next);
  }

  function changeVolume(next: number) {
    volumeRef.current = next;
    setVolume(next);
    storeVolume(next);
    clockRef.current?.setVolume(next);
  }

  // A guest's video and sync are not kept, so nothing is sent. A 404 means the song is not in the
  // library, so nothing is kept; any other failure is said.
  async function save(playback: Playback) {
    if (guest) {
      return;
    }
    const result = await savePlayback(songId, playback);
    const notSaved =
      result.kind === "error" &&
      (result.code === "song_not_found" || result.code === "sign_in_required");
    if (result.kind !== "ok" && !notSaved) {
      setError(SAVE_FAILED_MESSAGE);
    }
  }

  function playVideo() {
    const id = parseVideoId(link);
    if (id === null) {
      setError(BAD_LINK_MESSAGE);
      return;
    }
    setError(null);
    setVideoId(id);
    props.onVideoChange(id);
    setSource({ kind: "youtube", videoId: id });
    setVideoShown(startsWithVideoShown());
    setChoosing(false);
    void save({ videoId: id, offsetMs });
  }

  function playFile(file: File | undefined) {
    if (file !== undefined) {
      setError(null);
      setSource({ kind: "file", file });
      setChoosing(false);
    }
  }

  function nudge(direction: 1 | -1) {
    const next = nudgeOffset(offsetMs, direction);
    onOffsetChange(next);
    void save({ videoId, offsetMs: next });
  }

  const showChooser = source === null || choosing;
  const timeMs = props.progress.timeMs ?? 0;
  const durationMs = props.progress.durationMs ?? 0;

  function openSheet() {
    setSheetOpen(true);
  }

  // Closing mid-choice goes back to the player, since the chooser lives in the sheet.
  function closeSheet() {
    setSheetOpen(false);
    setChoosing(false);
  }

  // While the sheet is open, Esc closes it before the page's shortcuts see it, and Tab stays inside.
  function handleSheetKey(event: KeyboardEvent<HTMLElement>) {
    if (!sheetOpen) {
      return;
    }
    if (event.key === "Escape") {
      event.nativeEvent.stopPropagation();
      closeSheet();
    } else if (event.key === "Tab") {
      keepFocusInside(event);
    }
  }

  function keepFocusInside(event: KeyboardEvent<HTMLElement>) {
    const focusable = [
      ...(sheetRef.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled]), a[href], input:not([disabled])",
      ) ?? []),
    ].filter(isShown);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  return (
    <>
      {sheetOpen && (
        <button
          type="button"
          className="phone-only sheet-backdrop"
          aria-label={CLOSE_SHEET_LABEL}
          tabIndex={-1}
          onClick={closeSheet}
        />
      )}
      <footer
        ref={sheetRef}
        className={sheetOpen ? "player-bar is-open" : "player-bar"}
        role={sheetOpen ? "dialog" : undefined}
        aria-modal={sheetOpen ? true : undefined}
        aria-label={sheetOpen ? PLAY_ALONG_TITLE : undefined}
        onKeyDown={handleSheetKey}
      >
        {sheetOpen && (
          <button
            ref={handleRef}
            type="button"
            className="phone-only sheet-handle"
            aria-label={CLOSE_SHEET_LABEL}
            onClick={closeSheet}
          >
            <span aria-hidden="true" />
          </button>
        )}
        {source?.kind === "youtube" && (
          <div className={videoShown ? "video-window" : "video-window is-hidden"}>
            <YouTubePlayer
              videoId={source.videoId}
              onClock={handleClock}
              onLoadError={showPlayerFailed}
            />
            <button
              type="button"
              className="icon-button video-close"
              aria-label="Hide video"
              onClick={() => {
                setVideoShown(false);
              }}
            >
              <CloseIcon />
            </button>
          </div>
        )}
        {source?.kind === "file" && <AudioFilePlayer file={source.file} onClock={handleClock} />}
        {error !== null && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="player-row">
          {source === null && (
            <button
              ref={openButtonRef}
              type="button"
              className="pill-button phone-only play-along-button"
              aria-expanded={sheetOpen}
              onClick={openSheet}
            >
              <MusicIcon /> Play along
            </button>
          )}
          {showChooser ? (
            <AudioChooser
              searchUrl={youTubeSearchUrl(props.track, props.artist)}
              link={link}
              onLinkChange={setLink}
              onPlayLink={playVideo}
              onFile={playFile}
            />
          ) : (
            <PlayerControls
              progress={props.progress}
              offsetMs={offsetMs}
              hasTimings={props.hasTimings}
              onTogglePlay={props.onTogglePlay}
              onSeek={props.onSeek}
              onPreviousLine={props.onPreviousLine}
              onNextLine={props.onNextLine}
              looping={props.looping}
              canLoop={props.canLoop}
              onToggleLoop={props.onToggleLoop}
              hasVideo={source.kind === "youtube"}
              videoShown={videoShown}
              onNudge={nudge}
              speed={speed}
              onChangeSpeed={changeSpeed}
              volume={volume}
              onVolumeChange={changeVolume}
              onToggleMute={() => {
                // Unmute returns to the level Mute was pressed at, not a slider step on the way down.
                if (volume > 0) {
                  beforeMute.current = volume;
                }
                changeVolume(toggledVolume(volume, beforeMute.current));
              }}
              onToggleVideo={() => {
                setVideoShown((shown) => !shown);
              }}
            />
          )}
          {source !== null && !choosing && (
            <>
              <button
                type="button"
                className="phone-only mini-line"
                aria-haspopup="dialog"
                onClick={openSheet}
              >
                {props.currentLineText === null ? (
                  <span className="mini-line-text">{props.track}</span>
                ) : (
                  <span lang="ja" className="mini-line-text">
                    {props.currentLineText}
                  </span>
                )}
                <span className="mini-line-time">
                  {formatClock(timeMs)} / {formatClock(durationMs)}
                </span>
              </button>
              <button
                ref={openButtonRef}
                type="button"
                className="icon-button phone-only sheet-open-button"
                aria-label={OPEN_SHEET_LABEL}
                aria-expanded={sheetOpen}
                onClick={openSheet}
              >
                <ChevronUpIcon />
              </button>
            </>
          )}
          {source !== null && (
            <button
              type="button"
              className="pill-button change-audio"
              aria-expanded={choosing}
              onClick={() => {
                setChoosing((open) => !open);
              }}
            >
              {choosing ? "Back to player" : "Change audio"}
            </button>
          )}
          <button
            type="button"
            className="icon-button shortcuts-button"
            aria-label="Keyboard shortcuts"
            aria-haspopup="dialog"
            aria-expanded={props.shortcutListOpen}
            onClick={props.onToggleShortcutList}
          >
            <KeyboardIcon />
          </button>
        </div>
      </footer>
    </>
  );
}

interface AudioChooserProps {
  // A YouTube search for this song, opened in a new tab.
  searchUrl: string;
  link: string;
  onLinkChange: (link: string) => void;
  onPlayLink: () => void;
  onFile: (file: File | undefined) => void;
}

// With no audio yet, or when changing it, one row: find the song on YouTube, paste its link into
// the always-open box (same pill as the header search), or play a file from this computer.
function AudioChooser(props: AudioChooserProps) {
  return (
    <div className="audio-chooser" role="group" aria-label={PLAY_ALONG_TITLE}>
      <a className="pill-button" href={props.searchUrl} target="_blank" rel="noopener noreferrer">
        <VideoIcon /> Find on YouTube
      </a>
      <form
        className="search-box link-form"
        onSubmit={(event) => {
          event.preventDefault();
          props.onPlayLink();
        }}
      >
        <LinkIcon />
        <label htmlFor="youtube-link" className="visually-hidden">
          YouTube link
        </label>
        <input
          id="youtube-link"
          type="url"
          placeholder="Paste the YouTube link here"
          value={props.link}
          onChange={(event) => {
            props.onLinkChange(event.target.value);
          }}
        />
        <button type="submit" className="find-button" disabled={props.link.trim() === ""}>
          Play video
        </button>
      </form>
      <label className="pill-button file-button">
        <MusicIcon /> Play a file
        <input
          type="file"
          accept="audio/*"
          className="visually-hidden"
          onChange={(event) => {
            props.onFile(event.target.files?.[0]);
          }}
        />
      </label>
    </div>
  );
}
