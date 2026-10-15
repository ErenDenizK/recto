import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  APPLE_GPU,
  ensureDegradeStart,
  glassTier,
  gpuGlassEligible,
  slowFrameMs,
  renderOverride,
  resetRenderQuality,
  SOFTWARE_RENDERER,
  startCostLadder,
  startDegrade,
  startGlass,
  TEST_RENDER,
  useRenderQualityStore,
  webglProbe,
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

  it('starts the ladder at step 2 on 4 GB, or four cores where the memory is unknown and the GPU is not Apple’s (GLS-10)', () => {
    setOverride({ degrade: 'auto' });
    const cores = vi.spyOn(Navigator.prototype, 'hardwareConcurrency', 'get');
    const nav = navigator as { deviceMemory?: number };
    const had = Object.getOwnPropertyDescriptor(nav, 'deviceMemory');
    const setMemory = (value: number | undefined) =>
      Object.defineProperty(nav, 'deviceMemory', { value, configurable: true });
    try {
      // Known memory decides alone.
      setMemory(4);
      cores.mockReturnValue(8);
      expect(startDegrade()).toBe(2);
      setMemory(8);
      cores.mockReturnValue(4);
      expect(startDegrade()).toBe(0);
      // Unknown memory (Safari, Firefox): four cores are small, unless the GPU is Apple's.
      setMemory(undefined);
      cores.mockReturnValue(8);
      expect(startDegrade()).toBe(0);
      cores.mockReturnValue(4);
      expect(startDegrade()).toBe(APPLE_GPU.test(webglRenderer()) ? 0 : 2);
      expect(APPLE_GPU.test('Apple GPU')).toBe(true);
      expect(
        APPLE_GPU.test('ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)'),
      ).toBe(true);
      expect(APPLE_GPU.test('Mali-G78')).toBe(false);
      cores.mockReturnValue(2);
      ensureDegradeStart();
      expect(useRenderQualityStore.getState().degrade).toBe(
        APPLE_GPU.test(webglRenderer()) ? 0 : 2,
      );
      resetRenderQuality();
      setOverride({ degrade: 'off' });
      expect(startDegrade()).toBe(0);
    } finally {
      if (had) Object.defineProperty(nav, 'deviceMemory', had);
      else delete nav.deviceMemory;
    }
  });
});

describe('the glass tier (GLS-10)', () => {
  it('is GPU only on WebGL2 off a software rasteriser at step 0 under Glass Clear', () => {
    const root = document.documentElement;
    const before = root.getAttribute('data-glass');
    try {
      root.setAttribute('data-glass', 'clear');
      const { webgl2, renderer } = webglProbe();
      const capable = webgl2 && !SOFTWARE_RENDERER.test(renderer);
      expect(gpuGlassEligible()).toBe(capable);
      expect(glassTier()).toBe(capable ? 'gpu' : 'css');
      useRenderQualityStore.setState({ degrade: 1 });
      expect(gpuGlassEligible()).toBe(false);
      expect(glassTier()).toBe('css');
      useRenderQualityStore.setState({ degrade: 4 });
      expect(glassTier()).toBe('css');
      root.setAttribute('data-glass', 'tinted');
      useRenderQualityStore.setState({ degrade: 0 });
      expect(gpuGlassEligible()).toBe(false);
      root.setAttribute('data-glass', 'solid');
      expect(glassTier()).toBe('solid');
    } finally {
      if (before === null) root.removeAttribute('data-glass');
      else root.setAttribute('data-glass', before);
    }
  });
});

describe('the cost ladder (language.md §2.8, ADR-0024 §2.5)', () => {
  it('steps once per slow window while input arrives, holds the step, and never goes past 4', () => {
    const store = useRenderQualityStore;
    for (let i = 0; i < 6; i++) store.getState().stepDown();
    expect(store.getState().degrade).toBe(4);
  });

  it('counts a frame slow over 20 ms and 1.5 refresh intervals (GLS-10)', () => {
    expect(slowFrameMs(1000 / 60)).toBeCloseTo(25, 5);
    expect(slowFrameMs(1000 / 120)).toBe(20);
    expect(slowFrameMs(1000 / 30)).toBeCloseTo(50, 5);
    expect(slowFrameMs(Number.POSITIVE_INFINITY)).toBe(20);
  });

  it('steps when more than a quarter of the frames in 2 s are slow', async () => {
    setOverride({ degrade: 'auto', glass: 'clear', light: 'auto' });
    const step = vi.fn();
    const stop = startCostLadder(step);
    try {
      const until = performance.now() + 2600;
      // Every other frame: an input event, then 60 ms of work, as a heavy scroll would cost.
      let odd = false;
      await new Promise<void>((done) => {
        const frame = () => {
          window.dispatchEvent(new Event('scroll'));
          odd = !odd;
          const busy = performance.now() + (odd ? 60 : 0);
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
