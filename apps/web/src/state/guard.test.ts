/**
 * The change guard (ADR-0030; flows.md §2.5; redesign spec §10.1): every act against every
 * lock reason, the Markup rule for `freehand` and `place` (and the doors that open Markup or
 * name a point), unknown documents and acts failing closed, the reasons a dimmed item shows,
 * and rename refused at each entry point while locked (X31).
 */
import type { DocumentId, VirtualDocument } from '@pdf-editor/document-model';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { setLocale } from '../i18n';
import { closeTitleMenu, useFrameStore } from '../shell/frame/frame-store';
import { startRename } from '../stage/section-operations';
import {
  type Act,
  ACTS,
  canChange,
  changeRefusal,
  isAct,
  refusalFor,
  refusalReason,
  useCanChange,
} from './guard';
import { LOCK_REASONS, resetLockStore, useLockStore } from './lock-store';
import { useUiStore } from './ui-store';
import { useWorkspaceStore } from './workspace-store';

const a = 'doc-a' as DocumentId;
const b = 'doc-b' as DocumentId;
const missing = 'doc-missing' as DocumentId;

const empty = useWorkspaceStore.getState().workspace;

function fakeDocument(id: DocumentId): VirtualDocument {
  return { id, title: id, pages: [], outline: [] } as unknown as VirtualDocument;
}

beforeEach(() => {
  useWorkspaceStore.setState({
    workspace: {
      ...empty,
      documents: { [a]: fakeDocument(a), [b]: fakeDocument(b) },
      documentOrder: [a, b],
      activeDocument: a,
    },
  });
});

afterEach(() => {
  useWorkspaceStore.setState({ workspace: empty });
  useUiStore.setState({ docUi: {}, renaming: null });
  resetLockStore();
});

/** Acts allowed anywhere on an unlocked document (flows §2.5). */
const ALWAYS: readonly Act[] = ['targeted', 'text', 'pages', 'document'];

describe('refusalFor (the rule)', () => {
  const open = { known: true, markup: false, lock: undefined };

  it('knows the six acts and nothing else', () => {
    expect(ACTS).toEqual(['targeted', 'freehand', 'place', 'text', 'pages', 'document']);
    for (const value of ['edit', 'read', '', null, undefined, 'Pages']) {
      expect(isAct(value)).toBe(false);
    }
  });

  it('allows targeted, text, pages and document acts without Markup', () => {
    for (const actName of ALWAYS) expect(refusalFor(open, actName)).toBeUndefined();
  });

  it('allows freehand only in Markup, or from a site that opens it', () => {
    expect(refusalFor(open, 'freehand')).toEqual({ kind: 'markup', act: 'freehand' });
    expect(refusalFor({ ...open, markup: true }, 'freehand')).toBeUndefined();
    expect(refusalFor(open, 'freehand', { opensMarkup: true })).toBeUndefined();
    // A named point does not make a stroke.
    expect(refusalFor(open, 'freehand', { atPoint: true })).toEqual({
      kind: 'markup',
      act: 'freehand',
    });
  });

  it('allows place in Markup, with a point the person named, or from a Markup door (X34)', () => {
    expect(refusalFor(open, 'place')).toEqual({ kind: 'markup', act: 'place' });
    expect(refusalFor({ ...open, markup: true }, 'place')).toBeUndefined();
    expect(refusalFor(open, 'place', { atPoint: true })).toBeUndefined();
    expect(refusalFor(open, 'place', { opensMarkup: true })).toBeUndefined();
  });

  it('refuses every act on a locked document, for each of the four reasons', () => {
    for (const reason of LOCK_REASONS) {
      for (const actName of ACTS) {
        for (const markup of [false, true]) {
          const facts = { known: true, markup, lock: reason };
          expect(refusalFor(facts, actName)).toEqual({ kind: 'locked', reason });
          expect(refusalFor(facts, actName, { opensMarkup: true, atPoint: true })).toEqual({
            kind: 'locked',
            reason,
          });
        }
      }
    }
  });

  it('fails closed for an unknown document or act', () => {
    for (const actName of ACTS) {
      expect(refusalFor({ known: false, markup: true, lock: undefined }, actName)).toEqual({
        kind: 'unknown',
      });
    }
    expect(refusalFor({ ...open, markup: true }, 'paint' as Act)).toEqual({ kind: 'unknown' });
  });
});

