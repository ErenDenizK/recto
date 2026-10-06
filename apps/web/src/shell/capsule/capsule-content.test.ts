/**
 * What the capsule shows (spec X1; `03-markup.md` MK-1 §9: "unit for the content selector, every
 * state"): Locked wins over Markup, and a lock engaging while Markup is open closes it, said once.
 */
import type { DocumentId } from '@pdf-editor/document-model';
import { afterEach, describe, expect, it } from 'vitest';

import { LOCK_REASONS, resetLockStore, useLockStore } from '../../state/lock-store';
import { isMarkupOpen, useUiStore } from '../../state/ui-store';
import { useAnnouncer } from '../announcer';
import { capsuleShape, watchLockClosesMarkup } from './capsule-content';
import { restingSize, STAGGER_MS, STAGGER_STEPS, staggerDelay } from './capsule-morph';

const A = 'doc-a' as DocumentId;
const B = 'doc-b' as DocumentId;

afterEach(() => {
  resetLockStore();
  useUiStore.setState({ docUi: {} });
});

describe('capsuleShape', () => {
  it('is the dock in viewing and the palette in Markup', () => {
    expect(capsuleShape({ markup: false, lock: undefined })).toBe('dock');
    expect(capsuleShape({ markup: true, lock: undefined })).toBe('palette');
  });

  it('is Locked for every reason, whatever Markup says', () => {
    for (const lock of LOCK_REASONS) {
      expect(capsuleShape({ markup: false, lock })).toBe('locked');
      expect(capsuleShape({ markup: true, lock })).toBe('locked');
    }
  });
});

describe('watchLockClosesMarkup', () => {
  it('closes Markup on the document that locks, and says so once', () => {
    const stop = watchLockClosesMarkup();
    useUiStore.getState().openMarkup(A);
    useUiStore.getState().openMarkup(B);
    useLockStore.getState().lock(A);
    expect(isMarkupOpen(useUiStore.getState(), A)).toBe(false);
    expect(isMarkupOpen(useUiStore.getState(), B)).toBe(true);
    expect(useAnnouncer.getState().message).toBe('Locked. Markup closed.');
    stop();
  });

  it('leaves Markup alone on a reason change or an unlock', () => {
    const stop = watchLockClosesMarkup();
    useLockStore.getState().lock(A, 'signed');
    useUiStore.getState().openMarkup(A);
    useLockStore.getState().lock(A, 'user');
    expect(isMarkupOpen(useUiStore.getState(), A)).toBe(true);
    useLockStore.getState().unlock(A);
    expect(isMarkupOpen(useUiStore.getState(), A)).toBe(true);
    stop();
  });
});

describe('capsule-morph helpers', () => {
  it('rests at the content plus the rim, never wider than the band allows', () => {
    expect(restingSize({ width: 420, height: 42 }, { x: 2, y: 2 }, 1000)).toEqual({
      width: 422,
      height: 44,
    });
    expect(restingSize({ width: 1100, height: 42 }, { x: 2, y: 2 }, 800).width).toBe(800);
  });

  it('staggers new pieces 12 ms apart for at most ten', () => {
    expect(staggerDelay(0)).toBe(0);
    expect(staggerDelay(3)).toBe(3 * STAGGER_MS);
    expect(staggerDelay(40)).toBe((STAGGER_STEPS - 1) * STAGGER_MS);
    expect(STAGGER_STEPS * STAGGER_MS).toBeLessThanOrEqual(120);
  });
});
