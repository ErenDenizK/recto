/**
 * The sheet store (components/07-sheets.md §1.1 rules 1 and 5, §2.9): which sheet is open, the
 * one-at-a-time rule, the confirmation that may stack over it, and each sheet's draft per
 * document for the session.
 *
 * - **One sheet at a time** (M-29). A sheet opened by `openSheet` replaces the open one. Sheets
 *   whose open state lives elsewhere (the password prompt follows the engine's queue, the
 *   shortcuts overlay the `?` toggle) take part through `claimFront`: the `Sheet` primitive
 *   claims the front when it opens, and an open sheet that loses the front closes itself. A
 *   confirmation never claims it, so it stacks over a task sheet; nothing else stacks.
 * - **Drafts.** What a person typed or chose in a sheet stays, per document and sheet, until
 *   "Reset" or the end of the session, so Esc, ✕ or a swipe never discards input (07 §0). The
 *   store is memory only: drafts never reach the OPFS snapshot (`session/`, 07 §1.1 rule 5).
 * - **Confirmations** (S1, `Confirm.tsx`): one request at a time, answered through a promise.
 *
 * Kept beside the primitive (`ui/sheet/`) rather than in `state/`, so the package owns it.
 */
import { useCallback } from 'react';
import { create } from 'zustand';

/** A sheet opened through the store (07 §2.9: `{ id, docId, preset }`). */
export interface OpenSheet {
  readonly id: string;
  /** The document it acts on; null for sheets of the app (Settings, the shortcuts overlay). */
  readonly docId: string | null;
  /** The control or section the opener names ("Size" for Compress…), read on open. */
  readonly preset: string | null;
}

/** What `confirm()` asks (07 §3). */
export interface ConfirmRequest {
  readonly id: number;
  readonly title: string;
  readonly body: string;
  /** The action's label ("Revert", "Clear"). */
  readonly action: string;
  /** A destructive action: a danger label on the standard fill, never lime (07 §2.4, §27.14). */
  readonly danger: boolean;
  /** The act can be undone (a toast with Undo follows): focus starts on the action, else Cancel. */
  readonly undoable: boolean;
}

interface SheetState {
  readonly open: OpenSheet | null;
  /** The sheet in front: the last non-confirmation sheet that opened, by id. */
  readonly front: string | null;
  readonly confirm: ConfirmRequest | null;
  /** Drafts by `draftKey(docId, sheetId)`. */
  readonly drafts: Readonly<Record<string, unknown>>;
}

export const useSheetStore = create<SheetState>()(() => ({
  open: null,
  front: null,
  confirm: null,
  drafts: {},
}));

/** The key of a draft: the document (or `*` for the app) and the sheet. */
export const draftKey = (docId: string | null, sheetId: string): string =>
  `${docId ?? '*'}\u0000${sheetId}`;

/** Opens `id` for `docId`, replacing any open sheet (its draft stays). */
export function openSheet(
  id: string,
  options: { readonly docId?: string | null; readonly preset?: string | null } = {},
): void {
  useSheetStore.setState({
    open: { id, docId: options.docId ?? null, preset: options.preset ?? null },
  });
}

/** Closes the open sheet, or only `id` when given and open; the draft stays. */
export function closeSheet(id?: string): void {
  const { open } = useSheetStore.getState();
  if (!open || (id !== undefined && open.id !== id)) return;
  useSheetStore.setState({ open: null });
}

/** Whether the store has `id` open (for sheets opened with `openSheet`). */
export function useSheetOpen(id: string): OpenSheet | null {
  return useSheetStore((s) => (s.open?.id === id ? s.open : null));
}

/**
 * A sheet claims the front as it opens (the `Sheet` primitive calls this). The sheet that had
 * it sees `front` change and closes, and a store-opened sheet other than `id` is closed here.
 */
export function claimFront(id: string): void {
  const { open } = useSheetStore.getState();
  useSheetStore.setState({
    front: id,
    ...(open && open.id !== id ? { open: null } : {}),
  });
}

