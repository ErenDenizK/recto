/**
 * Lock, per document (ADR-0029 §2.4; redesign spec §7): four reasons, unlocking without a
 * history entry, "Open documents locked" as the default for documents opened from files (and
 * never over a signed or restricted lock), and the snapshot's locks put back on restore.
 */
import type { DocumentId } from '@pdf-editor/document-model';
import { afterEach, describe, expect, it } from 'vitest';

import simpleUrl from '../../../../test/fixtures/simple-text.pdf?url';
import { fixtureFile } from '../../test/store-harness';
import { resetInputPolicyStore, useInputPolicyStore } from './input-policy-store';
import {
  isLocked,
  isLockReason,
  LOCK_REASONS,
  lockOf,
  lockOpened,
  resetLockStore,
  restoreLocks,
  useLockStore,
} from './lock-store';
import { resetWorkspace, useWorkspaceStore } from './workspace-store';

const a = 'doc-a' as DocumentId;
const b = 'doc-b' as DocumentId;
const c = 'doc-c' as DocumentId;

afterEach(() => {
  resetLockStore();
  resetInputPolicyStore();
});

describe('lock-store', () => {
  it('starts with nothing locked and knows its four reasons', () => {
    expect(useLockStore.getState().locks).toEqual({});
    expect(lockOf(a)).toBeUndefined();
    expect(isLocked(a)).toBe(false);
    expect(isLocked(null)).toBe(false);
    expect(isLocked(undefined)).toBe(false);
    expect(LOCK_REASONS).toEqual(['user', 'signed', 'restricted', 'default']);
    for (const reason of LOCK_REASONS) expect(isLockReason(reason)).toBe(true);
    for (const value of ['edit', 'read', '', null, undefined, 1]) {
      expect(isLockReason(value)).toBe(false);
    }
  });

  it('locks for a reason (the person, by default) and unlocks one document', () => {
    const { lock, unlock } = useLockStore.getState();
    lock(a);
    lock(b, 'signed');
    expect(lockOf(a)).toBe('user');
    expect(lockOf(b)).toBe('signed');
    expect(isLocked(c)).toBe(false);
    unlock(a);
    expect(isLocked(a)).toBe(false);
    expect(lockOf(b)).toBe('signed');
  });

  it('changes nothing (no new state) when the lock is already so', () => {
    const { lock, unlock } = useLockStore.getState();
    lock(a, 'restricted');
    const before = useLockStore.getState().locks;
    lock(a, 'restricted');
    unlock(b);
    expect(useLockStore.getState().locks).toBe(before);
  });

  it('applies "Open documents locked" only when it is on (owner question 1: off)', () => {
    lockOpened([a]);
    expect(isLocked(a)).toBe(false);
    useInputPolicyStore.setState({ openDocumentsLocked: true });
    lockOpened([a, b]);
    expect(lockOf(a)).toBe('default');
    expect(lockOf(b)).toBe('default');
  });

  it('keeps a signed or restricted lock when the default applies (ADR-0029 §2.8)', () => {
    useInputPolicyStore.setState({ openDocumentsLocked: true });
    useLockStore.getState().lock(a, 'signed');
    useLockStore.getState().lock(b, 'restricted');
    lockOpened([a, b, c]);
    expect(lockOf(a)).toBe('signed');
    expect(lockOf(b)).toBe('restricted');
    expect(lockOf(c)).toBe('default');
  });

  it('puts the snapshot locks back: a kept lock returns, an unlocked document stays so', () => {
    useLockStore.getState().lock(b, 'user');
    useLockStore.getState().lock(c, 'user');
    restoreLocks([{ id: a, lock: 'signed' }, { id: b }]);
    expect(lockOf(a)).toBe('signed');
    expect(isLocked(b)).toBe(false);
    // Documents the snapshot does not list keep theirs.
    expect(lockOf(c)).toBe('user');
  });

  it('locks documents opened from files when "Open documents locked" is on', async () => {
    const file = await fixtureFile(simpleUrl, 'simple.pdf');
    try {
      const first = await useWorkspaceStore.getState().openFiles([file]);
      const unlocked = first.opened[0]?.documentId;
      expect(unlocked).toBeDefined();
      expect(isLocked(unlocked)).toBe(false);
      useInputPolicyStore.setState({ openDocumentsLocked: true });
      const second = await useWorkspaceStore.getState().openFiles([file]);
      expect(lockOf(second.opened[0]?.documentId)).toBe('default');
      // Only documents opened later: the first stays as it was.
      expect(isLocked(unlocked)).toBe(false);
    } finally {
      resetWorkspace();
    }
  });
});
