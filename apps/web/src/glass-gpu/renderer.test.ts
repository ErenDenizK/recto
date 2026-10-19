/**
 * The GPU glass renderer in a real browser (Vitest's Chromium, WebGL2 on SwiftShader): its
 * shaders compile, it draws on change only, hands each piece's material to the GPU with
 * `gpu-glass`, and falls back to CSS+ on a lost context (GLS-5, GLS-13).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { gpuGlassFailed, registerGpuGlass } from './index';
import { GPU_GLASS_CLASS, type GpuGlassStats, startGpuGlass } from './renderer';

const frames = (count: number) =>
  new Promise<void>((resolve) => {
    let left = count;
    const step = () => (--left <= 0 ? resolve() : requestAnimationFrame(step));
    requestAnimationFrame(step);
  });

const stats = () => (window as { __gpuGlass?: GpuGlassStats }).__gpuGlass as GpuGlassStats;

let root: HTMLElement;

beforeEach(() => {
  (window as { __rectoGpuGlass?: string }).__rectoGpuGlass = 'force';
  root = document.createElement('div');
  root.style.cssText = 'position:fixed;inset:0;';
  const page = document.createElement('div');
  page.dataset.pageIndex = '0';
  page.style.cssText = 'position:absolute;left:0;top:0;width:300px;height:400px;background:#fff;';
  const bitmap = document.createElement('canvas');
  bitmap.width = 600;
  bitmap.height = 800;
  bitmap.dataset.state = 'rendered';
  bitmap.style.cssText = 'width:100%;height:100%;display:block;';
  const context = bitmap.getContext('2d') as CanvasRenderingContext2D;
  context.fillStyle = '#fff';
  context.fillRect(0, 0, 600, 800);
  context.fillStyle = '#000';
  for (let y = 0; y < 800; y += 24) context.fillRect(0, y, 600, 6);
  page.append(bitmap);
  const piece = document.createElement('nav');
  piece.dataset.gpuGlass = 'capsule';
  piece.style.cssText =
    'position:fixed;left:40px;top:300px;width:200px;height:56px;border-radius:999px;' +
    'background-color:rgba(32,34,39,0.6);backdrop-filter:blur(10px) saturate(1.8) brightness(0.44);color:#fff;z-index:2;';
  root.append(page, piece);
  document.body.append(root);
});

afterEach(() => {
  root.remove();
  delete (window as { __rectoGpuGlass?: string }).__rectoGpuGlass;
});

describe('GPU glass (GLS-12, GLS-13)', () => {
  it('compiles, draws the piece once and nothing at rest', async () => {
    const handle = startGpuGlass(root, false);
    await frames(8);
    const s = stats();
    expect(s.reason).toBe('');
    expect(s.state).toBe('on');
    expect(s.draws).toBe(1);
    expect(s.uploads).toBe(1);
    expect(s.pieces).toBe(1);
    const piece = root.querySelector('nav') as HTMLElement;
    expect(piece.classList.contains(GPU_GLASS_CLASS)).toBe(true);
    // Its own CSS fill and backdrop are off under GPU glass.
    expect(getComputedStyle(piece).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    expect(getComputedStyle(piece).backdropFilter).toBe('none');
    const canvas = root.querySelector<HTMLCanvasElement>('[data-testid="gpu-glass-canvas"]');
    expect(canvas).not.toBeNull();
    expect(getComputedStyle(canvas as HTMLCanvasElement).pointerEvents).toBe('none');
    // At rest: no draw for half a second.
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(stats().draws).toBe(1);
    // A move redraws; a new bitmap uploads once.
    piece.style.top = '320px';
    await frames(6);
    expect(stats().draws).toBe(2);
    const bitmap = root.querySelector('canvas[data-state]') as HTMLCanvasElement;
    bitmap.dataset.bucket = '2';
    await frames(6);
    expect(stats().uploads).toBe(2);
    handle.stop();
    expect(piece.classList.contains(GPU_GLASS_CLASS)).toBe(false);
    expect(root.querySelector('[data-testid="gpu-glass-canvas"]')).toBeNull();
  });

  it('hands the pieces back to CSS while paused', async () => {
    const handle = startGpuGlass(root, false);
    await frames(6);
    const piece = root.querySelector('nav') as HTMLElement;
    expect(piece.classList.contains(GPU_GLASS_CLASS)).toBe(true);
    handle.setPaused(true);
    expect(piece.classList.contains(GPU_GLASS_CLASS)).toBe(false);
    piece.style.top = '330px';
    await frames(6);
    expect(stats().draws).toBe(1);
    handle.setPaused(false);
    await frames(6);
    expect(stats().draws).toBe(2);
    expect(piece.classList.contains(GPU_GLASS_CLASS)).toBe(true);
    handle.stop();
  });

  it('takes pieces registered from script', async () => {
    const extra = document.createElement('div');
    extra.style.cssText =
      'position:fixed;left:20px;top:20px;width:44px;height:44px;border-radius:22px;background-color:rgba(32,34,39,0.6);';
    root.append(extra);
    const unregister = registerGpuGlass(extra, { shape: 'circle', tone: 'icon' });
    const handle = startGpuGlass(root, false);
    await frames(6);
    expect(stats().pieces).toBe(2);
    expect(extra.classList.contains(GPU_GLASS_CLASS)).toBe(true);
    unregister();
    await frames(6);
    expect(extra.classList.contains(GPU_GLASS_CLASS)).toBe(false);
    expect(stats().pieces).toBe(1);
    handle.stop();
  });

  it('draws the scroll edge from its gradient, and keeps pieces under an unreadable one on CSS', async () => {
    const band = document.createElement('div');
    band.dataset.gpuGlass = 'edge';
    band.style.cssText =
      'position:fixed;left:0;top:280px;width:100%;height:100px;' +
      'background:linear-gradient(to bottom, rgba(19,20,23,0.9) 0, rgba(19,20,23,0.4) 60px, transparent 100%);' +
      'mask-image:linear-gradient(to bottom, #000 calc(100% - 40px), transparent);backdrop-filter:blur(8px);';
    root.append(band);
    const handle = startGpuGlass(root, false);
    await frames(6);
    expect(stats().pieces).toBe(2);
    expect(band.classList.contains(GPU_GLASS_CLASS)).toBe(true);
    handle.stop();
    // An edge this cannot read (another direction) stays CSS, and so does the capsule under it.
    band.style.background = 'linear-gradient(to right, rgb(0, 0, 0), transparent)';
    const again = startGpuGlass(root, false);
    await frames(6);
    const piece = root.querySelector('nav') as HTMLElement;
    expect(band.classList.contains(GPU_GLASS_CLASS)).toBe(false);
    expect(piece.classList.contains(GPU_GLASS_CLASS)).toBe(false);
    again.stop();
  });

  // Last: a fallback holds for the session (the module's flag stays set).
  it('falls back to CSS+ for the session when the context is lost', async () => {
    startGpuGlass(root, false);
    await frames(6);
    const piece = root.querySelector('nav') as HTMLElement;
    expect(piece.classList.contains(GPU_GLASS_CLASS)).toBe(true);
    stats().loseContext();
    await frames(4);
    expect(stats().state).toBe('failed');
    expect(stats().reason).toBe('context lost');
    expect(gpuGlassFailed()).toBe(true);
    expect(piece.classList.contains(GPU_GLASS_CLASS)).toBe(false);
    expect(root.querySelector('[data-testid="gpu-glass-canvas"]')).toBeNull();
  });

  // R23-1: the slow-frame rule (GLS-13) on injected timestamps, rAF driven by hand.
  describe('slow-frame rule', () => {
    const setup = () => {
      // The rule is off under the test override; these tests need it on.
      (window as { __rectoGpuGlass?: string }).__rectoGpuGlass = '';
      let pending: FrameRequestCallback | null = null;
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
        pending = cb;
        return 1;
      });
      vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
        pending = null;
      });
      const piece = root.querySelector('nav') as HTMLElement;
      let top = 300;
      // Moves the piece so the scene changes, then runs one frame at `at`.
      const tick = (at: number) => {
        top += 1;
        piece.style.top = `${top}px`;
        const cb = pending;
        pending = null;
        cb?.(at);
      };
      return { tick, piece };
    };

    afterEach(() => vi.restoreAllMocks());

    it('keeps drawing after a 3 s pause in a moving scene', () => {
      const { tick } = setup();
      const handle = startGpuGlass(root, false);
      let t = 1000;
      for (let i = 0; i < 20; i++, t += 16) tick(t);
      handle.setPaused(true);
      handle.setPaused(false);
      t += 3000;
      for (let i = 0; i < 200; i++, t += 16) tick(t);
      expect(stats().state).toBe('on');
      expect(stats().reason).toBe('');
      handle.stop();
    });

    it('treats one long interval inside a running loop as a gap', () => {
      const { tick } = setup();
      const handle = startGpuGlass(root, false);
      let t = 1000;
      for (let i = 0; i < 20; i++, t += 16) tick(t);
      t += 3000;
      for (let i = 0; i < 200; i++, t += 16) tick(t);
      expect(stats().state).toBe('on');
      handle.stop();
    });

    it('still fails on sustained slow frames', () => {
      const { tick } = setup();
      startGpuGlass(root, false);
      let t = 1000;
      for (let i = 0; i < 60; i++, t += 60) tick(t);
      expect(stats().state).toBe('failed');
      expect(stats().reason).toBe('slow frames');
    });
  });
});