describe('canChange (the stores)', () => {
  it('reads the workspace, the Markup flag and the lock', () => {
    for (const actName of ALWAYS) expect(canChange(a, actName)).toBe(true);
    expect(canChange(a, 'freehand')).toBe(false);
    expect(canChange(a, 'place')).toBe(false);
    useUiStore.getState().openMarkup(a);
    expect(canChange(a, 'freehand')).toBe(true);
    expect(canChange(a, 'place')).toBe(true);
    // Markup belongs to the document: b is still viewing.
    expect(canChange(b, 'freehand')).toBe(false);
    useLockStore.getState().lock(a);
    for (const actName of ACTS) expect(canChange(a, actName)).toBe(false);
    expect(changeRefusal(a, 'pages')).toEqual({ kind: 'locked', reason: 'user' });
    // The other document is not locked with it.
    expect(canChange(b, 'pages')).toBe(true);
    useLockStore.getState().unlock(a);
    expect(canChange(a, 'freehand')).toBe(true);
  });

  it('fails closed for no document and for one the workspace does not hold', () => {
    for (const actName of ACTS) {
      expect(canChange(null, actName)).toBe(false);
      expect(canChange(undefined, actName)).toBe(false);
      expect(canChange(missing, actName)).toBe(false);
    }
    expect(changeRefusal(missing, 'document')).toEqual({ kind: 'unknown' });
  });

  it('refuses a closed document even though its lock is kept (X12)', () => {
    useLockStore.getState().lock(b, 'signed');
    useWorkspaceStore.setState({
      workspace: {
        ...empty,
        documents: { [a]: fakeDocument(a) },
        documentOrder: [a],
        activeDocument: a,
      },
    });
    expect(canChange(b, 'document')).toBe(false);
    expect(useLockStore.getState().locks[b]).toBe('signed');
  });

  it('useCanChange follows the lock and Markup', () => {
    const { result } = renderHook(() => useCanChange(a, 'freehand'));
    expect(result.current).toBe(false);
    act(() => {
      useUiStore.getState().openMarkup(a);
    });
    expect(result.current).toBe(true);
    act(() => {
      useLockStore.getState().lock(a, 'default');
    });
    expect(result.current).toBe(false);
    act(() => {
      useLockStore.getState().unlock(a);
    });
    expect(result.current).toBe(true);
  });
});

describe('refusalReason (dimmed items carry their reason)', () => {
  afterEach(() => {
    setLocale('en');
  });

  it('says why in English and Turkish', () => {
    expect(refusalReason({ kind: 'locked', reason: 'user' })).toBe('Locked · unlock first');
    expect(refusalReason({ kind: 'locked', reason: 'signed' })).toBe('Locked · unlock first');
    expect(refusalReason({ kind: 'markup', act: 'freehand' })).toBe('Open Markup to draw');
    expect(refusalReason({ kind: 'markup', act: 'place' })).toBe('Open Markup to place');
    expect(refusalReason({ kind: 'unknown' })).toBe('No document open');
    setLocale('tr');
    expect(refusalReason({ kind: 'locked', reason: 'restricted' })).toBe(
      'Kilitli · önce kilidi açın',
    );
    expect(refusalReason({ kind: 'markup', act: 'freehand' })).toBe(
      'Çizmek için İşaretlemeyi açın',
    );
  });

  it('keeps the English reasons within 32 characters (04-context §12.5)', () => {
    const reasons = [
      refusalReason({ kind: 'locked', reason: 'user' }),
      refusalReason({ kind: 'markup', act: 'freehand' }),
      refusalReason({ kind: 'markup', act: 'place' }),
      refusalReason({ kind: 'unknown' }),
    ];
    for (const reason of reasons) expect(reason.length).toBeLessThanOrEqual(32);
  });
});

describe('rename is a document act at every entry point (X31)', () => {
  // The tab (F2 in the tab bar), the grid's section header in All open (double-click) and the
  // menus' and F2's `section.rename` all start renaming through `startRename`: in place in a
  // section, else in the title menu's Name field.
  const started = () =>
    useUiStore.getState().renaming?.documentId === a ||
    useFrameStore.getState().titleMenu === 'name';
  for (const surface of ['tab', 'section', undefined] as const) {
    it(`starts in the ${surface ?? 'default'} place only while unlocked`, () => {
      startRename(a, surface);
      expect(started()).toBe(true);
      useUiStore.setState({ renaming: null });
      closeTitleMenu();
      for (const reason of LOCK_REASONS) {
        useLockStore.getState().lock(a, reason);
        startRename(a, surface);
        expect(started()).toBe(false);
      }
    });
  }
});
