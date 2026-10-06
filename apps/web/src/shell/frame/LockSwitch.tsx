/**
 * The title menu's Lock switch (`components/01-frame.md` F5 §2, §6; flows.md §2.6; ADR-0029
 * §2.4): the one visible Lock control V2 keeps (spec §11 reorder: D1-4's wider Lock UI builds
 * on this slot). It reads and writes `state/lock-store.ts`, which the change guard reads
 * (`state/guard.ts`, ADR-0030), so a locked document refuses every act at once.
 *
 * - **On** locks with the reason `user` ("You locked it"). The reason line under the switch
 *   says why a document is locked, in words and with the padlock (A-19: never a tint alone):
 *   `user`, `signed`, `restricted` or `default`, `04-context` §19's reasons.
 * - **Off** unlocks a `user` or `default` lock at once. For `signed` and `restricted` it first
 *   shows `04-context` §19's body inline under the switch with "Unlock anyway" (focus moves
 *   there; Keep locked or Esc leaves it locked), once per document per session; after that
 *   the switch unlocks at once.
 * - Unlocking changes the lock store only: no history entry, and Undo never relocks.
 *   Announced "report.pdf locked" / "report.pdf unlocked".
 */
import type { DocumentId } from '@pdf-editor/document-model';
import { Lock } from 'lucide-react';
import { type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';

import { m } from '../../i18n';
import { type LockReason, useLock, useLockStore } from '../../state/lock-store';
import { Button } from '../../ui/Button';
import { Switch } from '../../ui/Switch';
import { announce } from '../announcer';
import styles from './TitleMenu.module.css';

/** Documents whose signed or restricted unlock warning was shown this session (F5 §6). */
const warned = new Set<DocumentId>();

/** Tests: the session starts again. */
export function resetLockWarnings(): void {
  warned.clear();
}

/** The reason line under the switch (`04-context` §19's reasons, in a line). */
export function lockReasonText(reason: LockReason): string {
  switch (reason) {
    case 'user':
      return m.frame_lock_reason_user();
    case 'signed':
      return m.frame_lock_reason_signed();
    case 'restricted':
      return m.frame_lock_reason_restricted();
    case 'default':
      return m.frame_lock_reason_default();
  }
}

/** Whether turning the switch off asks first (a signed or restricted lock not yet warned). */
export function unlockAsksFirst(id: DocumentId, reason: LockReason | undefined): boolean {
  return (reason === 'signed' || reason === 'restricted') && !warned.has(id);
}

export function LockSwitch({
  documentId,
  title,
  readOnly = false,
}: {
  readonly documentId: DocumentId;
  readonly title: string;
  /** No document change allowed here (an empty document still locks). */
  readOnly?: boolean;
}) {
  const reason = useLock(documentId);
  const [asking, setAsking] = useState(false);
  const descriptionId = useId();
  const unlockRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (asking) unlockRef.current?.focus();
  }, [asking]);

  const unlock = () => {
    useLockStore.getState().unlock(documentId);
    setAsking(false);
    announce(m.frame_lock_announce_unlocked({ name: title }));
  };

  /** Esc in the warning keeps the lock; the menu stays open (its own Esc closes it). */
  const keepOnEscape = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    setAsking(false);
  };

  const onCheckedChange = (checked: boolean) => {
    if (checked) {
      useLockStore.getState().lock(documentId, 'user');
      setAsking(false);
      announce(m.frame_lock_announce_locked({ name: title }));
      return;
    }
    if (unlockAsksFirst(documentId, reason)) {
      warned.add(documentId);
      setAsking(true);
      return;
    }
    unlock();
  };

  return (
    <div className={styles.lock} data-testid="lock-switch-row">
      <Switch
        checked={reason !== undefined}
        onCheckedChange={onCheckedChange}
        label={m.frame_lock()}
        description={reason === undefined ? undefined : lockReasonText(reason)}
        disabled={readOnly}
        glyph={<Lock />}
        className={styles.lockSwitch}
      />
      {asking && reason !== undefined ? (
        <div
          className={styles.unlockWarning}
          role="group"
          aria-labelledby={descriptionId}
          data-testid="unlock-warning"
        >
          <p id={descriptionId} className={styles.unlockBody}>
            {reason === 'signed' ? m.frame_unlock_signed_body() : m.frame_unlock_restricted_body()}
          </p>
          <div className={styles.unlockActions}>
            <Button variant="quiet" onClick={() => setAsking(false)} onKeyDown={keepOnEscape}>
              {m.frame_keep_locked()}
            </Button>
            <Button ref={unlockRef} variant="standard" onClick={unlock} onKeyDown={keepOnEscape}>
              {m.frame_unlock_anyway()}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
