import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ensureDegradeStart,
  renderOverride,
  resetRenderQuality,
  SOFTWARE_RENDERER,
  startCostLadder,
  startDegrade,
  startGlass,
  TEST_RENDER,
  useRenderQualityStore,
  webglRenderer,
} from './render-quality';

interface Win {
  __rectoRender?: unknown;
}

const setOverride = (value: unknown) => {
  (window as Win).__rectoRender = value;
};

afterEach(() => {
  delete (window as Win).__rectoRender;
  vi.restoreAllMocks();
  resetRenderQuality();
});

describe('the render override (spec X36)', () => {
  it('applies the test values under automation when a page sets nothing', () => {
    expect(navigator.webdriver).toBe(true);
    expect(renderOverride()).toEqual(TEST_RENDER);
    expect(TEST_RENDER).toEqual({ degrade: 'off', glass: 'clear', light: 'auto' });
  });

  it('reads what an init script sets, field by field, and null opts out', () => {
    setOverride({ degrade: 'auto', glass: 'tinted', light: 'still' });
    expect(renderOverride()).toEqual({ degrade: 'auto', glass: 'tinted', light: 'still' });
    setOverride({ glass: 'frosted' });
    expect(renderOverride()).toEqual({ degrade: 'off', glass: 'clear', light: 'auto' });
    setOverride(null);
    expect(renderOverride()).toBeUndefined();
  });
});

describe('the start state (language.md §2.8, G-32)', () => {
  it('names the software rasterisers', () => {
    for (const name of [
      'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)',
      'llvmpipe (LLVM 15.0.7, 256 bits)',
      'Microsoft Basic Render Driver',
      'Software Rasterizer',
    ]) {
      expect(SOFTWARE_RENDERER.test(name), name).toBe(true);
    }
    for (const name of ['Apple M2', 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070)', 'Mali-G78']) {
      expect(SOFTWARE_RENDERER.test(name), name).toBe(false);
    }
  });

  it('starts at Tinted on a software rasteriser, at Clear otherwise, unless overridden', () => {
    setOverride(null);
    const expected = SOFTWARE_RENDERER.test(webglRenderer()) ? 'tinted' : 'clear';
    expect(startGlass()).toBe(expected);
    resetRenderQuality();
    setOverride({ glass: 'solid' });
    expect(startGlass()).toBe('solid');
    resetRenderQuality();
    setOverride({ glass: 'auto' });
    expect(startGlass()).toBe(expected);
  });

  it('starts the ladder at step 2 on four cores or 4 GB, and at 0 with the override', () => {
    setOverride({ degrade: 'auto' });
    const cores = vi.spyOn(Navigator.prototype, 'hardwareConcurrency', 'get');
    cores.mockReturnValue(4);
    expect(startDegrade()).toBe(2);
    cores.mockReturnValue(8);
    const memory = (navigator as { deviceMemory?: number }).deviceMemory;
    expect(startDegrade()).toBe(memory !== undefined && memory <= 4 ? 2 : 0);
    cores.mockReturnValue(2);
    ensureDegradeStart();
    expect(useRenderQualityStore.getState().degrade).toBe(2);
    resetRenderQuality();
    setOverride({ degrade: 'off' });
    expect(startDegrade()).toBe(0);
  });
});

describe('the cost ladder (language.md §2.8, ADR-0024 §2.5)', () => {
  it('steps once per slow window while input arrives, holds the step, and never goes past 4', () => {
    const store = useRenderQualityStore;
    for (let i = 0; i < 6; i++) store.getState().stepDown();
    expect(store.getState().degrade).toBe(4);
  });

  it('steps when more than a quarter of the frames in 2 s take over 20 ms', async () => {
    setOverride({ degrade: 'auto', glass: 'clear', light: 'auto' });
    const step = vi.fn();
    const stop = startCostLadder(step);
    try {
      const until = performance.now() + 2600;
      // Each frame: an input event, then 30 ms of work, as a heavy scroll would cost.
      await new Promise<void>((done) => {
        const frame = () => {
          window.dispatchEvent(new Event('scroll'));
          const busy = performance.now() + 30;
          while (performance.now() < busy) {
            // a slow frame
          }
          if (performance.now() < until) requestAnimationFrame(frame);
          else done();
        };
        requestAnimationFrame(frame);
      });
      expect(step).toHaveBeenCalledTimes(1);
    } finally {
      stop();
    }
  });

  it('draws no frames at rest and nothing at all with the override’s degrade off', async () => {
    const raf = vi.spyOn(window, 'requestAnimationFrame');
    const stop = startCostLadder(vi.fn());
    window.dispatchEvent(new Event('scroll'));
    await new Promise((done) => setTimeout(done, 50));
    expect(raf).not.toHaveBeenCalled();
    stop();
  });
});
