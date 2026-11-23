// Volume (remembered across visits), Mute, and playback speed, applied to whichever player is
// current: the YouTube video or an audio file.
import { useCallback, useRef, useState } from "react";
import { nextSpeed, storedVolume, storeVolume, toggledVolume } from "./playback";
import type { AudioClock } from "./playback";

export function usePlayerSettings(onClock: (clock: AudioClock | null) => void) {
  const [volume, setVolume] = useState(storedVolume);
  const [speed, setSpeed] = useState(1);
  // Refs mirror the state so a new player can be set up without re-creating `handleClock`.
  const volumeRef = useRef(volume);
  const speedRef = useRef(speed);
  const beforeMute = useRef(volume);
  const clockRef = useRef<AudioClock | null>(null);

  // Every new player starts at the current volume and speed.
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

  // Unmute returns to the level Mute was pressed at, not a slider step on the way down.
  function toggleMute() {
    if (volume > 0) {
      beforeMute.current = volume;
    }
    changeVolume(toggledVolume(volume, beforeMute.current));
  }

  return { volume, speed, handleClock, changeSpeed, changeVolume, toggleMute };
}
