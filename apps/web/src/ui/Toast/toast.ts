/**
 * The toast API (`08-feedback` FB4 §5, §6, §9; FB10; ADR-0032 §2 "every removal and failure
 * shows a toast"): `toast.info | action | undo | success | failure | system | progress`.
 *
 * Each call pushes onto `toast-store.ts` and **says the toast once**, through the one
 * announcer, in the same task as the change (FB4 §6, A-14); the region itself is silent.
 * An Undo toast adds "Undo with Control Z"; a toast with another action adds "F6 reaches the
 * notification" the first time in a session. Failures are polite except the blocking three
 * (FB8 §6), which the caller marks `assertive`.
 *
 * Undo toasts (FB4 §4, §6) belong to the history step that was present when they were shown:
 * - their Undo undoes that step only while it is still the newest; Mod+Z (or any undo) that
 *   takes the step away takes the toast with it;
 * - when newer steps come after it the toast goes stale: with a history opener registered
 *   (`setHistoryOpener`, the History scrubber of D0-6) its action becomes "History", else it
 *   leaves, so one Undo never undoes something other than what the toast says.
 *
 * A toast about a document leaves when the document closes, unless `keepOnClose` (Reopen).
 */
import type { DocumentId, History, HistoryEntry } from '@pdf-editor/document-model';

import { currentPlatform } from '../../commands/shortcuts';
import { m } from '../../i18n';
import { announce, type Politeness } from '../../shell/announcer';
import { useWorkspaceStore } from '../../state/workspace-store';
import {
  type DismissReason,
  dismissToast,
  dismissToastsWhere,
  pushToast,
  type ToastAction,
  type ToastInput,
  updateToast,
  useToastStore,
} from './toast-store';

export interface ToastOptions {
  readonly detail?: string | undefined;
  readonly key?: string | undefined;
  readonly documentId?: DocumentId | undefined;
  readonly keepOnClose?: boolean | undefined;
  readonly action?: ToastAction | undefined;
  readonly secondary?: ToastAction | undefined;
  readonly tone?: 'danger' | 'warning' | undefined;
  readonly testId?: string | undefined;
  readonly onDismiss?: ((reason: DismissReason) => void) | undefined;
  /**
   * What is said instead of the text (and detail), whole (no Undo or F6 hint is added);
   * `false` says nothing, when the change was announced already.
   */
  readonly spoken?: string | false | undefined;
  readonly politeness?: Politeness | undefined;
}

let f6HintSaid = false;

function undoShortcut(): string {
  return currentPlatform === 'mac' ? m.undo_hint_mac() : m.undo_hint_other();
}

function speak(input: ToastInput, options: ToastOptions, undo: boolean): void {
  if (options.spoken === false) return;
  const parts = [options.spoken ?? [input.text, input.detail].filter(Boolean).join('. ')];
  // An owner's own words (`spoken`) already say what they need to.
  if (undo && options.spoken === undefined) {
    parts.push(m.toast_undo_hint({ shortcut: undoShortcut() }));
  } else if (input.action !== undefined && input.kind !== 'progress' && !f6HintSaid) {
    f6HintSaid = true;
    parts.push(m.toast_f6_hint());
  }
  announce(parts.join('. '), { politeness: options.politeness ?? 'polite' });
}

function show(kind: ToastInput['kind'], text: string, options: ToastOptions, undo = false) {
  const input: ToastInput = {
    kind,
    text,
    detail: options.detail,
    key: options.key,
    documentId: options.documentId,
    keepOnClose: options.keepOnClose,
    action: options.action,
    secondary: options.secondary,
    tone: options.tone,
    testId: options.testId,
    onDismiss: options.onDismiss,
  };
  watchDocuments();
  const id = pushToast(input);
  speak(input, options, undo);
  return id;
}

/** Closed documents take their toasts with them (FB4 §6). */
let documentsWatched = false;
function watchDocuments(): void {
  if (documentsWatched) return;
  documentsWatched = true;
  useWorkspaceStore.subscribe((state, previous) => {
    if (state.workspace.documents === previous.workspace.documents) return;
    const { documents } = state.workspace;
    dismissToastsWhere(
      (t) => t.documentId !== undefined && !t.keepOnClose && documents[t.documentId] === undefined,
      'closed',
    );
  });
}

