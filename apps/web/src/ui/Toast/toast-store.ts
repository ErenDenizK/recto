/**
 * The toast store (`08-feedback` FB4 §2, §4, §6, §9; spec redesign X14, 08.5, 08.Q1, 08.Q3):
 * our own queue, so the region (`ToastRegion.tsx`) is a plain view of it and Base UI's toast
 * manager is not used.
 *
 * - **Three at most.** `shown` holds up to `TOAST_LIMIT` toasts, oldest first (the region puts
 *   the newest nearest the dock band, 08.Q3). A fourth evicts the oldest *timed* toast early;
 *   failures, system and progress toasts never leave early. When all three are persistent the
 *   newcomer waits in `waiting`, and the top toast says "+N waiting" (08.5).
 * - **Timers.** Info 4 s, plus 1 s per 30 characters beyond 60, at most 8 s (08.Q1); action
 *   10 s; success 4 s, or 10 s with an action; failure, system and progress until dismissed or
 *   done. A waiting toast's timer starts when it is shown.
 * - **Pauses.** Hover, focus within, a pointer down on a toast, a hidden tab and an open modal
 *   each pause every timer (A-24). Timers freeze and resume with what was left, never from
 *   zero.
 * - **Keys.** A toast with the `key` of one already shown or waiting replaces it in place and
 *   restarts its timer.
 *
 * The store knows nothing about history, documents or announcements; `toast.ts` binds those.
 */
import type { DocumentId } from '@pdf-editor/document-model';
import { create } from 'zustand';

/** FB4 §2: info, action, success, failure, system (update ready) and progress. */
export type ToastKind = 'info' | 'action' | 'success' | 'failure' | 'system' | 'progress';

export interface ToastAction {
  readonly label: string;
  /** Runs the action; the toast leaves afterwards unless `keepOpen`. */
  readonly run: () => void;
  readonly keepOpen?: boolean;
}

/** Why a toast left: its ✕ or Esc, its action, its timer, a newer toast, or its owner. */
export type DismissReason = 'dismissed' | 'action' | 'timeout' | 'evicted' | 'closed';

export interface ToastInput {
  readonly kind: ToastKind;
  /** The one sentence; also the group's name. */
  readonly text: string;
  /** A second, quieter line (the update toast's "Your documents reopen where they were."). */
  readonly detail?: string | undefined;
  /** Replaces a shown or waiting toast with the same key. */
  readonly key?: string | undefined;
  /** The document it is about: it leaves when that document closes (unless `keepOnClose`). */
  readonly documentId?: DocumentId | undefined;
  readonly keepOnClose?: boolean | undefined;
  /** The primary action ("Undo", "Reload", "Start fresh"). */
  readonly action?: ToastAction | undefined;
  /** A second action at most ("Later"); for a system toast it is the dismiss. */
  readonly secondary?: ToastAction | undefined;
  /** A failure's glyph: `danger` (could not) or `warning` (recoverable, honesty). */
  readonly tone?: 'danger' | 'warning' | undefined;
  /** A progress toast's job (`jobs/job-store.ts`). */
  readonly jobId?: string | undefined;
  /** `data-testid` for the toast (e2e). */
  readonly testId?: string | undefined;
  /**
   * The id of the control the toast reports on (Save for its receipt): the toast comes in
   * from that control's side (`ToastRegion.tsx`, motion-2026-10 frame.md §5).
   */
  readonly origin?: string | undefined;
  /** Called once when the toast leaves, with why. */
  readonly onDismiss?: ((reason: DismissReason) => void) | undefined;
}

export interface Toast extends ToastInput {
  readonly id: string;
  /** Milliseconds it stays on screen, or null for a persistent toast. */
  readonly duration: number | null;
  /** Milliseconds left on its timer. */
  readonly remaining: number | null;
  /** When the timer last started running (`Date.now()`), or null while paused or waiting. */
  readonly runningSince: number | null;
}

/** What pauses the timers (FB4 §4 "Paused"). */
export type PauseReason = 'hover' | 'focus' | 'pointer' | 'hidden' | 'modal';

interface ToastState {
  /** On screen, oldest first. */
  readonly shown: readonly Toast[];
  /** Behind three persistent toasts, oldest first. */
  readonly waiting: readonly Toast[];
  readonly paused: ReadonlySet<PauseReason>;
}

/** FB4 §2: three at most. */
export const TOAST_LIMIT = 3;
export const INFO_MS = 4_000;
export const INFO_MAX_MS = 8_000;
export const ACTION_MS = 10_000;

const EMPTY: ToastState = { shown: [], waiting: [], paused: new Set() };

export const useToastStore = create<ToastState>()(() => EMPTY);

const get = () => useToastStore.getState();

/**
 * How long a toast of `kind` with `text` stays (FB4 §2; 08.Q1), or null until dismissed. A
 * toast with an action stays at least 10 s whatever its kind (A-24), so an info toast given one
 * through its options waits as long as an action toast.
 */
export function toastDuration(kind: ToastKind, text: string, hasAction: boolean): number | null {
  switch (kind) {
    case 'info': {
      if (hasAction) return ACTION_MS;
      const extra = Math.max(0, Math.ceil((text.length - 60) / 30)) * 1_000;
      return Math.min(INFO_MAX_MS, INFO_MS + extra);
    }
    case 'action':
      return ACTION_MS;
    case 'success':
      return hasAction ? ACTION_MS : INFO_MS;
    case 'failure':
    case 'system':
    case 'progress':
      return null;
  }
}

let serial = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

/** The toast, its timer running from now unless the stack is paused. */
function running(toast: Toast, paused: boolean): Toast {
  if (toast.remaining === null) return toast;
  return { ...toast, runningSince: paused ? null : Date.now() };
}

