/**
 * `reducedMotion()` answers both paths: the system query and the in-app setting stored as
 * `data-motion="reduced"` (language.md §7.5–§7.6; research 22 §5.2; spec D0-12).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { reducedMotion, subscribeReducedMotion } from './reduced-motion';

const QUERY = '(prefers-reduced-motion: reduce)';

/** Makes `matchMedia` answer the reduced-motion query from `state`, returning its listeners. */
function fakeSystem(state: { matches: boolean }) {
  const listeners = new Set<() => void>();
  const real = window.matchMedia.bind(window);
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => {
    if (query !== QUERY) return real(query);
    return {
      get matches() {
        return state.matches;
      },
      media: query,
      addEventListener: (_: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
    } as unknown as MediaQueryList;
  });
  return listeners;
}

afterEach(() => {
  delete document.documentElement.dataset.motion;
  vi.restoreAllMocks();
});

describe('reducedMotion', () => {
  it('is false when neither the system nor the setting asks', () => {
    // The test browsers run with `prefers-reduced-motion: no-preference`.
    expect(matchMedia(QUERY).matches).toBe(false);
    expect(reducedMotion()).toBe(false);
  });

  it('is true when the in-app setting is On (data-motion="reduced")', () => {
    document.documentElement.dataset.motion = 'reduced';
    expect(reducedMotion()).toBe(true);
    document.documentElement.dataset.motion = 'system';
    expect(reducedMotion()).toBe(false);
  });

  it('is true when the system asks', () => {
    fakeSystem({ matches: true });
    expect(reducedMotion()).toBe(true);
  });
});

describe('subscribeReducedMotion', () => {
  it('reports the setting changing, until unsubscribed', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeReducedMotion(listener);
    document.documentElement.dataset.motion = 'reduced';
    await vi.waitFor(() => expect(listener).toHaveBeenLastCalledWith(true));
    delete document.documentElement.dataset.motion;
    await vi.waitFor(() => expect(listener).toHaveBeenLastCalledWith(false));
    unsubscribe();
    const calls = listener.mock.calls.length;
    document.documentElement.dataset.motion = 'reduced';
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(listener.mock.calls.length).toBe(calls);
  });

  it('reports the system setting changing, until unsubscribed', () => {
    const system = { matches: false };
    const queryListeners = fakeSystem(system);
    const listener = vi.fn();
    const unsubscribe = subscribeReducedMotion(listener);
    expect(queryListeners.size).toBe(1);
    system.matches = true;
    for (const notify of queryListeners) notify();
    expect(listener).toHaveBeenLastCalledWith(true);
    unsubscribe();
    expect(queryListeners.size).toBe(0);
  });
});
