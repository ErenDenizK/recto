/**
 * The title menu's eye (docs/plan/v1/PLAN.md S2-1a; `see-original.ts`): one header row,
 * "Hide markup", with the eye glyph and "Hold to peek" trailing.
 *
 * - **Hold** (past `HOLD_MS`): the markup hides while the press lasts, and the menu fades
 *   aside so the page shows (`data-peeking` on the popup); release brings both back, and so
 *   does `pointercancel` or a lost capture, whatever took the pointer.
 * - **Tap**, Enter or Space: toggles. Turning it on closes the menu, so the pages show, and
 *   the strip's pill (`OriginalPill.tsx`) says the markup is hidden and brings it back. While
 *   it is on the row reads "Show markup" with the eye crossed out.
 *
 * A button named by what it does next (its label changes, so it is not an `aria-pressed`
 * toggle), never a `menuitem`: it sits in the header with the Lock switch, outside the rows'
 * roving focus.
 */
import { type KeyboardEvent, type PointerEvent, useId, useRef } from 'react';

import { m } from '../../i18n';
import { Icon } from '../../ui/Icon';
import { closeTitleMenu } from './frame-store';
import {
  HOLD_MS,
  holdOriginal,
  releaseOriginal,
  toggleOriginal,
  useOriginalStore,
} from './see-original';
import styles from './TitleMenu.module.css';

export function OriginalRow() {
  const toggled = useOriginalStore((s) => s.toggled);
  const press = useRef<{ timer: number; held: boolean } | null>(null);
  const hintId = useId();

  const end = (cancelled: boolean) => {
    const current = press.current;
    press.current = null;
    if (!current) return;
    window.clearTimeout(current.timer);
    if (current.held) {
      releaseOriginal();
      return;
    }
    if (!cancelled) tap();
  };

  const tap = () => {
    const turningOn = !useOriginalStore.getState().toggled;
    toggleOriginal();
    if (turningOn) closeTitleMenu();
  };

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // A pointer the browser no longer tracks: its release still ends the press.
    }
    const timer = window.setTimeout(() => {
      if (!press.current) return;
      press.current.held = true;
      holdOriginal();
    }, HOLD_MS);
    press.current = { timer, held: false };
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    if (!event.repeat) tap();
  };

  const label = toggled ? m.original_show() : m.original_eye();
  return (
    // A header row of the title menu, as the privacy line beside it; ui/Button is an action
    // capsule, not a row. Press, hold and release are its own (S2-1a).
    <button
      type="button"
      // eslint-disable-next-line recto/q9-controls
      className={styles.privacy}
      aria-describedby={hintId}
      data-on={toggled || undefined}
      data-testid="title-menu-original"
      onPointerDown={onPointerDown}
      onPointerUp={() => end(false)}
      onPointerCancel={() => end(true)}
      onLostPointerCapture={() => end(true)}
      onKeyDown={onKeyDown}
      // Pointer presses end in `onPointerUp`; only a click without one (assistive technology)
      // still toggles.
      onClick={(event) => {
        if (event.detail === 0) tap();
      }}
    >
      <Icon name={toggled ? 'eye-slash' : 'eye'} aria-hidden="true" />
      <span className={styles.privacyLabel}>{label}</span>
      <span id={hintId} className={styles.hold} aria-hidden="true">
        {m.original_eye_hint()}
      </span>
    </button>
  );
}
