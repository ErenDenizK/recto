/**
 * `?read=1` (R29 big move BM-2; PRD-34): read aloud, a prototype read once at load because the
 * address is tidied after boot. The browser's own speech engine is the only voice, so without
 * `speechSynthesis` nothing of the feature shows.
 */
const asked = typeof location !== 'undefined' && /[?&]read=1(&|$)/.test(location.search);

/** The flag is on and this browser can speak (the command and its More entry show). */
export function readAloudAvailable(): boolean {
  return asked && typeof window !== 'undefined' && 'speechSynthesis' in window;
}
