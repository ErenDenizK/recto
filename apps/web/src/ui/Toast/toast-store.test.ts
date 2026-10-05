/**
 * The toast store (`08-feedback` FB4 §2, §4, §6; 08.5, 08.Q1): the queue of three, eviction
 * of the oldest timed toast, "+N waiting" behind persistent ones, keys that replace, timers
 * per kind and every pause reason freezing them without restarting.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ACTION_MS,
  type DismissReason,
  dismissToast,
  INFO_MAX_MS,
  INFO_MS,
  type PauseReason,
  pushToast,
  resetToasts,
  setToastPause,
  timeLeft,
  type ToastInput,
  toastDuration,
  useToastStore,
} from './toast-store';

const texts = () => useToastStore.getState().shown.map((t) => t.text);
const waiting = () => useToastStore.getState().waiting.map((t) => t.text);

const info = (text: string, extra: Partial<ToastInput> = {}): ToastInput => ({
  kind: 'info',
  text,
  ...extra,
});
const failure = (text: string): ToastInput => ({ kind: 'failure', text });

beforeEach(() => {
  vi.useFakeTimers();
  resetToasts();
});
afterEach(() => {
  resetToasts();
  vi.useRealTimers();
});

describe('durations (FB4 §2, 08.Q1)', () => {
  it('gives each kind its time', () => {
    expect(toastDuration('info', 'Text copied', false)).toBe(INFO_MS);
    expect(toastDuration('action', 'Deleted page 7', true)).toBe(ACTION_MS);
    expect(toastDuration('success', 'Saved', false)).toBe(INFO_MS);
    expect(toastDuration('success', 'Saved', true)).toBe(ACTION_MS);
    expect(toastDuration('failure', 'Could not open', false)).toBeNull();
    expect(toastDuration('system', 'Update ready', true)).toBeNull();
    expect(toastDuration('progress', 'Recognizing', true)).toBeNull();
  });

  it('keeps a toast with an action at least 10 s (A-24)', () => {
    expect(ACTION_MS).toBeGreaterThanOrEqual(10_000);
    for (const kind of ['info', 'action', 'success'] as const) {
      expect(
        toastDuration(kind, 'x'.repeat(500), true) ?? Number.POSITIVE_INFINITY,
      ).toBeGreaterThanOrEqual(10_000);
    }
  });

  it('adds a second per 30 characters beyond 60 to an info toast, up to 8 s', () => {
    expect(toastDuration('info', 'x'.repeat(60), false)).toBe(4_000);
    expect(toastDuration('info', 'x'.repeat(61), false)).toBe(5_000);
    expect(toastDuration('info', 'x'.repeat(120), false)).toBe(6_000);
    expect(toastDuration('info', 'x'.repeat(500), false)).toBe(INFO_MAX_MS);
  });
});

describe('the queue', () => {
  it('shows three at most, oldest first', () => {
    pushToast(info('one'));
    pushToast(info('two'));
    pushToast(info('three'));
    expect(texts()).toEqual(['one', 'two', 'three']);
  });

  it('evicts the oldest timed toast for a fourth, never a persistent one', () => {
    const reasons: DismissReason[] = [];
    pushToast(failure('broken'));
    pushToast(info('one', { onDismiss: (r) => reasons.push(r) }));
    pushToast(info('two'));
    pushToast(info('three'));
    expect(texts()).toEqual(['broken', 'two', 'three']);
    expect(reasons).toEqual(['evicted']);
  });

  it('queues behind three persistent toasts and moves the next one up when one leaves', () => {
    const first = pushToast(failure('a'));
    pushToast(failure('b'));
    pushToast({ kind: 'system', text: 'Update ready' });
    pushToast(info('later'));
    pushToast(failure('c'));
    expect(texts()).toEqual(['a', 'b', 'Update ready']);
    expect(waiting()).toEqual(['later', 'c']);
    dismissToast(first);
    expect(texts()).toEqual(['b', 'Update ready', 'later']);
    expect(waiting()).toEqual(['c']);
  });

  it('starts a waiting toast’s timer only once it is shown', () => {
    const a = pushToast(failure('a'));
    pushToast(failure('b'));
    pushToast(failure('c'));
    pushToast(info('later'));
    vi.advanceTimersByTime(INFO_MS * 2);
    expect(waiting()).toEqual(['later']);
    dismissToast(a);
    vi.advanceTimersByTime(INFO_MS - 1);
    expect(texts()).toContain('later');
    vi.advanceTimersByTime(1);
    expect(texts()).not.toContain('later');
  });

  it('replaces a toast with the same key in place and restarts its timer', () => {
    const id = pushToast({ kind: 'action', text: 'Deleted page 7', key: 'delete' });
    pushToast(failure('other'));
    vi.advanceTimersByTime(ACTION_MS - 1_000);
    const again = pushToast({ kind: 'action', text: 'Deleted 2 pages', key: 'delete' });
    expect(again).toBe(id);
    expect(texts()).toEqual(['Deleted 2 pages', 'other']);
    vi.advanceTimersByTime(ACTION_MS - 1);
    expect(texts()).toEqual(['Deleted 2 pages', 'other']);
    vi.advanceTimersByTime(1);
    expect(texts()).toEqual(['other']);
  });
});

describe('timers', () => {
  it('times info, action and success out, and keeps failures until dismissed', () => {
    const reasons: DismissReason[] = [];
    pushToast(info('copied', { onDismiss: (r) => reasons.push(r) }));
    pushToast({ kind: 'action', text: 'Deleted page 7' });
    pushToast(failure('Could not open scan.pdf: the file is damaged.'));
    vi.advanceTimersByTime(INFO_MS);
    expect(texts()).toEqual(['Deleted page 7', 'Could not open scan.pdf: the file is damaged.']);
    expect(reasons).toEqual(['timeout']);
    vi.advanceTimersByTime(ACTION_MS);
    expect(texts()).toEqual(['Could not open scan.pdf: the file is damaged.']);
    vi.advanceTimersByTime(60_000);
    expect(texts()).toHaveLength(1);
  });

  it.each<PauseReason>(['hover', 'focus', 'pointer', 'hidden', 'modal'])(
    'freezes every timer while %s holds, and resumes with what was left',
    (reason) => {
      pushToast({ kind: 'action', text: 'Deleted page 7' });
      vi.advanceTimersByTime(4_000);
      setToastPause(reason, true);
      vi.advanceTimersByTime(60_000);
      const [toast] = useToastStore.getState().shown;
      expect(toast && timeLeft(toast)).toBe(ACTION_MS - 4_000);
      setToastPause(reason, false);
      vi.advanceTimersByTime(ACTION_MS - 4_001);
      expect(texts()).toEqual(['Deleted page 7']);
      vi.advanceTimersByTime(1);
      expect(texts()).toEqual([]);
    },
  );

  it('stays paused until the last reason lets go', () => {
    pushToast({ kind: 'action', text: 'Deleted page 7' });
    setToastPause('hover', true);
    setToastPause('focus', true);
    setToastPause('hover', false);
    vi.advanceTimersByTime(ACTION_MS * 2);
    expect(texts()).toEqual(['Deleted page 7']);
    setToastPause('focus', false);
    vi.advanceTimersByTime(ACTION_MS);
    expect(texts()).toEqual([]);
  });

  it('holds a toast that arrives while paused', () => {
    setToastPause('hover', true);
    pushToast(info('copied'));
    vi.advanceTimersByTime(INFO_MS * 3);
    expect(texts()).toEqual(['copied']);
    setToastPause('hover', false);
    vi.advanceTimersByTime(INFO_MS);
    expect(texts()).toEqual([]);
  });
});
