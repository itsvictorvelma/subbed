// The audio chooser: find the song on YouTube, paste a link, or play a file from this computer.
import { LinkIcon, MusicIcon, VideoIcon } from "../icons";

export const PLAY_ALONG_TITLE = "Play along with the song";

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
export function AudioChooser(props: AudioChooserProps) {
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
