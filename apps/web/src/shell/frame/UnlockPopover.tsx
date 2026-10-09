/**
 * The Unlock popover (D1-4a; `04-context` §19, flows.md §2.5–2.6; ADR-0029 §2.4): when
 * `commit()` or the edit runner refuses a change to a locked document (`state/lock-check.ts`,
 * `onLockRefusal`), this opens where the person acted, says why the document is locked and
 * offers the unlock. Nothing else changes: the refused act stays undone, so the next press acts.
 *
 * - **Where.** At the pointer when a press came last (the place someone tapped, a 0 × 0 anchor
 *   at the pointer-down), else at the focused control (a key came last). A focused element
 *   larger than a control (the stage, a page) anchors at its centre instead. With neither,
 *   below the document's title.
 * - **What.** `04-context` §19's table, the document's name in the title and the reason's glyph
 *   leading it (A-19: glyph and word): `user` "report.pdf is locked · You locked it…", Unlock
 *   first; `signed` and `restricted` the title menu's warning body (`LockSwitch.tsx`), Keep
 *   locked first and Unlock anyway after it; `default` "“Open documents locked” is on",
 *   Unlock first. A refused edit on a page another, locked document shows names that document
 *   and says the page is shared (X11).
 * - **Consistent with the Lock switch.** The same words, the same lock store: Unlock changes
 *   `lock-store` only (no history entry), announces "report.pdf unlocked", and counts as the
 *   once-per-session signed/restricted warning, so the switch then unlocks at once.
 * - **Focus.** The default button takes it; Esc, Keep locked or a press outside closes, and
 *   focus returns to the control that asked (or stays where it was after a pointer press).
 * - `alertdialog` for `signed` and `restricted`, else `dialog`. Popover recipe (M4, 320 px),
 *   M (32 / 44 px) buttons.
 */
import type { DocumentId } from '@pdf-editor/document-model';
import { Popover } from '@base-ui/react/popover';
import { useEffect, useRef, useState } from 'react';

import { m } from '../../i18n';
import { type LockRefusal, onLockRefusal } from '../../state/lock-check';
import type { LockReason } from '../../state/lock-store';
import { useLockStore } from '../../state/lock-store';
import { useWorkspaceStore } from '../../state/workspace-store';
import { Button } from '../../ui/Button';
import { Icon, type IconName } from '../../ui/Icon';
import { PopoverBody, PopoverHeader, PopoverPopup } from '../../ui/Popover';
import { announce } from '../announcer';
import { noteUnlockWarned } from './LockSwitch';
import styles from './UnlockPopover.module.css';

/** Something Base UI can position against: an element, or a point as a 0 × 0 rectangle. */
type Anchor = Element | { getBoundingClientRect: () => DOMRect };

interface Place {
  readonly anchor: Anchor | null;
  /** Where focus goes back when the popover closes (null: it stays where it is). */
  readonly returnTo: HTMLElement | null;
}

interface Asking extends Place {
  readonly serial: number;
  readonly refusal: LockRefusal;
}

interface Press {
  readonly x: number;
  readonly y: number;
  readonly at: number;
}

/** Larger than a control: anchored at its centre rather than below it. */
const CONTROL_MAX = { width: 320, height: 160 } as const;

function pointAnchor(x: number, y: number): Anchor {
  return { getBoundingClientRect: () => DOMRect.fromRect({ x, y, width: 0, height: 0 }) };
}

/** Where the person acted: the last press, or the focused control after a key (see above). */
export function askingPlace(press: Press | null, keyAt: number): Place {
  const active = document.activeElement;
  const focused =
    active instanceof HTMLElement && active !== document.body && active.isConnected ? active : null;
  if (press !== null && press.at >= keyAt) {
    return { anchor: pointAnchor(press.x, press.y), returnTo: focused };
  }
  if (focused !== null) {
    const box = focused.getBoundingClientRect();
    const large = box.width > CONTROL_MAX.width || box.height > CONTROL_MAX.height;
    return {
      anchor: large ? pointAnchor(box.x + box.width / 2, box.y + box.height / 2) : focused,
      returnTo: focused,
    };
  }
  if (press !== null) return { anchor: pointAnchor(press.x, press.y), returnTo: null };
  return { anchor: document.querySelector('[data-testid="document-menu"]'), returnTo: null };
}

const GLYPH: Readonly<Record<LockReason, IconName>> = {
  user: 'lock-simple',
  default: 'lock-simple',
  signed: 'seal-check',
  restricted: 'warning',
};

