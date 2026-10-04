/**
 * Button (components/09-primitives.md §3): every text action, from Open files… to Save copy.
 * It renders the global classes of `styles/controls.css` (`btn btn-<variant>`), so the modules
 * that still draw their own `<button>` can compose the same look until D2 migrates them.
 *
 * - Variants: `prominent` (one per surface), `standard` (a fill), `quiet` (no fill), `danger`
 *   (the danger label, never a red fill). On today's floating glass a standard or danger button
 *   renders quiet (controls.css), so its label stays legible over any page.
 * - Sizes: `md` is `--control-h` (32 px fine, 44 px coarse, quality-bar Q-9); `lg` is
 *   `--control-h-lg` for sheet footers and the launcher, never in a bar.
 * - Disabled stays focusable (`aria-disabled`, Base UI `focusableWhenDisabled`), and its
 *   reason, when the caller gives one, is the button's description and its tooltip. With no
 *   reason the description is "Not available now".
 * - `blocked` is the locked-document state of 09 §2.3: the button looks disabled, stays
 *   pressable, and a press calls `blocked.onPress` (which offers to unlock) instead of
 *   `onClick`.
 * - `busy` freezes the width at the moment it starts, sets `aria-busy` and refuses clicks
 *   (never queues them). After 400 ms the activity glyph takes the leading glyph's place and
 *   the label becomes `busyLabel` ("Saving…"), or "Working…"; a quicker job shows nothing.
 *
 * Danger never takes initial focus: a destructive confirmation focuses Cancel (09 §3.6); the
 * caller places `autoFocus`, and this component drops it from a danger button.
 */
import { Button as BaseButton } from '@base-ui/react/button';
import {
  type ComponentPropsWithRef,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { m } from '../i18n';
import { Activity, ACTIVITY_DELAY_MS } from './Activity';
import { Tooltip } from './Tooltip';

export type ButtonVariant = 'prominent' | 'standard' | 'quiet' | 'danger';

export interface ButtonBlocked {
  /** Why the action is unavailable ("Locked · Unlock"). */
  readonly reason: string;
  /** Called instead of `onClick`; usually opens the Unlock popover. */
  readonly onPress: () => void;
}

export interface ButtonProps
  extends Omit<ComponentPropsWithRef<'button'>, 'children' | 'disabled' | 'type'> {
  readonly variant?: ButtonVariant;
  readonly size?: 'md' | 'lg';
  /** A leading glyph, 16 px (20 px coarse). */
  readonly icon?: ReactNode;
  readonly busy?: boolean;
  /** The label while busy, a verb with an ellipsis ("Saving…"). */
  readonly busyLabel?: string | undefined;
  readonly disabled?: boolean;
  /** Why the button is disabled; read as its description and shown as its tooltip. */
  readonly reason?: string | undefined;
  readonly blocked?: ButtonBlocked | undefined;
  readonly type?: 'button' | 'submit' | 'reset';
  readonly children: ReactNode;
}

export function Button({
  variant = 'standard',
  size = 'md',
  icon,
  busy = false,
  busyLabel,
  disabled = false,
  reason,
  blocked,
  type = 'button',
  className,
  onClick,
  autoFocus,
  children,
  ref,
  ...rest
}: ButtonProps) {
  const reasonId = useId();
  const own = useRef<HTMLButtonElement | null>(null);
  // Busy shows only after 400 ms (MC-33): a quicker job changes nothing on screen.
  const [working, setWorking] = useState(false);
  if (!busy && working) setWorking(false);
  useEffect(() => {
    if (!busy) return undefined;
    const timer = window.setTimeout(() => setWorking(true), ACTIVITY_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [busy]);

  // Busy freezes the width it had at the press, so the label change never moves its row.
  useLayoutEffect(() => {
    const element = own.current;
    if (!element) return;
    if (busy) element.style.minWidth = `${element.getBoundingClientRect().width}px`;
    else element.style.removeProperty('min-width');
  }, [busy]);

  const unavailable = disabled || blocked !== undefined;
  const description = blocked?.reason ?? (disabled ? (reason ?? m.control_unavailable()) : null);

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (busy) {
      event.preventDefault();
      return;
    }
    if (blocked) {
      event.preventDefault();
      blocked.onPress();
      return;
    }
    onClick?.(event);
  };

  const button = (
    <BaseButton
      {...rest}
      ref={(node: HTMLElement | null) => {
        own.current = node as HTMLButtonElement | null;
        if (typeof ref === 'function') ref(node as HTMLButtonElement | null);
        else if (ref) ref.current = node as HTMLButtonElement | null;
      }}
      type={type}
      disabled={disabled}
      focusableWhenDisabled
      {...(autoFocus === true && variant !== 'danger' ? { autoFocus: true } : {})}
      aria-busy={busy || undefined}
      aria-describedby={
        description === null
          ? rest['aria-describedby']
          : [rest['aria-describedby'], reasonId].filter(Boolean).join(' ')
      }
      data-blocked={blocked ? '' : undefined}
      className={['btn', `btn-${variant}`, size === 'lg' ? 'btn-lg' : null, className]
        .filter(Boolean)
        .join(' ')}
      onClick={handleClick}
    >
      {busy && working ? <Activity delay={0} /> : icon}
      <span data-btn-label="">{busy && working ? (busyLabel ?? m.control_busy()) : children}</span>
    </BaseButton>
  );
  if (!unavailable || description === null) return button;

  // The reason is the button's description (a sibling, so it stays out of the name) and a
  // tooltip for pointer users; on touch the caller shows it as a footnote under the group
  // (09 §2.3), since a tooltip needs a long press there.
  return (
    <>
      <Tooltip label={description} side="top">
        {button}
      </Tooltip>
      <span id={reasonId} className="visually-hidden">
        {description}
      </span>
    </>
  );
}
