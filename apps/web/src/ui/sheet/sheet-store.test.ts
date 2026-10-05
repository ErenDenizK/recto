/**
 * The sheet store (components/07-sheets.md §1.1 rules 1 and 5, §2.9, §3.9): one sheet at a
 * time, drafts per document and sheet with Reset, and the confirmation's promise.
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  answerConfirm,
  claimFront,
  closeSheet,
  confirm,
  draftOf,
  dropDocumentDrafts,
  openSheet,
  releaseFront,
  resetDraft,
  setDraft,
  useSheetDraft,
  useSheetStore,
} from './sheet-store';

beforeEach(() => {
  useSheetStore.setState({ open: null, front: null, confirm: null, drafts: {} });
});

describe('one sheet at a time', () => {
  it('opening a sheet replaces the open one', () => {
    openSheet('save-copy', { docId: 'a', preset: 'size' });
    expect(useSheetStore.getState().open).toEqual({ id: 'save-copy', docId: 'a', preset: 'size' });
    openSheet('settings');
    expect(useSheetStore.getState().open).toEqual({ id: 'settings', docId: null, preset: null });
  });

  it('closes only the sheet named', () => {
    openSheet('settings');
    closeSheet('save-copy');
    expect(useSheetStore.getState().open?.id).toBe('settings');
    closeSheet('settings');
    expect(useSheetStore.getState().open).toBeNull();
  });

  it('a sheet claiming the front closes a store-opened other one; releasing is per id', () => {
    openSheet('settings');
    claimFront('settings');
    claimFront('shortcuts');
    expect(useSheetStore.getState()).toMatchObject({ open: null, front: 'shortcuts' });
    releaseFront('settings');
    expect(useSheetStore.getState().front).toBe('shortcuts');
    releaseFront('shortcuts');
    expect(useSheetStore.getState().front).toBeNull();
  });
});

describe('drafts (07 §1.1 rule 5)', () => {
  it('keeps a draft per document and sheet until Reset', () => {
    setDraft('a', 'page-numbers', { start: 3 });
    setDraft('b', 'page-numbers', { start: 9 });
    setDraft('a', 'crop', { margin: 4 });
    expect(draftOf('a', 'page-numbers')).toEqual({ start: 3 });
    expect(draftOf('b', 'page-numbers')).toEqual({ start: 9 });
    // Closing the sheet keeps it.
    openSheet('page-numbers', { docId: 'a' });
    closeSheet();
    expect(draftOf('a', 'page-numbers')).toEqual({ start: 3 });
    resetDraft('a', 'page-numbers');
    expect(draftOf('a', 'page-numbers')).toBeUndefined();
    expect(draftOf('a', 'crop')).toEqual({ margin: 4 });
    dropDocumentDrafts('a');
    expect(draftOf('a', 'crop')).toBeUndefined();
    expect(draftOf('b', 'page-numbers')).toEqual({ start: 9 });
  });

  it('useSheetDraft gives the default, then the kept value, and says when it came back', () => {
    const first = renderHook(() => useSheetDraft('find', 'a', ''));
    expect(first.result.current[0]).toBe('');
    expect(first.result.current[3]).toBe(false);
    act(() => first.result.current[1]('pen'));
    expect(first.result.current[0]).toBe('pen');
    first.unmount();

    // The sheet opens again: the draft is back, for the same document only.
    const again = renderHook(() => useSheetDraft('find', 'a', ''));
    expect(again.result.current[0]).toBe('pen');
    expect(again.result.current[3]).toBe(true);
    const other = renderHook(() => useSheetDraft('find', 'b', ''));
    expect(other.result.current[0]).toBe('');
    act(() => again.result.current[1]((previous) => `${previous} tool`));
    expect(again.result.current[0]).toBe('pen tool');
    act(() => again.result.current[2]());
    expect(again.result.current[0]).toBe('');
  });

  it('never persists: the store holds no storage', () => {
    setDraft('a', 'save-copy', { name: 'x.pdf' });
    expect(Object.keys(localStorage).some((key) => key.includes('sheet'))).toBe(false);
  });
});

describe('confirm (07 §3.9)', () => {
  it('resolves true for the action and false for Cancel', async () => {
    const yes = confirm({
      title: 'Revert?',
      body: 'Your changes go.',
      action: 'Revert',
      undoable: true,
    });
    const request = useSheetStore.getState().confirm;
    expect(request).toMatchObject({
      title: 'Revert?',
      action: 'Revert',
      undoable: true,
      danger: false,
    });
    answerConfirm(request?.id ?? -1, true);
    await expect(yes).resolves.toBe(true);
    expect(useSheetStore.getState().confirm).toBeNull();

    const no = confirm({ title: 'Clear?', body: 'Gone.', action: 'Clear', danger: true });
    answerConfirm(useSheetStore.getState().confirm?.id ?? -1, false);
    await expect(no).resolves.toBe(false);
  });

  it('one question at a time: a second answers the first with false', async () => {
    const first = confirm({ title: 'One?', body: '', action: 'One' });
    const second = confirm({ title: 'Two?', body: '', action: 'Two' });
    await expect(first).resolves.toBe(false);
    expect(useSheetStore.getState().confirm?.title).toBe('Two?');
    answerConfirm(useSheetStore.getState().confirm?.id ?? -1, true);
    await expect(second).resolves.toBe(true);
  });
});
