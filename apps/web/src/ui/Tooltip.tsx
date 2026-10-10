/**
 * The tooltip primitive (09-primitives §20; behaviour and copy are 04-context §20), on Base
 * UI's `Tooltip` (ADR-0009). Tooltips are hints: the trigger carries its own accessible name
 * (`aria-label`) and, with a shortcut, `aria-keyshortcuts`.
 *
 * - **Delays.** One `TooltipProvider` for the app (AppShell): 500 ms on hover, at once while
 *   the group is warm (600 ms after the last one closed: moving along a bar jumps from one to
 *   the next without waiting again, as on macOS), closing at once. Focus shows it at once.
 * - **Hover hold (A-24).** The popup is hoverable: the pointer can move onto it and it stays
 *   until the pointer leaves both, Esc, or a press elsewhere. Esc closes it without taking
 *   the key: the key still does its job where focus is (disarm the tool, clear the lasso
 *   selection, close the dialog). Base UI would otherwise prevent and stop it, so a keyboard
 *   user's first Esc on any control with a tooltip did nothing else (DESIGN.md §5).
 * - **Touch.** Base UI never opens tooltips on touch. A touch held 450 ms on the trigger shows
 *   it until release, and that release does not activate the control (no click, no context
 *   menu). Moving more than 10 px first cancels it, so scrolling a bar never shows one.
 *   Callers with their own long press (↶ opens History) leave the tooltip off that trigger.
 * - **Reasons.** A dimmed control says why: `reason` shows as "{label}: {reason}" and is also
 *   the trigger's description (`aria-describedby`), because tooltips are not read reliably.
 *   A disabled control without a reason shows no tooltip at all: it would only repeat the
 *   name of something that cannot be used.
 * - **Keycaps** follow the shortcut on fine pointers; on a coarse primary pointer only once a
 *   physical key has been pressed in this session (09 §2.1 `--keycaps`, input modality).
 * - **Look.** Solid raised surface with the rim, no blur (`.mat-tooltip`, G-29), 26 px tall
 *   (28 coarse), 4 / 8 padding, at most 280 px wide, wrapping to two lines. The e2 shadow
 *   waits for the elevation tokens (D3); until then tooltips stay flat as today.
 *   Motion *tooltip* (motion-2026-10/platform.md §4): after the delay it fades in and rises
 *   2 px away from its anchor in `--duration-fast`; a warm switch (`data-instant`) jumps;
 *   reduced motion keeps the fade.
 */
