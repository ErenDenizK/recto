/**
 * The first-visit Office flow waits for the late-registered worker to claim the page (PF-20,
 * ADR-0035 §5).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { whenServiceWorkerControls } from './office-worker';

function fakeContainer(controller: object | null) {
  const container = Object.assign(new EventTarget(), {
    controller,
    ready: new Promise<unknown>(() => undefined),
  });
  vi.stubGlobal('navigator', { serviceWorker: container });
  return container;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('whenServiceWorkerControls', () => {
  it('is true at once when a worker controls the page', async () => {
    fakeContainer({});
    expect(await whenServiceWorkerControls(1_000)).toBe(true);
  });

  it('waits for the worker to claim the page', async () => {
    const container = fakeContainer(null);
    const result = whenServiceWorkerControls(1_000);
    container.controller = {};
    container.dispatchEvent(new Event('controllerchange'));
    expect(await result).toBe(true);
  });

  it('gives up after the timeout', async () => {
    vi.useFakeTimers();
    fakeContainer(null);
    const result = whenServiceWorkerControls(1_000);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(await result).toBe(false);
  });
});
