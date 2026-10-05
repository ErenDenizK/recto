/**
 * The announcer's rules (experience-redesign §10; `08-feedback` FB10 §6): one live message per
 * task, said once, a keyed message replacing its kind, the assertive channel for blocking
 * failures, and FB10's timing: the 250 ms key window, `debounceMs` and the 10 s clear.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { announce, CLEAR_AFTER_MS, KEY_WINDOW_MS, resetAnnouncer, useAnnouncer } from './announcer';

const tick = () => new Promise<void>((resolve) => queueMicrotask(resolve));

beforeEach(async () => {
  await tick();
  resetAnnouncer();
});

describe('announce', () => {
  it('says one message, and the same words again in a later task', async () => {
    announce('Draw tools');
    expect(useAnnouncer.getState()).toMatchObject({ message: 'Draw tools', serial: 1 });
    await tick();
    announce('Draw tools');
    expect(useAnnouncer.getState()).toMatchObject({ message: 'Draw tools', serial: 2 });
  });

  it('joins what one change causes, in order, each once', () => {
    announce('Pen: 5 strokes on page 1');
    announce('Lasso tool');
    announce('Lasso tool');
    expect(useAnnouncer.getState().message).toBe('Pen: 5 strokes on page 1. Lasso tool');
  });

  it('lets a keyed message replace an earlier one of its key, not the others', () => {
    announce('Pen: 2 strokes on page 1');
    announce('Pen tool', { key: 'tool' });
    announce('Blue pen, 1.5 pt', { key: 'tool' });
    expect(useAnnouncer.getState().message).toBe('Pen: 2 strokes on page 1. Blue pen, 1.5 pt');
  });

  it('starts afresh in the next task', async () => {
    announce('2 files selected');
    await tick();
    announce('3 files selected');
    expect(useAnnouncer.getState().message).toBe('3 files selected');
  });

  it('keeps failures on the assertive channel, apart from the polite one', () => {
    announce('Draw tools');
    announce('Stroke not saved', { politeness: 'assertive' });
    expect(useAnnouncer.getState()).toMatchObject({
      message: 'Draw tools',
      alert: 'Stroke not saved',
      alertSerial: 1,
    });
  });
});

describe('announce timing (FB10 §6)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetAnnouncer();
  });
  afterEach(() => {
    resetAnnouncer();
    vi.useRealTimers();
  });

  it('lets a keyed message within 250 ms replace the last of its key: only the newest is said', async () => {
    announce('Recognizing text, 1 of 12 pages', { key: 'job' });
    expect(useAnnouncer.getState()).toMatchObject({ serial: 1 });
    await tick();
    vi.advanceTimersByTime(100);
    announce('Recognizing text, 2 of 12 pages', { key: 'job' });
    announce('Recognizing text, 3 of 12 pages', { key: 'job' });
    // Held until the window ends; the middle one never speaks.
    expect(useAnnouncer.getState()).toMatchObject({
      message: 'Recognizing text, 1 of 12 pages',
      serial: 1,
    });
    vi.advanceTimersByTime(KEY_WINDOW_MS - 100);
    expect(useAnnouncer.getState()).toMatchObject({
      message: 'Recognizing text, 3 of 12 pages',
      serial: 2,
    });
  });

  it('says a keyed message at once after the window, and unkeyed ones always at once', async () => {
    announce('Pen tool', { key: 'tool' });
    await tick();
    vi.advanceTimersByTime(KEY_WINDOW_MS);
    announce('Lasso tool', { key: 'tool' });
    expect(useAnnouncer.getState()).toMatchObject({ message: 'Lasso tool', serial: 2 });
    await tick();
    announce('Deleted page 7');
    expect(useAnnouncer.getState()).toMatchObject({ message: 'Deleted page 7', serial: 3 });
  });

  it('debounces a keyed message until the calls stop', () => {
    announce('3 results', { key: 'count', debounceMs: 500 });
    vi.advanceTimersByTime(300);
    announce('12 results', { key: 'count', debounceMs: 500 });
    vi.advanceTimersByTime(499);
    expect(useAnnouncer.getState().serial).toBe(0);
    vi.advanceTimersByTime(1);
    expect(useAnnouncer.getState()).toMatchObject({ message: '12 results', serial: 1 });
  });

  it('clears polite text after 10 s, so the same words later are a change', async () => {
    announce('Text copied');
    vi.advanceTimersByTime(CLEAR_AFTER_MS - 1);
    expect(useAnnouncer.getState().message).toBe('Text copied');
    await tick();
    announce('Opened report');
    vi.advanceTimersByTime(CLEAR_AFTER_MS - 1);
    // The clear belongs to the newest message only.
    expect(useAnnouncer.getState().message).toBe('Opened report');
    vi.advanceTimersByTime(1);
    expect(useAnnouncer.getState().message).toBe('');
  });
});
