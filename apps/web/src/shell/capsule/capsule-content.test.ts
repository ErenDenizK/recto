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
import {
  boxesOverlap,
  firstContact,
  lastContact,
  restingSize,
  slideBoxAt,
  STAGGER_MS,
  STAGGER_STEPS,
  staggerDelay,
} from './capsule-morph';

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

  // A piece 100 px wide sliding 300 px to the right, to rest at 300–400 (the dock's Pages into
  // Locked, scaled up): its path is read from the same spring the slide runs on.
  const path = {
    ink: { left: 300, top: 0, right: 400, bottom: 32 },
    dx: -300,
    dy: 0,
    vx: 0,
    vy: 0,
  };

  it('reads a slide from its spring: drawn at the start, at rest by the end', () => {
    expect(slideBoxAt(path, 0).left).toBeCloseTo(0, 5);
    const mid = slideBoxAt(path, 150).left;
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(300);
    expect(slideBoxAt(path, 600).left).toBeCloseTo(300, 0);
  });

  it('knows when a slide first reaches a box and when it has left it for good', () => {
    // A leaving piece in the middle of the path: reached part way, before the slide ends.
    const between = { left: 150, top: 0, right: 200, bottom: 32 };
    const first = firstContact([path], between);
    expect(first).not.toBeNull();
    expect(first ?? 0).toBeGreaterThan(0);
    expect(first ?? 0).toBeLessThan(200);
    // A new piece just past the start is passed early; one at the end is reached only there.
    expect(lastContact([path], { left: 105, top: 0, right: 150, bottom: 32 })).toBeLessThan(
      lastContact([path], { left: 380, top: 0, right: 420, bottom: 32 }),
    );
    // A piece off the path is never reached, and never waits.
    const below = { left: 150, top: 40, right: 200, bottom: 72 };
    expect(firstContact([path], below)).toBeNull();
    expect(lastContact([path], below)).toBe(0);
  });

  it('counts boxes as overlapping only when they share more than a pixel each way', () => {
    const a = { left: 0, top: 0, right: 10, bottom: 10 };
    expect(boxesOverlap(a, { left: 9.5, top: 0, right: 20, bottom: 10 })).toBe(false);
    expect(boxesOverlap(a, { left: 5, top: 5, right: 20, bottom: 20 })).toBe(true);
  });
});
