/**
 * The session's one notice as a toast (ADR-0032 §2.5, §2.7; `02-library` L8; `08-feedback`
 * FB4, FB9; spec redesign D0-5, D0-7): "Restored 3 documents · Start fresh", "Started fresh ·
 * 3 documents kept in Recent · Undo", a restore failure, or "Changes are not kept in this
 * window". It replaces D0-7's interim `RestoreNotice` capsule.
 *
 * `useSessionStore().notice` stays the one source: this bridge shows whatever notice is set,
 * replaces it in place (one toast, key `session-notice`) when the notice changes, and takes it
 * away when the notice clears. A toast that leaves by its ✕, Esc, its timer or a swipe calls
 * `dismissSessionNotice()`, which may put a partial restore's failure line up next. The actions
 * keep the toast open and let the store decide what follows (Start fresh → Started fresh).
 *
 * Kinds: a restore and Start fresh are action toasts (10 s, A-24); a failure is a failure
 * toast; the private-window line is the honesty warning, until dismissed (FB9).
 */
import { m } from '../i18n';
import { toast } from '../ui/Toast/toast';
import { dismissToast, type DismissReason, useToastStore } from '../ui/Toast/toast-store';
import { dismissSessionNotice, startFresh, undoStartFresh } from './session';
import { type SessionNotice, useSessionStore } from './session-store';

const KEY = 'session-notice';
const TEST_ID = 'session-notice';

/** The notice's sentence. */
export function sessionNoticeText(notice: SessionNotice): string {
  switch (notice.kind) {
    case 'restored':
      return notice.title !== undefined && notice.documents.length === 1
        ? m.session_restored_one({ name: notice.title })
        : m.session_restored({ count: notice.documents.length });
    case 'started-fresh':
      return m.session_started_fresh({ count: notice.count });
    case 'failed':
      return notice.kept === true
        ? m.session_restore_failed_kept({ name: notice.names.join(', ') })
        : m.session_restore_failed({ name: notice.names.join(', ') });
    case 'not-kept':
      return m.session_not_kept();
  }
}

export interface SessionToastOptions {
  /** The compact edition's Download a copy, offered for a restored document with changes. */
  readonly onDownloadCopy?: () => void;
}

function show(notice: SessionNotice, options: SessionToastOptions): void {
  const text = sessionNoticeText(notice);
  // Leaving by itself (✕, Esc, timer, swipe) dismisses the notice; the store's own changes
  // take the toast away with reason `closed`.
  const onDismiss = (reason: DismissReason) => {
    if (reason !== 'closed' && useSessionStore.getState().notice === notice) {
      dismissSessionNotice();
    }
  };
  const common = { key: KEY, testId: TEST_ID, onDismiss };
  switch (notice.kind) {
    case 'restored': {
      const copy = notice.offerCopy === true ? options.onDownloadCopy : undefined;
      toast.action(
        text,
        copy
          ? { label: m.compact_download(), run: copy }
          : { label: m.session_start_fresh(), run: startFresh, keepOpen: true },
        common,
      );
      return;
    }
    case 'started-fresh':
      toast.action(text, { label: m.cmd_undo(), run: undoStartFresh, keepOpen: true }, common);
      return;
    case 'failed':
      toast.failure(text, common);
      return;
    case 'not-kept':
      toast.failure(text, { ...common, tone: 'warning' });
      return;
  }
}

/** Shows the session's notice as a toast while mounted; returns the stop function. */
export function watchSessionNotice(options: SessionToastOptions = {}): () => void {
  const sync = (notice: SessionNotice | null) => {
    if (notice !== null) {
      show(notice, options);
      return;
    }
    const { shown, waiting } = useToastStore.getState();
    const current = [...shown, ...waiting].find((t) => t.key === KEY);
    if (current) dismissToast(current.id, 'closed');
  };
  sync(useSessionStore.getState().notice);
  return useSessionStore.subscribe((state, previous) => {
    if (state.notice !== previous.notice) sync(state.notice);
  });
}