function titleOf(reason: LockReason, name: string): string {
  switch (reason) {
    case 'user':
      return m.frame_unlock_title_user({ name });
    case 'signed':
      return m.frame_unlock_title_signed({ name });
    case 'restricted':
      return m.frame_unlock_title_restricted({ name });
    case 'default':
      return m.frame_unlock_title_default({ name });
  }
}

function bodyOf(reason: LockReason): string {
  switch (reason) {
    case 'user':
      return m.frame_unlock_user_body();
    case 'signed':
      return m.frame_unlock_signed_body();
    case 'restricted':
      return m.frame_unlock_restricted_body();
    case 'default':
      return m.frame_unlock_default_body();
  }
}

/** Whether unlocking warns (Keep locked first, "Unlock anyway"; `04-context` §19 table). */
const warns = (reason: LockReason) => reason === 'signed' || reason === 'restricted';

export function UnlockPopover() {
  const [asking, setAsking] = useState<Asking | null>(null);
  const [open, setOpen] = useState(false);
  const press = useRef<Press | null>(null);
  const keyAt = useRef(Number.NEGATIVE_INFINITY);
  const serial = useRef(0);

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      press.current = { x: event.clientX, y: event.clientY, at: event.timeStamp };
    };
    const onKey = (event: KeyboardEvent) => {
      keyAt.current = event.timeStamp;
    };
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('keydown', onKey, true);
    const stop = onLockRefusal((refusal) => {
      const place = askingPlace(press.current, keyAt.current);
      serial.current += 1;
      const next: Asking = { ...place, refusal, serial: serial.current };
      // One act may be refused more than once (a drag's steps): the first answer stays.
      setAsking((shown) =>
        shown !== null && shown.refusal.change.documentId === refusal.change.documentId
          ? shown
          : next,
      );
      setOpen(true);
    });
    return () => {
      document.removeEventListener('pointerdown', onPointer, true);
      document.removeEventListener('keydown', onKey, true);
      stop();
    };
  }, []);

  return (
    <Popover.Root
      open={open && asking !== null}
      onOpenChange={(next) => {
        if (!next) setOpen(false);
      }}
      onOpenChangeComplete={(next) => {
        if (!next) setAsking(null);
      }}
    >
      {asking ? (
        <UnlockPopup key={asking.serial} asking={asking} close={() => setOpen(false)} />
      ) : null}
    </Popover.Root>
  );
}

function UnlockPopup({ asking, close }: { readonly asking: Asking; readonly close: () => void }) {
  const primary = useRef<HTMLButtonElement>(null);
  const { change } = asking.refusal;
  const id: DocumentId = change.documentId;
  const reason = change.reason;
  const workspace = useWorkspaceStore.getState().workspace;
  const name = workspace.documents[id]?.title ?? '';
  const shared = change.kind === 'page' && workspace.activeDocument !== id;
  const warning = warns(reason);

  const unlock = () => {
    if (warning) noteUnlockWarned(id);
    useLockStore.getState().unlock(id);
    announce(m.frame_lock_announce_unlocked({ name }));
    close();
  };

  const keep = (
    <Button
      ref={warning ? primary : undefined}
      variant={warning ? 'prominent' : 'quiet'}
      onClick={close}
    >
      {m.frame_keep_locked()}
    </Button>
  );
  const unlockButton = (
    <Button
      ref={warning ? undefined : primary}
      variant={warning ? 'standard' : 'prominent'}
      onClick={unlock}
    >
      {warning ? m.frame_unlock_anyway() : m.frame_unlock()}
    </Button>
  );

  return (
    <PopoverPopup
      anchor={asking.anchor ?? undefined}
      className={styles.popup}
      initialFocus={primary}
      finalFocus={asking.returnTo?.isConnected ? { current: asking.returnTo } : false}
      role={warning ? 'alertdialog' : 'dialog'}
      data-testid="unlock-popover"
      data-reason={reason}
    >
      <PopoverHeader
        close={false}
        title={
          <span className={styles.title}>
            <Icon name={GLYPH[reason]} className={styles.glyph} aria-hidden="true" />
            <span className={styles.titleText}>{titleOf(reason, name)}</span>
          </span>
        }
      />
      <PopoverBody>
        {shared ? `${m.frame_unlock_shared({ name })} ` : null}
        {bodyOf(reason)}
      </PopoverBody>
      {/* The default (focused, prominent) ends the row, as in the Replace question: Keep locked
          where unlocking warns, Unlock otherwise (`04-context` §19's table). */}
      <div className={styles.actions}>
        {warning ? (
          <>
            {unlockButton}
            {keep}
          </>
        ) : (
          <>
            {keep}
            {unlockButton}
          </>
        )}
      </div>
    </PopoverPopup>
  );
}
