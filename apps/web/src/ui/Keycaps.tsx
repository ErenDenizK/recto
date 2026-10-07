import {
  formatShortcut,
  type ParsedShortcut,
  type Platform,
  currentPlatform,
} from '../commands/shortcuts';
import styles from './Keycaps.module.css';

/**
 * Keycaps show on fine pointers; on a coarse one only after a physical key press, which sets
 * `data-keys` on the root for the session (09-primitives §15, language.md §6.2, research 19
 * M-2), and not while the last input was a finger or a pen (`noteInput`). A key typed into a
 * field may come from an on-screen keyboard, so only a key pressed outside an editable
 * element counts.
 */
function noteKeys(event: KeyboardEvent): void {
  if (!event.isTrusted) return;
  const target = event.target;
  if (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.matches('input, textarea, select'))
  ) {
    return;
  }
  document.documentElement.setAttribute('data-keys', '');
  window.removeEventListener('keydown', noteKeys, true);
}

/**
 * `data-touch-input` on the root while the last input was a finger or a pen: a menu opened by
 * a tap or a long press then shows no keycaps on a coarse pointer, even after a key earlier in
 * the session (V2 review item 26). A mouse press or a key outside a field clears it.
 */
function noteInput(event: Event): void {
  if (!event.isTrusted) return;
  const root = document.documentElement;
  if (event.type === 'pointerdown') {
    const type = (event as PointerEvent).pointerType;
    root.toggleAttribute('data-touch-input', type === 'touch' || type === 'pen');
    return;
  }
  const target = event.target;
  if (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.matches('input, textarea, select'))
  ) {
    return;
  }
  root.removeAttribute('data-touch-input');
}

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', noteKeys, true);
  window.addEventListener('pointerdown', noteInput, { capture: true, passive: true });
  window.addEventListener('keydown', noteInput, { capture: true, passive: true });
}

interface KeycapsProps {
  readonly shortcut: ParsedShortcut;
  readonly platform?: Platform;
  /** `quiet` drops the keycap border for dense rows. */
  readonly tone?: 'default' | 'quiet' | 'onGlass';
  readonly className?: string;
}

/**
 * Renders a shortcut as keycaps (09-primitives §15): caps 18 px high (20 coarse), radius 4, an
 * 11 px caption at 500. Decorative: controls carry `aria-keyshortcuts`.
 */
export function Keycaps({
  shortcut,
  platform = currentPlatform,
  tone = 'default',
  className,
}: KeycapsProps) {
  const caps = formatShortcut(shortcut, platform);
  return (
    <span
      className={[styles.keycaps, className].filter(Boolean).join(' ')}
      data-tone={tone}
      aria-hidden="true"
    >
      {caps.map((cap, index) => (
        <kbd key={`${cap}-${index}`} className={styles.cap}>
          {cap}
        </kbd>
      ))}
    </span>
  );
}
