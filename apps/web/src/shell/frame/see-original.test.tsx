/**
 * See the original (PLAN.md S2-1a): the title menu's eye hides the markup while held or after
 * a tap, and a held press always gives it back, on release and on `pointercancel`.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OriginalRow } from './OriginalRow';
import {
  HOLD_MS,
  resetOriginal,
  showingOriginal,
  toggleOriginal,
  useOriginalStore,
} from './see-original';

afterEach(() => {
  resetOriginal();
  vi.useRealTimers();
});

describe('see the original', () => {
  it('marks the root while it shows, and resets', () => {
    toggleOriginal();
    expect(showingOriginal()).toBe(true);
    expect(document.documentElement.hasAttribute('data-original')).toBe(true);
    resetOriginal();
    expect(showingOriginal()).toBe(false);
    expect(document.documentElement.hasAttribute('data-original')).toBe(false);
  });

  it('peeks while the eye is held and restores on release', () => {
    vi.useFakeTimers();
    render(<OriginalRow />);
    const eye = screen.getByTestId('title-menu-original');
    fireEvent.pointerDown(eye, { button: 0, pointerId: 1 });
    expect(showingOriginal()).toBe(false);
    act(() => {
      vi.advanceTimersByTime(HOLD_MS + 10);
    });
    expect(useOriginalStore.getState().held).toBe(true);
    fireEvent.pointerUp(eye, { pointerId: 1 });
    expect(showingOriginal()).toBe(false);
  });

  it('restores on pointercancel, whatever took the pointer', () => {
    vi.useFakeTimers();
    render(<OriginalRow />);
    const eye = screen.getByTestId('title-menu-original');
    fireEvent.pointerDown(eye, { button: 0, pointerId: 1 });
    act(() => {
      vi.advanceTimersByTime(HOLD_MS + 10);
    });
    expect(showingOriginal()).toBe(true);
    fireEvent.pointerCancel(eye, { pointerId: 1 });
    expect(showingOriginal()).toBe(false);
  });

  it('toggles on a tap, and a cancelled tap changes nothing', () => {
    render(<OriginalRow />);
    const eye = screen.getByTestId('title-menu-original');
    fireEvent.pointerDown(eye, { button: 0, pointerId: 1 });
    fireEvent.pointerUp(eye, { pointerId: 1 });
    expect(useOriginalStore.getState().toggled).toBe(true);
    expect(eye).toHaveAccessibleName('Show markup');
    fireEvent.pointerDown(eye, { button: 0, pointerId: 1 });
    fireEvent.pointerCancel(eye, { pointerId: 1 });
    expect(useOriginalStore.getState().toggled).toBe(true);
    fireEvent.keyDown(eye, { key: 'Enter' });
    expect(showingOriginal()).toBe(false);
    expect(eye).toHaveAccessibleName('Hide markup');
  });
});
