/**
 * The session's one notice (ADR-0032 §2.5, §2.7; `02-library` L8; `08-feedback` FB9):
 * "Restored 3 documents · Start fresh", "Started fresh · 3 documents kept in Recent · Undo",
 * a restore failure, or "Changes are not kept in this window".
 *
 * Interim, until the toast stack (D0-5) lands: an opaque capsule above the status bar (the
 * compact edition: above its capsule), as the Combine notice is. The text is a polite
 * status region, so it is read once when it appears and focus is never moved to it. A
 * success notice leaves after a while unless the pointer or focus is on it; a failure and
 * the private-window line stay until dismissed. D0-5 replaces this component with a toast;
 * everything it shows comes from `useSessionStore().notice`.
 */
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { m } from '../i18n';
import { IconButton } from '../ui/IconButton';
import styles from './RestoreNotice.module.css';
import { dismissSessionNotice, startFresh, undoStartFresh } from './session';
import { type SessionNotice, useSessionStore } from './session-store';

/** How long a notice with an action stays when nobody is on it (A-24: at least 10 s). */
export const RESTORE_NOTICE_MS = 12_000;

function text(notice: SessionNotice): string {
  switch (notice.kind) {
    case 'restored':
      return notice.title !== undefined && notice.documents.length === 1
        ? m.session_restored_one({ name: notice.title })
        : m.session_restored({ count: notice.documents.length });
    case 'started-fresh':
      return m.session_started_fresh({ count: notice.count });
    case 'failed':
      return m.session_restore_failed({ name: notice.names.join(', ') });
    case 'not-kept':
      return m.session_not_kept();
  }
}

export function RestoreNotice({
  edition = 'full',
  onDownloadCopy,
}: {
  readonly edition?: 'full' | 'compact';
  /** The compact edition's Download a copy, offered for a restored document with changes. */
  readonly onDownloadCopy?: () => void;
}) {
  const notice = useSessionStore((s) => s.notice);
  const [held, setHeld] = useState(false);
  const transient = notice?.kind === 'restored' || notice?.kind === 'started-fresh';

  useEffect(() => {
    if (notice === null || !transient || held) return;
    const timer = window.setTimeout(dismissSessionNotice, RESTORE_NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [notice, transient, held]);

  if (notice === null) return null;
  const warning = notice.kind === 'failed' || notice.kind === 'not-kept';
  return (
    <div
      className={styles.notice}
      data-edition={edition}
      data-kind={notice.kind}
      data-testid="session-notice"
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHeld(false);
      }}
    >
      {warning ? <span className={styles.mark} aria-hidden="true" /> : null}
      <span className={styles.text} role="status">
        {text(notice)}
      </span>
      {notice.kind === 'restored' && notice.offerCopy && onDownloadCopy ? (
        <button type="button" className={styles.action} onClick={onDownloadCopy}>
          {m.compact_download()}
        </button>
      ) : null}
      {notice.kind === 'restored' && !notice.offerCopy ? (
        <button type="button" className={styles.action} onClick={startFresh}>
          {m.session_start_fresh()}
        </button>
      ) : null}
      {notice.kind === 'started-fresh' ? (
        <button type="button" className={styles.action} onClick={undoStartFresh}>
          {m.cmd_undo()}
        </button>
      ) : null}
      <IconButton
        label={m.session_notice_dismiss()}
        icon={<X />}
        className={styles.close}
        tooltipSide="top"
        onClick={dismissSessionNotice}
      />
    </div>
  );
}
