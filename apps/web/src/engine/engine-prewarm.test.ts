/** The engine's pre-warm (PF-24): when it is allowed, and what it keeps. */
import { describe, expect, it, vi } from 'vitest';

import { prewarmAllowed } from './engine-prewarm';
import { EngineService, PREWARM_HOLD_MS, type RendererLike } from './engine-service';

const nav = (extra: object) => ({ ...extra }) as unknown as Navigator;

describe('prewarmAllowed', () => {
  it('is on where the browser gives no hint, and on a fast link with enough memory', () => {
    expect(prewarmAllowed(nav({}))).toBe(true);
    expect(
      prewarmAllowed(
        nav({ deviceMemory: 8, connection: { effectiveType: '4g', saveData: false } }),
      ),
    ).toBe(true);
  });

  it('is off under 4 GB, with data saver and on a slow link', () => {
    expect(prewarmAllowed(nav({ deviceMemory: 2 }))).toBe(false);
    expect(prewarmAllowed(nav({ connection: { saveData: true } }))).toBe(false);
    for (const effectiveType of ['slow-2g', '2g', '3g']) {
      expect(prewarmAllowed(nav({ connection: { effectiveType } }))).toBe(false);
    }
  });
});

describe('EngineService.prewarm', () => {
  const renderer = (): RendererLike => ({
    open: () => Promise.reject(new Error('not used')),
    close: () => Promise.resolve(),
    getPageText: () => Promise.resolve([]),
    renderPage: () => Promise.reject(new Error('not used')),
  });

  it('starts the worker once, keeps it for the hold, then lets PF-18 end it', async () => {
    // The lazy parking module that arms the idle end, loaded before the clock is faked.
    await import('./engine-parking');
    vi.useFakeTimers();
    try {
      const create = vi.fn(renderer);
      const service = new EngineService({ createRenderer: create, timings: false, idleMs: 10 });
      service.prewarm();
      service.prewarm();
      await vi.advanceTimersByTimeAsync(0);
      expect(create).toHaveBeenCalledTimes(1);
      expect(service.canEnd()).toBe(false);
      // Past the idle window, but inside the hold: the worker is still there.
      await vi.advanceTimersByTimeAsync(PREWARM_HOLD_MS - 1_000);
      expect(service.renderer).toBeDefined();
      await vi.advanceTimersByTimeAsync(2_000);
      expect(service.canEnd()).toBe(true);
      // The lazy module arms the idle timer in a task of its own; real time passes for it.
      await vi.waitFor(async () => {
        await vi.advanceTimersByTimeAsync(20);
        expect(service.renderer).toBeUndefined();
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('does nothing when a worker is already running', async () => {
    const create = vi.fn(renderer);
    const service = new EngineService({ createRenderer: create, timings: false });
    await service.engine();
    service.prewarm();
    expect(create).toHaveBeenCalledTimes(1);
    expect(service.canEnd()).toBe(true);
  });
});