/** Gives up the front if `id` holds it (the sheet closed). */
export function releaseFront(id: string): void {
  if (useSheetStore.getState().front === id) useSheetStore.setState({ front: null });
}

// ---------------------------------------------------------------------------
// Drafts
// ---------------------------------------------------------------------------

/** The draft of `sheetId` for `docId`, or undefined when there is none. */
export function draftOf<T>(docId: string | null, sheetId: string): T | undefined {
  return useSheetStore.getState().drafts[draftKey(docId, sheetId)] as T | undefined;
}

export function setDraft<T>(docId: string | null, sheetId: string, value: T): void {
  const key = draftKey(docId, sheetId);
  useSheetStore.setState((s) => ({ drafts: { ...s.drafts, [key]: value } }));
}

/** "Reset" (07 §1.1 rule 5): back to the sheet's defaults. */
export function resetDraft(docId: string | null, sheetId: string): void {
  const key = draftKey(docId, sheetId);
  useSheetStore.setState((s) => {
    if (!(key in s.drafts)) return s;
    const { [key]: _gone, ...rest } = s.drafts;
    return { drafts: rest };
  });
}

/** Forgets every draft of a document (it was closed for good). */
export function dropDocumentDrafts(docId: string): void {
  const prefix = `${docId}\u0000`;
  useSheetStore.setState((s) => ({
    drafts: Object.fromEntries(Object.entries(s.drafts).filter(([key]) => !key.startsWith(prefix))),
  }));
}

/**
 * A sheet's draft as state: `[value, set, reset, restored]`. `value` is the draft, else
 * `initial`; `set` keeps the next value for the session; `reset` returns to `initial`;
 * `restored` says the value came from an earlier visit (the sheet announces "Your earlier
 * settings are back", 07 §2.5).
 */
export function useSheetDraft<T>(
  sheetId: string,
  docId: string | null,
  initial: T,
): readonly [T, (next: T | ((previous: T) => T)) => void, () => void, boolean] {
  const key = draftKey(docId, sheetId);
  const stored = useSheetStore((s) => s.drafts[key]) as T | undefined;
  const has = useSheetStore((s) => key in s.drafts);
  const value = has ? (stored as T) : initial;
  const set = useCallback(
    (next: T | ((previous: T) => T)) => {
      const drafts = useSheetStore.getState().drafts;
      const previous = key in drafts ? (drafts[key] as T) : initial;
      const resolved = typeof next === 'function' ? (next as (previous: T) => T)(previous) : next;
      useSheetStore.setState((s) => ({ drafts: { ...s.drafts, [key]: resolved } }));
    },
    [key, initial],
  );
  const reset = useCallback(() => resetDraft(docId, sheetId), [docId, sheetId]);
  return [value, set, reset, has] as const;
}

// ---------------------------------------------------------------------------
// Confirmations
// ---------------------------------------------------------------------------

let confirmSerial = 0;
const answers = new Map<number, (yes: boolean) => void>();

/**
 * Asks once before an act that cannot be undone on the device (07 §3). Resolves true for the
 * action and false for Cancel or Esc. A second request while one is showing answers the first
 * with false: one question at a time.
 */
export function confirm(request: {
  readonly title: string;
  readonly body: string;
  readonly action: string;
  readonly danger?: boolean;
  readonly undoable?: boolean;
}): Promise<boolean> {
  const showing = useSheetStore.getState().confirm;
  if (showing) answerConfirm(showing.id, false);
  confirmSerial += 1;
  const id = confirmSerial;
  return new Promise((resolve) => {
    answers.set(id, resolve);
    useSheetStore.setState({
      confirm: {
        id,
        title: request.title,
        body: request.body,
        action: request.action,
        danger: request.danger ?? false,
        undoable: request.undoable ?? false,
      },
    });
  });
}

/** Answers confirmation `id` (the host calls this). */
export function answerConfirm(id: number, yes: boolean): void {
  const resolve = answers.get(id);
  answers.delete(id);
  if (useSheetStore.getState().confirm?.id === id) useSheetStore.setState({ confirm: null });
  resolve?.(yes);
}
