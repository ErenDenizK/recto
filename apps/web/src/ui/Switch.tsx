/**
 * Switch (components/09-primitives.md §7): a setting that applies at once (Reduce motion, Draw
 * with finger, Open documents locked, the title menu's Lock, Password in Save a copy). Not for
 * options that wait for a confirm: those are checkboxes.
 *
 * - A row of `--control-h` (32 px fine, 44 px coarse): the label leads, the switch trails, and
 *   the `<label>` wraps both, so a press anywhere on the row toggles it. No On/Off words: the
 *   label names the setting.
 * - Track 36 × 20 fine (thumb 16), 52 × 32 coarse (thumb 28). Off: a transparent track with the
 *   1.5 px `--control-border` and the `--control-thumb-off` thumb; on: the `--control-on` track
 *   and the `--control-on-ink` thumb, neutral like every on-state (09 §34 issue 1). Hover steps
 *   the border or fill; a press widens the thumb 4 px (iOS); the thumb rides the press spring.
 *   An optional glyph sits in the thumb (Lock's padlock).
 * - Click, tap and Space toggle; Enter does not (it stays the form's submit). Dragging the
 *   thumb past half its travel toggles on release, and the click that follows is swallowed.
 * - `system` marks a setting the system forces (reduced motion set by the OS): the switch shows
 *   that state, is disabled, and says "On, set by your system" under the label (A-17).
 * - `busy` (Lock while a save writes) shows the activity glyph in the thumb and refuses input.
 *
 * Base UI `Switch` (`role="switch"`, `aria-checked`), focusable with the outset ring.
 */
import { Switch as BaseSwitch } from '@base-ui/react/switch';
import {
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  useId,
  useRef,
} from 'react';

import { m } from '../i18n';
import { Activity } from './Activity';
import styles from './Switch.module.css';

export interface SwitchProps {
  readonly checked: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
  /** The setting's name, shown before the switch. */
  readonly label: string;
  /**
   * Keep the label for assistive technology only: a switch trailing a row whose title already
   * names the thing (a sheet row: "English · 2.0 MB", the switch "Keep English available
   * offline"), as `TextField`'s `hideLabel`.
   */
  readonly hideLabel?: boolean | undefined;
  /** A second line under the label. */
  readonly description?: string | undefined;
  readonly disabled?: boolean | undefined;
  /** The system forces this value: shown, disabled, and said under the label. */
  readonly system?: boolean | undefined;
  readonly busy?: boolean | undefined;
  /** A glyph inside the thumb, drawn at 12 px (Lock's padlock). */
  readonly glyph?: ReactNode;
  readonly className?: string | undefined;
}

/** Travel past this share of the track toggles on release. */
const DRAG_THRESHOLD = 0.5;
/** A pointer that moves less than this is a press, not a drag. */
const DRAG_SLOP = 4;

export function Switch({
  checked,
  onCheckedChange,
  label,
  hideLabel = false,
  description,
  disabled = false,
  system = false,
  busy = false,
  glyph,
  className,
}: SwitchProps) {
  const noteId = useId();
  const labelId = useId();
  const drag = useRef<{ x: number; moved: boolean; offset: number } | null>(null);
  const swallow = useRef(false);
  const root = useRef<HTMLElement | null>(null);
  const inert = disabled || system || busy;
  const note = system ? (checked ? m.switch_system_on() : m.switch_system_off()) : description;

  const travel = () => {
    const element = root.current;
    if (!element) return 0;
    const thumb = element.querySelector<HTMLElement>('[data-switch-thumb]');
    return element.clientWidth - (thumb?.offsetWidth ?? 0) - 4;
  };

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (inert || event.button !== 0) return;
    swallow.current = false;
    drag.current = { x: event.clientX, moved: false, offset: 0 };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // A pointer the browser no longer tracks: the drag still follows its events.
    }
  };
  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const state = drag.current;
    if (!state) return;
    const dx = event.clientX - state.x;
    if (!state.moved && Math.abs(dx) < DRAG_SLOP) return;
    state.moved = true;
    const span = travel();
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
    const signed = rtl ? -dx : dx;
    state.offset = Math.max(-span, Math.min(span, signed));
    // The thumb follows the finger from where it rests.
    const from = checked ? span : 0;
    const at = Math.max(0, Math.min(span, from + state.offset));
    event.currentTarget.style.setProperty('--switch-drag', `${rtl ? -at : at}px`);
    event.currentTarget.setAttribute('data-dragging', '');
  };
  const onPointerEnd = (event: PointerEvent<HTMLElement>) => {
    const state = drag.current;
    drag.current = null;
    event.currentTarget.removeAttribute('data-dragging');
    event.currentTarget.style.removeProperty('--switch-drag');
    if (!state?.moved) return;
    // A drag decides by where the thumb ends: past half its travel toggles.
    const span = travel();
    const from = checked ? span : 0;
    const at = Math.max(0, Math.min(span, from + state.offset));
    const next = at > span * DRAG_THRESHOLD;
    swallow.current = true;
    if (next !== checked) onCheckedChange(next);
  };
  const onClickCapture = (event: MouseEvent<HTMLElement>) => {
    if (!swallow.current) return;
    swallow.current = false;
    event.preventDefault();
    event.stopPropagation();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement> & { preventBaseUIHandler?: () => void }) => {
    // Enter stays the form's submit (09 §7.6); only Space toggles.
    if (event.key === 'Enter') event.preventBaseUIHandler?.();
  };

  return (
    <label
      className={[styles.row, className].filter(Boolean).join(' ')}
      data-disabled={inert || undefined}
    >
      <span className={hideLabel && !note ? 'visually-hidden' : styles.text}>
        <span id={labelId} className={hideLabel ? 'visually-hidden' : styles.label}>
          {label}
        </span>
        {note ? (
          <span id={noteId} className={styles.note}>
            {note}
          </span>
        ) : null}
      </span>
      <BaseSwitch.Root
        ref={root}
        checked={checked}
        onCheckedChange={(next) => onCheckedChange(next)}
        disabled={disabled || system}
        readOnly={busy}
        aria-busy={busy || undefined}
        aria-labelledby={labelId}
        aria-describedby={note ? noteId : undefined}
        className={styles.track}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClickCapture={onClickCapture}
        onKeyDown={onKeyDown}
      >
        <BaseSwitch.Thumb className={styles.thumb} data-switch-thumb="">
          {busy ? <Activity delay={0} size="sm" className={styles.glyph} /> : glyph}
        </BaseSwitch.Thumb>
      </BaseSwitch.Root>
    </label>
  );
}
