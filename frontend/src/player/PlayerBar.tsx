// The player bar at the bottom of a song: audio controls, sync, the video window, and choosing audio.
// On a phone it is a slim bar that opens into a sheet with the rest of the controls.
import { useCallback, useState } from "react";
import { isGuest, useAccount } from "../account/account";
import { savePlayback } from "../api";
import { ChevronUpIcon, CloseIcon, KeyboardIcon, MusicIcon } from "../icons";
import type { Playback, Progress } from "../types";
import { AudioChooser, PLAY_ALONG_TITLE } from "./AudioChooser";
import { AudioFilePlayer } from "./AudioFilePlayer";
import { formatClock, nudgeOffset, parseVideoId, youTubeSearchUrl } from "./playback";
import type { AudioClock } from "./playback";
import { PlayerControls } from "./PlayerControls";
import { isPhone, usePhoneSheet } from "./usePhoneSheet";
import { usePlayerSettings } from "./usePlayerSettings";
import { YouTubePlayer } from "./YouTubePlayer";

export { PLAY_ALONG_TITLE };
export const BAD_LINK_MESSAGE = "That doesn't look like a YouTube link.";
const PLAYER_FAILED_MESSAGE = "Couldn't load the YouTube player. Try again.";
const SAVE_FAILED_MESSAGE = "Couldn't save the video and sync for this song.";
export const OPEN_SHEET_LABEL = "Open player controls";
export const CLOSE_SHEET_LABEL = "Close player controls";

// The video window starts open, except on a phone, where it would leave little room for lyrics.
function startsWithVideoShown(): boolean {
  return !isPhone();
}

type Source = { kind: "youtube"; videoId: string } | { kind: "file"; file: File } | null;

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
  const settings = usePlayerSettings(props.onClock);
  // Closing the sheet mid-choice goes back to the player, since the chooser lives in the sheet.
  const {
    open: sheetOpen,
    openSheet,
    closeSheet,
    handleKeyDown,
    sheetRef,
    openButtonRef,
    handleRef,
  } = usePhoneSheet(
    useCallback(() => {
      setChoosing(false);
    }, []),
  );

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
        onKeyDown={handleKeyDown}
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
              onClock={settings.handleClock}
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
        {source?.kind === "file" && (
          <AudioFilePlayer file={source.file} onClock={settings.handleClock} />
        )}
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
              speed={settings.speed}
              onChangeSpeed={settings.changeSpeed}
              volume={settings.volume}
              onVolumeChange={settings.changeVolume}
              onToggleMute={settings.toggleMute}
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
