// The song head's column buttons: the phone's second-column tabs and eye button, and the Hide
// toggles for self-testing.
import { EyeIcon } from "../icons";
import type { VersionColumn } from "../types";

const COLUMN_BUTTONS: { column: VersionColumn; label: string; lang: string }[] = [
  { column: "hiragana", label: "かな", lang: "ja" },
  { column: "romaji", label: "Romaji", lang: "en" },
  { column: "english", label: "EN", lang: "en" },
];

interface PhoneTabsProps {
  value: VersionColumn;
  onChange: (column: VersionColumn) => void;
}

// On a phone, which version shows next to the original. Hidden on wider screens by styles.css.
export function PhoneTabs({ value, onChange }: PhoneTabsProps) {
  return (
    <div className="segmented phone-tabs" role="group" aria-label="Second column">
      {COLUMN_BUTTONS.map(({ column, label, lang }) => (
        <button
          key={column}
          type="button"
          lang={lang}
          aria-pressed={value === column}
          onClick={() => {
            onChange(column);
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

interface HideColumnTogglesProps {
  hidden: Set<VersionColumn>;
  onToggle: (column: VersionColumn) => void;
}

// One toggle per version; a pressed one covers that column so the learner can test themselves.
export function HideColumnToggles({ hidden, onToggle }: HideColumnTogglesProps) {
  return (
    <div className="hide-toggles" role="group" aria-label="Hide columns">
      <span className="dim" aria-hidden="true">
        Hide
      </span>
      <div className="segmented">
        {COLUMN_BUTTONS.map(({ column, label, lang }) => (
          <button
            key={column}
            type="button"
            lang={lang}
            aria-pressed={hidden.has(column)}
            onClick={() => {
              onToggle(column);
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface PhoneHideButtonProps {
  column: VersionColumn;
  hidden: Set<VersionColumn>;
  onToggle: (column: VersionColumn) => void;
}

// On a phone, one eye button covers or uncovers the column shown next to the original, using the
// same hidden set as the Hide toggles.
export function PhoneHideButton({ column, hidden, onToggle }: PhoneHideButtonProps) {
  const isHidden = hidden.has(column);
  return (
    <button
      type="button"
      className="icon-button phone-hide-button"
      aria-label="Hide this column"
      aria-pressed={isHidden}
      onClick={() => {
        onToggle(column);
      }}
    >
      <EyeIcon crossed={isHidden} />
    </button>
  );
}
