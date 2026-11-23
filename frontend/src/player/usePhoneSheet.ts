// The phone's player sheet: a modal over the lyrics that holds every player control. Focus moves
// in when it opens and back when it closes, Tab stays inside, and Esc or widening the window
// closes it.
import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { matchesMedia } from "../browser";

// The width below which styles.css uses the phone layout.
export const PHONE_QUERY = "(max-width: 719px)";

export function isPhone(): boolean {
  return matchesMedia(PHONE_QUERY);
}

const FOCUSABLE = "button:not([disabled]), a[href], input:not([disabled])";

// Whether an element is drawn; true where the browser can't tell (jsdom has no checkVisibility).
function isShown(element: HTMLElement): boolean {
  return "checkVisibility" in element ? element.checkVisibility() : true;
}

export function usePhoneSheet(onClose: () => void) {
  const [open, setOpen] = useState(false);
  const sheetRef = useRef<HTMLElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const handleRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open) {
      handleRef.current?.focus();
    } else if (wasOpen.current) {
      openButtonRef.current?.focus();
    }
    wasOpen.current = open;
  }, [open]);

  // Turning a phone or widening the window past the phone layout closes the sheet.
  useEffect(() => {
    if (!open || typeof window.matchMedia !== "function") {
      return;
    }
    const phone = window.matchMedia(PHONE_QUERY);
    function closeWhenWide() {
      if (!phone.matches) {
        setOpen(false);
        onClose();
      }
    }
    phone.addEventListener("change", closeWhenWide);
    return () => {
      phone.removeEventListener("change", closeWhenWide);
    };
  }, [open, onClose]);

  function openSheet() {
    setOpen(true);
  }

  function closeSheet() {
    setOpen(false);
    onClose();
  }

  // Esc closes the sheet before the page's shortcuts see it.
  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!open) {
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
    const focusable = [...(sheetRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
    const shown = focusable.filter(isShown);
    const first = shown[0];
    const last = shown.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  return { open, openSheet, closeSheet, handleKeyDown, sheetRef, openButtonRef, handleRef };
}
