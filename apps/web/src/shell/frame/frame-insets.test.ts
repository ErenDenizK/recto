import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  insetsFromPadding,
  readSafeAreaInsets,
  sameInsets,
  useSafeAreaInsets,
  withMinimum,
  ZERO_INSETS,
} from './frame-insets';

describe('safe-area insets as numbers', () => {
  const made: HTMLElement[] = [];
  afterEach(() => {
    for (const element of made.splice(0)) element.remove();
  });

  it('reads an element’s padding as insets (the probe’s mechanism)', () => {
    const element = document.createElement('div');
    // An iPhone in portrait: status bar 47, home indicator 34.
    element.style.padding = '47px 0px 34px 0px';
    document.body.append(element);
    made.push(element);
    expect(insetsFromPadding(element)).toEqual({ top: 47, right: 0, bottom: 34, left: 0 });
  });

  it('keeps fractional insets and treats anything unreadable as zero', () => {
    const element = document.createElement('div');
    element.style.padding = '20.5px 47px 21px 47px';
    document.body.append(element);
    made.push(element);
    expect(insetsFromPadding(element)).toEqual({ top: 20.5, right: 47, bottom: 21, left: 47 });
  });

  it('is zero on a desktop browser, which has no safe area', () => {
    expect(readSafeAreaInsets()).toEqual(ZERO_INSETS);
    // One probe, reused.
    readSafeAreaInsets();
    expect(document.querySelectorAll('[data-safe-area-probe]')).toHaveLength(1);
  });

  it('applies the frame’s minimum per side', () => {
    expect(withMinimum({ top: 47, right: 0, bottom: 34, left: 0 }, 8)).toEqual({
      top: 47,
      right: 8,
      bottom: 34,
      left: 8,
    });
  });

  it('compares insets by value', () => {
    expect(sameInsets(ZERO_INSETS, { top: 0, right: 0, bottom: 0, left: 0 })).toBe(true);
    expect(sameInsets(ZERO_INSETS, { top: 0, right: 0, bottom: 1, left: 0 })).toBe(false);
  });

  it('the hook answers a stable snapshot', () => {
    const { result, rerender } = renderHook(() => useSafeAreaInsets());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
    expect(first).toEqual(ZERO_INSETS);
  });
});