// ---------------------------------------------------------------------------
// Undo toasts
// ---------------------------------------------------------------------------

/** Opens the History scrubber at an entry (D0-6); none until it exists. */
let historyOpener: ((entry: HistoryEntry) => void) | undefined;

/** The History scrubber registers how a stale Undo toast opens it (FB4 §4, FB7). */
export function setHistoryOpener(open: ((entry: HistoryEntry) => void) | undefined): void {
  historyOpener = open;
}

const history = () => useWorkspaceStore.getState().history;

/**
 * A history step by position and stamp, not object identity: activating a tab replaces the
 * present entry's workspace without adding a step (`replacePresent`), so the same step comes
 * back as a new object and an Undo toast must not take that for its step going away.
 */
interface StepMark {
  readonly index: number;
  readonly at: number;
  readonly label: string;
}

function markOf(h: History): StepMark {
  return { index: h.past.length, at: h.present.at, label: h.present.label };
}

function isStep(entry: HistoryEntry | undefined, mark: StepMark): entry is HistoryEntry {
  return entry?.at === mark.at && entry.label === mark.label;
}

/** The step's entry where it is now: present, in the past (newer steps came), or gone. */
function findStep(h: History, mark: StepMark): 'present' | HistoryEntry | undefined {
  if (h.past.length === mark.index && isStep(h.present, mark)) return 'present';
  const past = h.past[mark.index];
  return isStep(past, mark) ? past : undefined;
}

/**
 * An Undo toast for the step just committed (the present history entry): "Deleted page 7 ·
 * Undo". `undone` is called after its Undo ran (an announcement of what was undone is made
 * here, as Mod+Z makes one).
 */
function undoToast(text: string, options: ToastOptions = {}): string {
  const mark = markOf(history());
  let unsubscribe: (() => void) | undefined;
  const runUndo = () => {
    if (findStep(history(), mark) !== 'present') return;
    const label = useWorkspaceStore.getState().undo();
    if (label) announce(m.announce_undid({ label }));
  };
  const id = show(
    'action',
    text,
    {
      ...options,
      action: { label: m.cmd_undo(), run: runUndo },
      onDismiss: (reason) => {
        unsubscribe?.();
        options.onDismiss?.(reason);
      },
    },
    true,
  );
  unsubscribe = useWorkspaceStore.subscribe((state, previous) => {
    if (state.history === previous.history) return;
    const where = findStep(state.history, mark);
    if (where === 'present') return;
    unsubscribe?.();
    unsubscribe = undefined;
    const open = historyOpener;
    if (where !== undefined && open !== undefined) {
      // Newer changes came after it: the toast offers History instead (FB4 §4).
      updateToast(id, {
        text: m.toast_stale_undo(),
        action: { label: m.toast_history(), run: () => open(where) },
      });
    } else {
      dismissToast(id, 'closed');
    }
  });
  return id;
}

// ---------------------------------------------------------------------------
// The API
// ---------------------------------------------------------------------------

export const toast = {
  /** A result with nothing to do: 4 s and up (08.Q1). */
  info: (text: string, options: ToastOptions = {}) => show('info', text, options),
  /** A result with one action ("Show", "Reopen"), 10 s. */
  action: (text: string, action: ToastAction, options: ToastOptions = {}) =>
    show('action', text, { ...options, action }),
  /** A removal or change with Undo bound to its history step, 10 s. */
  undo: undoToast,
  /** Done: 4 s, 10 s with an action. */
  success: (text: string, options: ToastOptions = {}) => show('success', text, options),
  /** Could not: stays until dismissed, with a glyph (danger by default). */
  failure: (text: string, options: ToastOptions = {}) =>
    show('failure', text, { tone: 'danger', ...options }),
  /** The app itself (update ready): stays until acted on; no ✕, `secondary` is the dismiss. */
  system: (text: string, options: ToastOptions = {}) => show('system', text, options),
  dismiss: (id: string) => dismissToast(id, 'closed'),
};

/** Whether a toast with `key` is on screen or waiting (tests, owners). */
export function hasToast(key: string): boolean {
  const { shown, waiting } = useToastStore.getState();
  return [...shown, ...waiting].some((t) => t.key === key);
}

/** Starts the session's F6 hint afresh (tests). */
export function resetToastHints(): void {
  f6HintSaid = false;
}