import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip';
import {
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import type { ParsedShortcut } from '../commands/shortcuts';
import { inputTracker, usePointerCapabilities } from '../shell/frame/input-modality';
import { Keycaps } from './Keycaps';
import styles from './Tooltip.module.css';

/** Hover rests this long before a tooltip shows (04-context §20). */
export const TOOLTIP_DELAY_MS = 500;
/**
 * While a tooltip shows, and this long after it closes, the next trigger shows its own at once
 * (the warm-up of macOS: moving along a bar does not wait again, motion-2026-10/platform.md §4).
 */
export const TOOLTIP_WARM_MS = 600;

/** How long a touch is held before the tooltip shows (04-context §20). */
export const TOUCH_HOLD_MS = 450;
/** How far a held touch may drift and still count as held (CSS px). */
const TOUCH_SLOP_PX = 10;

/**
 * The app's one tooltip group (AppShell, which also installs the container transform of menus
 * and popovers, `ui/container-transform.ts`).
 */
export function TooltipProvider({ children }: { readonly children: ReactNode }) {
  return (
    <BaseTooltip.Provider delay={TOOLTIP_DELAY_MS} closeDelay={0} timeout={TOOLTIP_WARM_MS}>
      {children}
    </BaseTooltip.Provider>
  );
}

// --- Keycap visibility ----------------------------------------------------------------------

let keyboardSeen = false;

function subscribeKeyboard(listener: () => void): () => void {
  const tracker = inputTracker();
  return tracker.subscribe(() => {
    if (tracker.get() === 'keyboard') keyboardSeen = true;
    listener();
  });
}

function getKeyboardSeen(): boolean {
  if (inputTracker().get() === 'keyboard') keyboardSeen = true;
  return keyboardSeen;
}

/** Whether keycaps show: always on fine pointers, on coarse once a key has been pressed. */
export function useKeycapsVisible(): boolean {
  const { primary } = usePointerCapabilities();
  const seen = useSyncExternalStore(subscribeKeyboard, getKeyboardSeen, () => false);
  return primary !== 'coarse' || seen;
}

// --- The tooltip --------------------------------------------------------------------------

interface TooltipProps {
  readonly label: string;
  readonly shortcut?: ParsedShortcut | undefined;
  /** Why the control is unavailable; shown after the label and described on the trigger. */
  readonly reason?: string | undefined;
  /** Also describe the trigger with the label (a tooltip that explains, not one that names). */
  readonly describe?: boolean | undefined;
  /**
   * The control is disabled. Without a `reason` the tooltip stays off. Read from the
   * trigger's own `disabled` or `aria-disabled` when not given.
   */
  readonly disabled?: boolean | undefined;
  readonly side?: 'top' | 'bottom' | 'left' | 'right';
  /** The trigger element. It receives the tooltip's props and ref. */
  readonly children: ReactElement;
}

interface Hold {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  timer: number;
  shown: boolean;
}

function triggerDisabled(children: ReactElement): boolean {
  const props = children.props as { disabled?: unknown; 'aria-disabled'?: unknown };
  const aria = props['aria-disabled'];
  return props.disabled === true || aria === true || aria === 'true';
}

export function Tooltip({
  label,
  shortcut,
  reason,
  describe = false,
  disabled,
  side = 'bottom',
  children,
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const hold = useRef<Hold | null>(null);
  const reasonId = useId();
  const keycaps = useKeycapsVisible();
  const off = (disabled ?? triggerDisabled(children)) && !reason;
  const description = reason ?? (describe ? label : undefined);

  useEffect(
    () => () => {
      if (hold.current) window.clearTimeout(hold.current.timer);
    },
    [],
  );

  const endHold = (event: PointerEvent) => {
    const current = hold.current;
    if (current?.id !== event.pointerId) return;
    window.clearTimeout(current.timer);
    hold.current = null;
    document.removeEventListener('pointermove', onHoldMove);
    document.removeEventListener('pointerup', endHold);
    document.removeEventListener('pointercancel', endHold);
    if (!current.shown) return;
    setOpen(false);
    if (event.type !== 'pointerup') return;
    // The release that ends a held tooltip does not activate the control.
    const swallow = (click: Event) => {
      click.preventDefault();
      click.stopPropagation();
    };
    window.addEventListener('click', swallow, { capture: true, once: true });
    window.setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0);
  };

  const onHoldMove = (event: PointerEvent) => {
    const current = hold.current;
    if (current?.id !== event.pointerId || current.shown) return;
    if (Math.hypot(event.clientX - current.x, event.clientY - current.y) > TOUCH_SLOP_PX) {
      window.clearTimeout(current.timer);
      hold.current = null;
      document.removeEventListener('pointermove', onHoldMove);
      document.removeEventListener('pointerup', endHold);
      document.removeEventListener('pointercancel', endHold);
    }
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (off || event.pointerType !== 'touch' || !event.isPrimary) return;
    if (hold.current) window.clearTimeout(hold.current.timer);
    const current: Hold = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      timer: 0,
      shown: false,
    };
    current.timer = window.setTimeout(() => {
      current.shown = true;
      setOpen(true);
    }, TOUCH_HOLD_MS);
    hold.current = current;
    document.addEventListener('pointermove', onHoldMove);
    document.addEventListener('pointerup', endHold);
    document.addEventListener('pointercancel', endHold);
  };

  return (
    <>
      <BaseTooltip.Root
        open={open && !off}
        disabled={off}
        onOpenChange={(next, details) => {
          if (!next && details.reason === 'escape-key') {
            // Closed here, so Base UI neither prevents nor stops the key.
            details.cancel();
            details.allowPropagation();
          }
          // A held touch decides when its tooltip closes.
          if (!next && hold.current?.shown) return;
          setOpen(next);
        }}
      >
        <BaseTooltip.Trigger
          render={children}
          {...(description ? { 'aria-describedby': reasonId } : {})}
          onPointerDown={onPointerDown}
          onContextMenu={(event) => {
            // A held touch is the tooltip's, not the browser's context menu.
            if (hold.current) event.preventDefault();
          }}
        />
        <BaseTooltip.Portal>
          <BaseTooltip.Positioner side={side} sideOffset={6} collisionPadding={8}>
            <BaseTooltip.Popup className={styles.popup} role="tooltip">
              <span className={styles.text}>
                {label}
                {reason ? <span className={styles.reason}>: {reason}</span> : null}
              </span>
              {shortcut && keycaps && !reason ? (
                <Keycaps shortcut={shortcut} tone="onGlass" />
              ) : null}
            </BaseTooltip.Popup>
          </BaseTooltip.Positioner>
        </BaseTooltip.Portal>
      </BaseTooltip.Root>
      {description ? (
        <span id={reasonId} hidden>
          {description}
        </span>
      ) : null}
    </>
  );
}
