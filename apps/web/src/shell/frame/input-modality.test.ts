import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  createInputTracker,
  inputTypeOf,
  type MatchMedia,
  readPointerCapabilities,
  usePointerCapabilities,
} from './input-modality';

/** A `matchMedia` stand-in answering true for the listed queries. */
function media(...matching: string[]): MatchMedia {
  return (query) => ({ matches: matching.includes(query) });
}

describe('pointer capabilities', () => {
  it('reads a phone: coarse, no hover', () => {
    expect(readPointerCapabilities(media('(pointer: coarse)', '(any-pointer: coarse)'))).toEqual({
      primary: 'coarse',
      anyCoarse: true,
      anyFine: false,
      hover: false,
      anyHover: false,
    });
  });

  it('reads a desktop: fine, hover', () => {
    expect(
      readPointerCapabilities(
        media('(pointer: fine)', '(any-pointer: fine)', '(hover: hover)', '(any-hover: hover)'),
      ),
    ).toEqual({ primary: 'fine', anyCoarse: false, anyFine: true, hover: true, anyHover: true });
  });

  it('reads a touch laptop: a fine primary pointer with a coarse one beside it', () => {
    const caps = readPointerCapabilities(
      media(
        '(pointer: fine)',
        '(any-pointer: fine)',
        '(any-pointer: coarse)',
        '(hover: hover)',
        '(any-hover: hover)',
      ),
    );
    expect(caps.primary).toBe('fine');
    expect(caps.anyCoarse).toBe(true);
  });

  it('reads a tablet with a mouse: coarse primary, any-hover', () => {
    const caps = readPointerCapabilities(
      media(
        '(pointer: coarse)',
        '(any-pointer: coarse)',
        '(any-pointer: fine)',
        '(any-hover: hover)',
      ),
    );
    expect(caps).toEqual({
      primary: 'coarse',
      anyCoarse: true,
      anyFine: true,
      hover: false,
      anyHover: true,
    });
  });

  it('reads no pointer at all', () => {
    expect(readPointerCapabilities(media()).primary).toBe('none');
  });

  it('the hook answers this browser’s pointers', () => {
    const { result } = renderHook(() => usePointerCapabilities());
    expect(result.current.primary).toBe(
      window.matchMedia('(pointer: coarse)').matches
        ? 'coarse'
        : window.matchMedia('(pointer: fine)').matches
          ? 'fine'
          : 'none',
    );
  });
});

describe('the last input', () => {
  it('names the input of an event', () => {
    expect(inputTypeOf(new KeyboardEvent('keydown', { key: 'a' }))).toBe('keyboard');
    expect(inputTypeOf(new PointerEvent('pointerdown', { pointerType: 'touch' }))).toBe('touch');
    expect(inputTypeOf(new PointerEvent('pointerdown', { pointerType: 'pen' }))).toBe('pen');
    expect(inputTypeOf(new PointerEvent('pointerdown', { pointerType: 'mouse' }))).toBe('mouse');
    // An unknown pointer type (some synthetic events) counts as a mouse.
    expect(inputTypeOf(new PointerEvent('pointerdown', { pointerType: '' }))).toBe('mouse');
    expect(inputTypeOf(new PointerEvent('pointermove', { pointerType: 'touch' }))).toBeUndefined();
  });

  it('tracks pointerdown and keydown, and calls back only when the kind changes', () => {
    const target = new EventTarget();
    const tracker = createInputTracker(target);
    const listener = vi.fn();
    tracker.subscribe(listener);
    expect(tracker.get()).toBeUndefined();

    target.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch' }));
    expect(tracker.get()).toBe('touch');
    target.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch' }));
    expect(listener).toHaveBeenCalledTimes(1);

    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    expect(tracker.get()).toBe('keyboard');
    expect(listener).toHaveBeenCalledTimes(2);

    tracker.dispose();
    target.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'mouse' }));
    expect(tracker.get()).toBe('keyboard');
  });

  it('sees events that a handler stops (capture phase)', () => {
    const outer = document.createElement('div');
    const inner = document.createElement('button');
    outer.append(inner);
    document.body.append(outer);
    inner.addEventListener('pointerdown', (event) => event.stopPropagation());
    const tracker = createInputTracker(outer);
    inner.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'pen', bubbles: true }));
    expect(tracker.get()).toBe('pen');
    tracker.dispose();
    outer.remove();
  });
});
