/**
 * The popover primitive (10-ink.md §7; 04-context §15): one recipe for every non-modal panel
 * anchored to a control or a point, on Base UI's `Popover`.
 *
 * - `PopoverPopup` is the portal, the positioner and the popup in one: M4 glass, radius 16,
 *   12 px padding, the *popup* motion from the anchor (`Popover.module.css`). It positions
 *   8 px off its anchor and 8 px inside the viewport unless told otherwise, and takes focus
 *   itself when it opens (Tab reaches ✕ and the controls).
 * - `PopoverHeader` is the 44 px title row: the title (`Popover.Title`, so the popup is
 *   labelled by it), an optional leading control and ✕ (`Popover.Close`, "Close"). A popover
 *   that ends in its own Cancel can leave ✕ out (`close={false}`).
 * - `PopoverBody` is the description (`Popover.Description`), 13/18 in the secondary colour.
 *
 * The root stays Base UI's (`Popover.Root`, `Popover.Trigger`), so callers keep their
 * controlled state, triggers and focus rules.
 */
import { Popover } from '@base-ui/react/popover';
import { X } from 'lucide-react';
import { type ComponentProps, type ReactNode, useRef } from 'react';

import { m } from '../i18n';
import styles from './Popover.module.css';

type PositionerProps = ComponentProps<typeof Popover.Positioner>;
type PopupProps = Omit<ComponentProps<typeof Popover.Popup>, 'className'>;

export interface PopoverPopupProps extends PopupProps {
  readonly side?: PositionerProps['side'];
  readonly align?: PositionerProps['align'];
  readonly sideOffset?: PositionerProps['sideOffset'];
  readonly anchor?: PositionerProps['anchor'];
  readonly collisionPadding?: PositionerProps['collisionPadding'];
  readonly className?: string | undefined;
  /** On the positioner (a stacking order of the host's). */
  readonly positionerClassName?: string | undefined;
}

export function PopoverPopup({
  side = 'bottom',
  align = 'center',
  sideOffset = 8,
  anchor,
  collisionPadding = 8,
  className,
  positionerClassName,
  initialFocus,
  ref,
  children,
  ...rest
}: PopoverPopupProps) {
  const own = useRef<HTMLDivElement | null>(null);
  const setRef = (node: HTMLDivElement | null) => {
    own.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) (ref as { current: HTMLDivElement | null }).current = node;
  };
  // The popup itself takes focus when it opens (Tab then reaches ✕ and the controls): a
  // keyboard Enter that opened it would otherwise reach ✕ as its keypress when the popup
  // appears at once (reduced motion) and close it again, and a radio group focused before it
  // has registered its items starts its arrows from the wrong one.
  const focusPopup = () => own.current ?? true;
  return (
    <Popover.Portal>
      <Popover.Positioner
        side={side}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={positionerClassName}
        {...(anchor === undefined ? {} : { anchor })}
      >
        <Popover.Popup
          ref={setRef}
          className={[styles.popup, className].filter(Boolean).join(' ')}
          initialFocus={initialFocus ?? focusPopup}
          {...rest}
        >
          {children}
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  );
}

export interface PopoverHeaderProps {
  readonly title: ReactNode;
  /** A control before the title (the colour panel's eyedropper); the title then centres. */
  readonly leading?: ReactNode;
  /** Show ✕ (default true). */
  readonly close?: boolean | undefined;
  readonly titleId?: string | undefined;
  readonly className?: string | undefined;
}

export function PopoverHeader({
  title,
  leading,
  close = true,
  titleId,
  className,
}: PopoverHeaderProps) {
  return (
    <div
      className={[styles.header, className].filter(Boolean).join(' ')}
      data-leading={leading ? '' : undefined}
    >
      {leading}
      <Popover.Title className={styles.title} {...(titleId === undefined ? {} : { id: titleId })}>
        {title}
      </Popover.Title>
      {close ? (
        <Popover.Close className={styles.iconButton} aria-label={m.common_close()}>
          <X aria-hidden="true" />
        </Popover.Close>
      ) : leading ? (
        <span aria-hidden="true" />
      ) : null}
    </div>
  );
}

export function PopoverBody({
  className,
  children,
}: {
  readonly className?: string | undefined;
  readonly children: ReactNode;
}) {
  return (
    <Popover.Description className={[styles.body, className].filter(Boolean).join(' ')}>
      {children}
    </Popover.Description>
  );
}

/** The recipe's class names, for panels that draw their own header (the colour panel). */
export const popoverClasses = styles;
