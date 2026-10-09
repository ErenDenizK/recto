/**
 * IconButton (components/09-primitives.md §4): an icon-only action named by its tooltip, for
 * the actions I-6 allows (close, search, undo, redo, more, share) and the tools on a bar.
 *
 * - A circle (language.md §6.1: icon-only buttons are circles), in two sizes:
 *   - `bar`: `--control-h` (32 px fine, 44 px coarse) with a 20 px icon, for every bar, so a
 *     bar's buttons share one height and one centre line (quality-bar Q-9);
 *   - `row`: the S size, `--control-h-sm` (24 px fine, 32 px coarse) with a 16 px icon, inside
 *     list rows and panel headers; on a coarse pointer its hit area grows to 44 px without
 *     moving the row (`::after`, 09 §2.1 `--hit-min`; system-audit-2026-10 §3.3).
 * - States from the shared tokens (09 §2.3): a hover wash on fine pointers, a pressed wash and
 *   the press scale, the two-band focus ring (inset inside glass), disabled in the disabled
 *   colour. `aria-pressed` makes it a toggle: neutral in a row, `--accent-muted` on a bar; a bar
 *   button with `data-tool` that is pressed is the armed tool (`--tool-active-fill`).
 * - The label is mandatory: it is the accessible name and the tooltip, with the shortcut's
 *   keycaps ("{label} · keys") when there is one.
 * - `onLongPress` (touch and pen): a press held 500 ms calls it and swallows the click that
 *   follows, so ↶ can open History (F§5.3) while a tap still undoes.
 */
import {
  type ComponentPropsWithRef,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  useRef,
} from 'react';

import type { ParsedShortcut } from '../commands/shortcuts';
import { currentPlatform, toAriaKeyShortcut } from '../commands/shortcuts';
import styles from './IconButton.module.css';
import { Tooltip } from './Tooltip';

export type IconButtonSize = 'row' | 'bar';

interface IconButtonProps extends Omit<ComponentPropsWithRef<'button'>, 'children'> {
  /** Accessible name and tooltip text. */
  readonly label: string;
  /** Tooltip text when it should say more than the accessible name. */
  readonly tooltip?: string | undefined;
  readonly icon: ReactNode;
  readonly shortcut?: ParsedShortcut | undefined;
  readonly tooltipSide?: 'top' | 'bottom' | 'left' | 'right';
  readonly size?: IconButtonSize;
  /** Touch and pen: a 500 ms hold calls this instead of the click. */
  readonly onLongPress?: (() => void) | undefined;
}

/** How long a touch or pen press is held before it counts as a long press. */
export const LONG_PRESS_MS = 500;
/** How far it may travel and still be a press (09 §3.6's 10 px slop). */
const LONG_PRESS_SLOP = 10;

/** Square icon button with tooltip. Hover and pressed states never change its box. */
export function IconButton({
  label,
  tooltip,
  icon,
  shortcut,
  tooltipSide = 'bottom',
  size = 'bar',
  onLongPress,
  className,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onClickCapture,
  ...rest
}: IconButtonProps) {
  const hold = useRef<{ timer: number; x: number; y: number } | null>(null);
  const swallow = useRef(false);

  const cancelHold = () => {
    if (hold.current) window.clearTimeout(hold.current.timer);
    hold.current = null;
  };

  const handlers = onLongPress
    ? {
        onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
          onPointerDown?.(event);
          swallow.current = false;
          if (event.pointerType === 'mouse') return;
          cancelHold();
          hold.current = {
            x: event.clientX,
            y: event.clientY,
            timer: window.setTimeout(() => {
              hold.current = null;
              swallow.current = true;
              onLongPress();
            }, LONG_PRESS_MS),
          };
        },
        onPointerMove: (event: PointerEvent<HTMLButtonElement>) => {
          onPointerMove?.(event);
          const start = hold.current;
          if (
            start &&
            Math.hypot(event.clientX - start.x, event.clientY - start.y) > LONG_PRESS_SLOP
          ) {
            cancelHold();
          }
        },
        onPointerUp: (event: PointerEvent<HTMLButtonElement>) => {
          onPointerUp?.(event);
          cancelHold();
        },
        onPointerCancel: (event: PointerEvent<HTMLButtonElement>) => {
          onPointerCancel?.(event);
          cancelHold();
        },
        onClickCapture: (event: MouseEvent<HTMLButtonElement>) => {
          if (swallow.current) {
            swallow.current = false;
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          onClickCapture?.(event);
        },
      }
    : { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onClickCapture };

  const button = (
    <button
      type="button"
      aria-label={label}
      aria-keyshortcuts={shortcut ? toAriaKeyShortcut(shortcut, currentPlatform) : undefined}
      className={[styles.button, className].filter(Boolean).join(' ')}
      data-size={size}
      {...rest}
      {...handlers}
    >
      {icon}
    </button>
  );
  return (
    <Tooltip label={tooltip ?? label} shortcut={shortcut} side={tooltipSide}>
      {button}
    </Tooltip>
  );
}
