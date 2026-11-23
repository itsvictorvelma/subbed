# 029 — Phone polish: mini player, roomier lyrics, iPhone fixes

Status: approved

## Goal

Subbed will be shown on an iPhone as often as on a laptop. On a phone today the lyrics get 28% of the screen, the player is two cramped rows of desktop controls, Safari zooms in when a text box is tapped, and some things run off the edge. This spec makes every phone page clean and easy to use, and leaves the desktop exactly as it is.

## The rule above all

**The desktop does not change by a single pixel.** Every visual change lives inside the existing phone block in `styles.css` (`max-width: 719px`). New elements exist only for the phone and are `display: none` outside that block. Before any change, 33 desktop screenshots were taken (dark, light, and a 1024 px window, guest and signed in, every page and player state). They are retaken at the end and compared pixel by pixel. Any difference beyond the rendering noise measured between two identical runs blocks the PR.

## In scope (phone width only)

**Player: mini player and sheet** (the approved mockup, option A)
- **Collapsed:** a slim bar holds play/pause, the current line and time ("1:46 / 4:40"), previous line, next line, and an "open" button. Tapping the line or the open button opens the sheet.
- **Sheet:** slides up over the lyrics with a dimmed backdrop (the dark theme's shadow black at 50%, in both themes, since no overlay token exists). Tab stays inside the sheet while it is open, and widening past the phone layout closes it. It holds the large position slider and times, previous / play / next, then Loop line, Speed and Mute as three equal buttons, then the sync row (Earlier, "Sync: +0.00 s", Later; the words stay the same because they are shared with the desktop), then Show video and Change audio.
- **Mini bar text:** the sung line, or the song title during a blank line or before any line. Screen readers hear it as the button's name.
- **Closing the sheet:** the handle, the backdrop, or Esc. Focus moves into the sheet on open and back to the open button on close.
- **No audio yet:** the bar shows one "Play along" button that opens the sheet with the existing chooser (Find on YouTube, paste a link, play a file), laid out full width.
- **Video on:** the video sits above the mini bar, full width, 16:9.
- **Keyboard shortcuts button and panel:** not shown on the phone, since there is no keyboard.

**Header**
- **One row:** the wordmark on the left. Search, Your songs and Account (or Sign in) become 44 pt icon buttons with the same accessible names. The theme button stays.
- **Search:** on pages with the header search, the search icon opens it as a full-width row and focuses it. "Home" is dropped on the phone, since the wordmark already goes home.

**Song page**
- **Title row:** back, then the title on one line (ellipsis), then artist and status, then a round, icon-only Save button.
- **One column row:** the existing かな / Romaji / EN picker, plus an eye button that hides the chosen column to test yourself, and shows it again. It replaces the Hide row on the phone. Hiding uses the same state as the desktop Hide toggles.

**iPhone fixes everywhere**
- **No zoom on tap:** text boxes are 16 px (search, library filter, YouTube link, sign-in and delete-account fields).
- **Touch targets:** every control is at least 44 × 44 pt. This includes Find, the column picker, the slider's touch area, speed, sync, and Change audio.
- **Notch and home bar:** `viewport-fit=cover`, plus `env(safe-area-inset-*)` padding. The player and sheet clear the home bar, and the edges clear the notch in landscape. Most iPhones in landscape get the desktop layout, so the base paddings become `max(<value>, env(...))`; `env()` is 0 in a desktop browser, so desktop pixels do not change.
- **Home page:** the song row no longer runs off the left edge, the example card keeps its four words on fewer lines, and the keyboard hints ("Press / to search", "Press ? for shortcuts") are hidden.

## Out of scope

- Any desktop change: layout, colour, wording, or behaviour.
- New features, new colours or tokens (the mockup uses only spec 013's tokens), and a new breakpoint. Tablets wider than 719 px keep the desktop layout.
- Swipe gestures for the sheet. Tapping is enough for now.

## Rules

- Phone-only elements carry a class that styles.css hides by default and shows only inside the phone block. A test enforces this, so nothing phone-only can leak onto the desktop.
- The sheet is a real dialog: `role="dialog"`, labelled, with focus moved in and returned, and Esc to close. Background lyrics stay readable but can't be clicked while it's open.
- Reduced motion: the sheet appears without the slide.
- Japanese text keeps its font stack. All controls keep visible focus, and nothing relies on colour alone (spec 013).

## Security

No change. This is a page-only spec: no new input, no new request, and nothing new stored or logged.

## Acceptance checks

- AC-1: On the phone, the player shows the mini bar. Its open button and the line text open the sheet, and the handle, backdrop and Esc close it, with focus moved in and returned.
- AC-2: The mini bar shows the current line's original text and the time. With no audio, it shows Play along, which opens the chooser.
- AC-3: The sheet holds the slider, the transport, Loop, Speed, Mute, the sync stepper, Show video and Change audio, all working as before.
- AC-4: On the phone, the header's search icon opens and focuses the search box. Your songs and Account are named icon links.
- AC-5: The eye button hides and shows the chosen phone column, using the same hidden state as the desktop Hide toggles.
- AC-6: Every phone-only element is hidden outside the phone block (test reads styles.css).
- AC-7: Text inputs are at least 16 px inside the phone block (test reads styles.css).
- AC-8: The desktop screenshots match the baseline (scripted comparison, result in the PR).
- AC-9: Phone screenshots before and after for every page, kept locally for the review, not committed (they show real lyrics). The lyrics area is at least 60% of an iPhone screen with the player collapsed.
- AC-10: `scripts/check.sh` passes.

## Plan

- **`styles.css`:**
  - Outside the phone block: one `.phone-only { display: none }` rule placed after every base rule, and a `sheet-up` keyframe.
  - Everything else inside the phone block: the header, song head, mini bar, sheet (a grid of named areas), safe areas, 44 pt targets and 16 px inputs.
- **`PlayerBar.tsx`:**
  - New state: `sheetOpen`.
  - Phone-only parts: the backdrop, handle, line button, open button and Play along.
  - When open: `role="dialog"`, Esc caught before the page's shortcuts, focus moved in and back.
  - `PlayerControls.tsx` gains classes for grid placement and phone-only tile labels.
- **`Header.tsx`:** a phone-only search toggle (`is-searching`), and icons beside the link labels. On the phone the labels are visually hidden, so the accessible names don't change.
- **`ColumnButtons.tsx`:** `PhoneHideButton`, using the same `toggleColumn` as the Hide toggles.
- **`SongPage.tsx`:** wraps the phone tabs and the eye button in a phone-only row, and passes the sung line's text to the player.
- **`SaveButton.tsx`:** wraps its label in a span.
- **`HomePage.tsx`:** tags the keyboard hints.
- **`icons.tsx`:** user, eye and chevron icons.
- **`index.html`:** `viewport-fit=cover`.
- **Checking the desktop:**
  - A scratch Chrome DevTools script (not committed) took the desktop set from a worktree of `main` and from this branch, with the same database copy, and compared them pixel by pixel.
  - The only differences are a few anti-aliased pixels on rounded corners. They also appear between two runs of `main`, and they move from file to file between runs.
