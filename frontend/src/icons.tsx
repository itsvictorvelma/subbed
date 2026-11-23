// Every icon on the page: line drawings on a 24×24 grid in the text colour, hidden from screen
// readers. Each is one SVG path (circles and rounded boxes written as arcs).

function Icon({ d, filled = false }: { d: string; filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={filled ? "icon icon-filled" : "icon"} aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const SEARCH = "M4 11a7 7 0 1 0 14 0a7 7 0 1 0-14 0M20 20l-3.5-3.5";
const SUN =
  "M8 12a4 4 0 1 0 8 0a4 4 0 1 0-8 0" +
  "M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4";
const MOON = "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z";
const CLOSE = "M18 6 6 18M6 6l12 12";
const BACK = "M19 12H5M12 19l-7-7 7-7";
const FOCUS_ENTER = "M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7";
const FOCUS_EXIT = "M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7";
const BOOKMARK = "M6 3h12v18l-6-4-6 4z";
const PLAY = "M8 5v14l11-7z";
const PAUSE = "M7 5h4v14H7zM13 5h4v14h-4z";
const PREVIOUS = "M19 20 9 12l10-8v16zM5 19V5";
const NEXT = "M5 4l10 8-10 8V4zM19 5v14";
const LOOP = "M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3";
const SPEAKER = "M11 5 6 9H3v6h3l5 4V5z";
const SOUND_WAVES = "M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13";
const MUTED_CROSS = "M16 9l5 6M21 9l-5 6";
const VIDEO =
  "M4 5h11a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM17 10l5-3v10l-5-3";
const LINK =
  "M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7";
const MUSIC = "M9 18V5l12-2v13M3 18a3 3 0 1 0 6 0a3 3 0 1 0-6 0M15 16a3 3 0 1 0 6 0a3 3 0 1 0-6 0";
const USER = "M8 8a4 4 0 1 0 8 0a4 4 0 1 0-8 0M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6";
const EYE =
  "M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" +
  "M9.5 12a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0";
const EYE_CROSS = "M4 4l16 16";
const CHEVRON_UP = "M6 15l6-6 6 6";
const KEYBOARD =
  "M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" +
  "M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8";

export const SearchIcon = () => <Icon d={SEARCH} />;
export const SunIcon = () => <Icon d={SUN} />;
export const MoonIcon = () => <Icon d={MOON} />;
export const CloseIcon = () => <Icon d={CLOSE} />;
export const BackIcon = () => <Icon d={BACK} />;
// Arrows out to enter Focus mode, arrows in to leave it.
export const FocusIcon = ({ exit = false }: { exit?: boolean }) => (
  <Icon d={exit ? FOCUS_EXIT : FOCUS_ENTER} />
);
export const BookmarkIcon = ({ filled }: { filled: boolean }) => (
  <Icon d={BOOKMARK} filled={filled} />
);
export const PlayIcon = () => <Icon d={PLAY} filled />;
export const PauseIcon = () => <Icon d={PAUSE} filled />;
export const PreviousIcon = () => <Icon d={PREVIOUS} />;
export const NextIcon = () => <Icon d={NEXT} />;
export const LoopIcon = () => <Icon d={LOOP} />;
export const VolumeIcon = ({ muted }: { muted: boolean }) => (
  <Icon d={SPEAKER + (muted ? MUTED_CROSS : SOUND_WAVES)} />
);
export const VideoIcon = () => <Icon d={VIDEO} />;
export const LinkIcon = () => <Icon d={LINK} />;
export const MusicIcon = () => <Icon d={MUSIC} />;
export const UserIcon = () => <Icon d={USER} />;
// An open eye, or a crossed-out one when the thing it controls is hidden.
export const EyeIcon = ({ crossed }: { crossed: boolean }) => (
  <Icon d={crossed ? EYE + EYE_CROSS : EYE} />
);
export const ChevronUpIcon = () => <Icon d={CHEVRON_UP} />;
export const KeyboardIcon = () => <Icon d={KEYBOARD} />;
