/**
 * Lock, per document (ADR-0029 §2.4, flows.md §2.6; redesign spec §7). A locked document
 * refuses every act of the change guard (`state/guard.ts`, ADR-0030) and keeps reading, Find,
 * copy, Review, the Pages grid as a view, Extract, Save, Save a copy, Compare, Undo and Redo.
 *
 * Four reasons, each a different promise to the person:
 *
 * - `user`: they locked it (the title-menu switch, ⌘K `lock`; D1-4 builds both).
 * - `signed`: a change would break a digital signature; the document opens locked and
 *   unlocking warns once (D1-4a, `fileLock`).
 * - `restricted`: the file asks apps not to change it ("Restricted by the file · Unlock
 *   anyway"; D1-4a, `fileLock`).
 * - `default`: "Open documents locked" (`input-policy-store`'s `openDocumentsLocked`, owner
 *   question 1, off by default). `lockOpened` applies it to every document opened from a file,
 *   unless the document is already locked for another reason; no other code path reads the
 *   setting (ADR-0029 §2.8).
 *
 * Unlocking changes this store only: no history entry, and Undo never relocks. A lock outlives
 * its document's tab: closing is not a change to a locked document (spec X12), so the entry
 * stays and undoing the close brings the document back locked. Ids are never reused, so a
 * stale entry is harmless; `canChange` answers false for a document the workspace does not
 * hold anyway.
 *
 * Session state, never `localStorage`: the lock of each open document is kept in the session
 * snapshot (`session/`, `DocumentPlace.lock`) and comes back with it on restore, and a kept
 * document reopened from Recents brings its lock along (ADR-0032 §2.4). Markup never does.
 *
 * Read by `ui-store`, `guard` and `lock-check` (which `workspace-store`'s `commit()` asks,
 * D1-3); it imports none of them, so there is no import cycle.
 */
import type { DocumentId, SourceFlags } from '@pdf-editor/document-model';
import { create } from 'zustand';

import { useInputPolicyStore } from './input-policy-store';

/** Why a document is locked (ADR-0029 §2.4). */
export type LockReason = 'user' | 'signed' | 'restricted' | 'default';

export const LOCK_REASONS: readonly LockReason[] = ['user', 'signed', 'restricted', 'default'];

export function isLockReason(value: unknown): value is LockReason {
  return (LOCK_REASONS as readonly unknown[]).includes(value);
}

interface LockState {
  readonly locks: Readonly<Record<DocumentId, LockReason>>;
  /** Locks `id` for `reason` (a reason already there is replaced). */
  lock: (id: DocumentId, reason?: LockReason) => void;
  /** Unlocks `id`; no history entry (04-context §19.6). */
  unlock: (id: DocumentId) => void;
}

export const useLockStore = create<LockState>()((set, get) => ({
  locks: {},
  lock: (id, reason = 'user') => {
    if (get().locks[id] === reason) return;
    set({ locks: { ...get().locks, [id]: reason } });
  },
  unlock: (id) => {
    const { locks } = get();
    if (locks[id] === undefined) return;
    const { [id]: _removed, ...rest } = locks;
    set({ locks: rest });
  },
}));

/** Why `id` is locked, or undefined while it is not. */
export function lockOf(id: DocumentId | null | undefined): LockReason | undefined {
  return id == null ? undefined : useLockStore.getState().locks[id];
}

export function isLocked(id: DocumentId | null | undefined): boolean {
  return lockOf(id) !== undefined;
}

/** `lockOf` for components: re-renders when the document's lock changes. */
export function useLock(id: DocumentId | null | undefined): LockReason | undefined {
  return useLockStore((s) => (id == null ? undefined : s.locks[id]));
}

/**
 * The lock a file asks for as it opens (D1-4a; ADR-0029 §2.4, flows.md §2.6), or undefined:
 *
 * - `signed` when it carries a digital signature (the engine's `hasSignatures`, which an
 *   unsigned /Sig placeholder does not set): any change would break it. This says more than
 *   `restricted`, so a signed file with restrictions opens `signed`.
 * - `restricted` when its permissions (/P as written, whatever password opened it) forbid
 *   changing the content, adding annotations or assembling pages, the three kinds of change
 *   Recto makes. A file that only forbids printing or copying opens free.
 */
export function fileLock(flags: SourceFlags): 'signed' | 'restricted' | undefined {
  if (flags.hasSignatures) return 'signed';
  const allowed = flags.permissions;
  if (allowed !== undefined && (!allowed.modify || !allowed.annotate || !allowed.assemble)) {
    return 'restricted';
  }
  return undefined;
}

/**
 * Documents just opened from a file. Each takes the lock its file asks for (`fileLock` of the
 * flags given for it; `signed` and `restricted` start only on open, ADR-0029 §2.6, spec
 * 0029.2); otherwise "Open documents locked" locks it with `default` (ADR-0029 §2.8). A
 * document already locked keeps its reason. With neither, this does nothing.
 */
export function lockOpened(
  ids: readonly DocumentId[],
  files: Readonly<Partial<Record<DocumentId, SourceFlags>>> = {},
): void {
  const byDefault = useInputPolicyStore.getState().openDocumentsLocked;
  const { locks } = useLockStore.getState();
  const next: Record<DocumentId, LockReason> = { ...locks };
  let changed = false;
  for (const id of ids) {
    if (locks[id] !== undefined) continue;
    const flags = files[id];
    const reason = (flags && fileLock(flags)) ?? (byDefault ? 'default' : undefined);
    if (reason === undefined) continue;
    next[id] = reason;
    changed = true;
  }
  if (changed) useLockStore.setState({ locks: next });
}

/**
 * Puts locks back as a snapshot kept them (`session/restore.ts`): each listed document takes
 * its kept reason, or none. Documents not listed keep theirs.
 */
export function restoreLocks(
  entries: readonly { readonly id: DocumentId; readonly lock?: LockReason | undefined }[],
): void {
  if (entries.length === 0) return;
  const listed = new Set(entries.map((entry) => entry.id));
  const next = Object.fromEntries(
    Object.entries(useLockStore.getState().locks).filter(([id]) => !listed.has(id as DocumentId)),
  ) as Record<DocumentId, LockReason>;
  for (const { id, lock } of entries) if (lock !== undefined) next[id] = lock;
  useLockStore.setState({ locks: next });
}

/** Tests: no document locked. */
export function resetLockStore(): void {
  useLockStore.setState({ locks: {} });
}