/** The toast with its timer stopped and what was left written down. */
function frozen(toast: Toast, now: number): Toast {
  if (toast.remaining === null || toast.runningSince === null) return toast;
  return {
    ...toast,
    remaining: Math.max(0, toast.remaining - (now - toast.runningSince)),
    runningSince: null,
  };
}

/** One timeout for the soonest expiry of a shown toast; none while paused or persistent. */
function schedule(): void {
  if (timer !== undefined) clearTimeout(timer);
  timer = undefined;
  const now = Date.now();
  let soonest = Number.POSITIVE_INFINITY;
  for (const toast of get().shown) {
    if (toast.remaining === null || toast.runningSince === null) continue;
    soonest = Math.min(soonest, toast.runningSince + toast.remaining - now);
  }
  if (soonest === Number.POSITIVE_INFINITY) return;
  timer = setTimeout(expire, Math.max(0, soonest));
}

function expire(): void {
  timer = undefined;
  const now = Date.now();
  const due = get().shown.filter(
    (t) => t.remaining !== null && t.runningSince !== null && t.runningSince + t.remaining <= now,
  );
  for (const toast of due) dismissToast(toast.id, 'timeout');
  schedule();
}

/** Moves waiting toasts up while there is room. */
function promote(shown: Toast[], waiting: Toast[], paused: boolean): void {
  while (shown.length < TOAST_LIMIT && waiting.length > 0) {
    const next = waiting.shift() as Toast;
    shown.push(running(next, paused));
  }
}

/** Shows a toast (or queues it); returns its id. */
export function pushToast(input: ToastInput): string {
  const { shown: oldShown, waiting: oldWaiting, paused } = get();
  const isPaused = paused.size > 0;
  const duration = toastDuration(input.kind, input.text, input.action !== undefined);
  const make = (id: string): Toast => ({
    ...input,
    id,
    duration,
    remaining: duration,
    runningSince: null,
  });
  const shown = [...oldShown];
  const waiting = [...oldWaiting];
  const evicted: Toast[] = [];
  const replacedShown = input.key === undefined ? -1 : shown.findIndex((t) => t.key === input.key);
  const replacedWaiting =
    input.key === undefined ? -1 : waiting.findIndex((t) => t.key === input.key);
  let id: string;
  if (replacedShown >= 0) {
    // Same key: replaced in place (the region keeps its element), timer restarted.
    id = (shown[replacedShown] as Toast).id;
    shown[replacedShown] = running(make(id), isPaused);
  } else if (replacedWaiting >= 0) {
    id = (waiting[replacedWaiting] as Toast).id;
    waiting[replacedWaiting] = make(id);
  } else {
    serial += 1;
    id = `toast-${serial}`;
    const toast = make(id);
    if (shown.length >= TOAST_LIMIT) {
      const oldestTimed = shown.findIndex((t) => t.duration !== null);
      if (oldestTimed >= 0) evicted.push(...shown.splice(oldestTimed, 1));
    }
    if (shown.length < TOAST_LIMIT) shown.push(running(toast, isPaused));
    else waiting.push(toast);
  }
  useToastStore.setState({ shown, waiting });
  for (const toast of evicted) toast.onDismiss?.('evicted');
  schedule();
  return id;
}

/** Changes a shown or waiting toast in place; its timer keeps running. */
export function updateToast(id: string, patch: Partial<ToastInput>): void {
  const { shown, waiting } = get();
  const change = (t: Toast) => (t.id === id ? { ...t, ...patch } : t);
  useToastStore.setState({ shown: shown.map(change), waiting: waiting.map(change) });
}

/** Removes a toast; the next waiting one moves up. Nothing happens for an unknown id. */
export function dismissToast(id: string, reason: DismissReason = 'dismissed'): void {
  const { shown: oldShown, waiting: oldWaiting, paused } = get();
  const toast = oldShown.find((t) => t.id === id) ?? oldWaiting.find((t) => t.id === id);
  if (toast === undefined) return;
  const shown = oldShown.filter((t) => t.id !== id);
  const waiting = oldWaiting.filter((t) => t.id !== id);
  promote(shown, waiting, paused.size > 0);
  useToastStore.setState({ shown, waiting });
  toast.onDismiss?.(reason);
  schedule();
}

/** Dismisses every toast `predicate` picks (a closed document's toasts). */
export function dismissToastsWhere(predicate: (toast: Toast) => boolean, reason: DismissReason) {
  const { shown, waiting } = get();
  for (const toast of [...shown, ...waiting]) if (predicate(toast)) dismissToast(toast.id, reason);
}

/** Turns one pause reason on or off; timers freeze while any is on. */
export function setToastPause(reason: PauseReason, on: boolean): void {
  const { paused, shown } = get();
  if (paused.has(reason) === on) return;
  const next = new Set(paused);
  if (on) next.add(reason);
  else next.delete(reason);
  const now = Date.now();
  const wasPaused = paused.size > 0;
  const isPaused = next.size > 0;
  let changed = shown;
  if (!wasPaused && isPaused) changed = shown.map((t) => frozen(t, now));
  else if (wasPaused && !isPaused) changed = shown.map((t) => running(t, false));
  useToastStore.setState({ paused: next, shown: changed });
  schedule();
}

/** Milliseconds left on a toast's timer now, or null when it is persistent (tests, region). */
export function timeLeft(toast: Toast, now = Date.now()): number | null {
  if (toast.remaining === null) return null;
  return toast.runningSince === null
    ? toast.remaining
    : Math.max(0, toast.remaining - (now - toast.runningSince));
}

/** Forgets every toast and pause (tests). */
export function resetToasts(): void {
  if (timer !== undefined) clearTimeout(timer);
  timer = undefined;
  useToastStore.setState(EMPTY);
}
