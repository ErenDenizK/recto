/**
 * What the session module tells the UI (ADR-0032 §2.4–§2.7): whether changes are kept on
 * this device at all, whether the browser keeps them persistently, what is kept (for the
 * privacy popover's list), and the one notice after a launch ("Restored 3 documents · Start
 * fresh", a failure, or "Changes are not kept in this window").
 */
import type { DocumentId } from '@pdf-editor/document-model';
import { create } from 'zustand';

/** `pending` until the store was probed; `unavailable` in a private window or without OPFS. */
export type KeepingState = 'pending' | 'available' | 'unavailable';

/** One line of the privacy popover's list. */
export interface KeptItem {
  readonly id: string;
  readonly title: string;
  /** Bytes of the files it needs (shared files counted for each). */
  readonly bytes: number;
  /** Open in a tab now, or closed and kept for Recents. */
  readonly state: 'open' | 'closed';
  /** When it was kept (closed) or last saved (open). */
  readonly at: number;
  readonly changed: boolean;
}

export type SessionNotice =
  | {
      readonly kind: 'restored';
      readonly documents: readonly DocumentId[];
      /** The title when one document was restored. */
      readonly title?: string;
      /** The compact edition: a restored document with changes offers Download a copy. */
      readonly offerCopy?: boolean;
    }
  | { readonly kind: 'started-fresh'; readonly count: number }
  | { readonly kind: 'failed'; readonly names: readonly string[] }
  | { readonly kind: 'not-kept' };

interface SessionState {
  readonly keeping: KeepingState;
  /** `navigator.storage.persisted()` after the first snapshot; null before or unknown. */
  readonly persisted: boolean | null;
  /** A change is not in the snapshot yet (the `beforeunload` rule). */
  readonly unsaved: boolean;
  readonly savedAt: number | null;
  /** The last snapshot write failed (quota, storage cleared under us). */
  readonly writeFailed: boolean;
  readonly items: readonly KeptItem[];
  /** Bytes of every stored snapshot file. */
  readonly totalBytes: number;
  readonly notice: SessionNotice | null;
  /** A restore is running (the launch's, or a reopen from Recents). */
  readonly restoring: boolean;
}

const INITIAL: SessionState = {
  keeping: 'pending',
  persisted: null,
  unsaved: false,
  savedAt: null,
  writeFailed: false,
  items: [],
  totalBytes: 0,
  notice: null,
  restoring: false,
};

export const useSessionStore = create<SessionState>()(() => INITIAL);

export function setSessionNotice(notice: SessionNotice | null): void {
  useSessionStore.setState({ notice });
}

/** Forgets everything (tests). */
export function resetSessionStore(): void {
  useSessionStore.setState(INITIAL);
}
