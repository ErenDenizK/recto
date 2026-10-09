/**
 * Lock, per document (ADR-0029 §2.4; redesign spec §7): four reasons, unlocking without a
 * history entry, "Open documents locked" as the default for documents opened from files (and
 * never over a signed or restricted lock), a signed or restricted file locked as it opens
 * (D1-4a), and the snapshot's locks put back on restore.
 */
import type { DocumentId, PermissionFlags, SourceFlags } from '@pdf-editor/document-model';
import { afterEach, describe, expect, it } from 'vitest';

import ownerOnlyUrl from '../../../../test/fixtures/encrypted-owner-only-aes-256.pdf?url';
import signedUrl from '../../../../test/fixtures/signed-approval.pdf?url';
import simpleUrl from '../../../../test/fixtures/simple-text.pdf?url';
import { fixtureFile } from '../../test/store-harness';
import { resetInputPolicyStore, useInputPolicyStore } from './input-policy-store';
import {
  fileLock,
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

describe('the lock a file asks for on open (D1-4a)', () => {
  const free: SourceFlags = {
    encrypted: false,
    repaired: false,
    hasAcroForm: false,
    hasXfa: false,
    hasSignatures: false,
    tagged: false,
    linearized: false,
  };
  const all: PermissionFlags = {
    print: true,
    printHighQuality: true,
    modify: true,
    copy: true,
    annotate: true,
    fillForms: true,
    accessibility: true,
    assemble: true,
  };

  it('is signed for a signature, restricted when changes are forbidden, else none', () => {
    expect(fileLock(free)).toBeUndefined();
    expect(fileLock({ ...free, hasSignatures: true })).toBe('signed');
    // Printing and copying are not changes.
    expect(fileLock({ ...free, permissions: { ...all, print: false, copy: false } })).toBe(
      undefined,
    );
    for (const forbidden of ['modify', 'annotate', 'assemble'] as const) {
      expect(fileLock({ ...free, permissions: { ...all, [forbidden]: false } })).toBe('restricted');
    }
    // A signature says more than a restriction.
    expect(fileLock({ ...free, hasSignatures: true, permissions: { ...all, modify: false } })).toBe(
      'signed',
    );
  });

  it('wins over "Open documents locked" and never replaces a lock already there', () => {
    useInputPolicyStore.setState({ openDocumentsLocked: true });
    useLockStore.getState().lock(c, 'user');
    lockOpened([a, b, c], {
      [a]: { ...free, hasSignatures: true },
      [b]: free,
      [c]: { ...free, hasSignatures: true },
    });
    expect(lockOf(a)).toBe('signed');
    expect(lockOf(b)).toBe('default');
    expect(lockOf(c)).toBe('user');
  });

  it('locks only what the file asks for when the setting is off', () => {
    lockOpened([a, b], { [a]: { ...free, permissions: { ...all, modify: false } }, [b]: free });
    expect(lockOf(a)).toBe('restricted');
    expect(isLocked(b)).toBe(false);
  });

  it('opens a signed file signed, a restricted file restricted, a plain file free', async () => {
    const files = await Promise.all([
      fixtureFile(signedUrl, 'signed-approval.pdf'),
      fixtureFile(ownerOnlyUrl, 'encrypted-owner-only-aes-256.pdf'),
      fixtureFile(simpleUrl, 'simple-text.pdf'),
    ]);
    try {
      const { opened, skipped } = await useWorkspaceStore.getState().openFiles(files);
      expect(skipped).toEqual([]);
      expect(opened.map((o) => lockOf(o.documentId))).toEqual(['signed', 'restricted', undefined]);
    } finally {
      resetWorkspace();
    }
  });
});
