/**
 * The "Update ready · Reload · Later" system toast (`08-feedback` FB4 §2, §5; FB4 issue 9),
 * split from `register.ts` so the first paint does not carry it: the toast API reaches the
 * workspace store and the document model, which only the editions need (bundle budgets,
 * PLAN.md §2.3 V1-P1; decisions PRC-11). `register.ts` loads this module when a new worker
 * waits.
 */
import { m } from '../i18n';
import { useSessionStore } from '../session/session-store';
import { toast } from '../ui/Toast/toast';

/** The update toast's key: shown once however often the worker reports. */
const UPDATE_TOAST_KEY = 'pwa-update';

/**
 * Shows the toast: it stays until Reload or Later, no ✕; Later is the dismiss. With session
 * snapshots on (ADR-0032 §2.4) it says documents reopen where they were, else that reloading
 * closes them.
 */
export function showUpdateToast(reload: () => void, later: () => void): void {
  const kept = useSessionStore.getState().keeping === 'available';
  toast.system(m.update_ready(), {
    key: UPDATE_TOAST_KEY,
    detail: kept ? m.update_kept() : m.update_not_kept(),
    testId: 'update-toast',
    action: { label: m.update_reload(), run: reload },
    secondary: { label: m.update_later(), run: later },
  });
}
