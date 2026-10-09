import { afterEach, describe, expect, it } from 'vitest';

import { crossFadeFrom, fadeIn } from '../pages/paint-fade';
import { pulseSelection } from './copy-pulse';
import { clearLandings, flashLanding, LANDING_MS } from './landing';

const afterFrames = async (n: number) => {
  for (let i = 0; i < n; i++) await new Promise((resolve) => requestAnimationFrame(resolve));
};

/** Motion-2026-10 viewer.md §1, §3, §5: what arrives fades, and nothing stays at rest. */
describe('viewer arrival motion', () => {
  let host: HTMLElement | null = null;
  afterEach(() => {
    host?.remove();
    host = null;
    document.documentElement.removeAttribute('data-motion');
    window.getSelection()?.removeAllRanges();
  });

  const page = () => {
    host = document.createElement('div');
    host.dataset.pageId = 'p1';
    host.style.cssText = 'position: relative; width: 300px; height: 400px';
    document.body.append(host);
    return host;
  };

  it('rings a landed page on opacity and removes the ring when it ends', async () => {
    const sheet = page();
    const flash = flashLanding(sheet);
    const ring = sheet.querySelector<HTMLElement>('[data-landing]');
    expect(ring).not.toBeNull();
    const timing = flash?.effect?.getComputedTiming();
    expect(timing?.duration).toBe(LANDING_MS);
    const frames = (flash?.effect as KeyframeEffect).getKeyframes();
    expect(frames.every((f) => Object.keys(f).every((k) => !/transform|left|top/.test(k)))).toBe(
      true,
    );
    flash?.finish();
    await flash?.finished;
    await afterFrames(2);
    expect(sheet.querySelector('[data-landing]')).toBeNull();
  });

  it('rings a region, holds still under reduced motion, and gives way to an undo flash', () => {
    document.documentElement.dataset.motion = 'reduced';
    const sheet = page();
    const flash = flashLanding(sheet, { left: 10, top: 20, width: 50, height: 12 });
    const ring = sheet.querySelector<HTMLElement>('[data-landing]');
    expect(ring?.style.left).toBe('6px');
    expect(ring?.style.width).toBe('58px');
    const opacities = (flash?.effect as KeyframeEffect).getKeyframes().map((f) => f.opacity);
    expect(new Set(opacities)).toEqual(new Set(['1']));
    clearLandings(sheet);
    expect(sheet.querySelector('[data-landing]')).toBeNull();
  });

  it('fades a first bitmap in, and cross-fades a sharper one over a copy of the preview', async () => {
    const sheet = page();
    const canvas = document.createElement('canvas');
    canvas.width = 30;
    canvas.height = 40;
    sheet.append(canvas);
    expect(fadeIn(canvas)?.effect?.getComputedTiming().duration).toBeGreaterThan(0);
    const fade = crossFadeFrom(canvas);
    const ghost = sheet.querySelector<HTMLCanvasElement>('canvas[data-ghost]');
    expect(ghost?.width).toBe(30);
    expect(ghost?.previousElementSibling).toBe(canvas);
    fade?.finish();
    await fade?.finished;
    await afterFrames(2);
    expect(sheet.querySelector('canvas[data-ghost]')).toBeNull();
  });

  it('pulses the copied lines in their page, within 150 ms under reduced motion', () => {
    document.documentElement.dataset.motion = 'reduced';
    const sheet = page();
    const line = document.createElement('span');
    line.textContent = 'Copied words';
    line.style.cssText = 'position: absolute; left: 10px; top: 10px';
    sheet.append(line);
    const range = document.createRange();
    range.selectNodeContents(line);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    expect(pulseSelection(selection)).toBeGreaterThan(0);
    const pulse = sheet.querySelector<HTMLElement>('[data-copy-pulse]');
    const animation = pulse?.getAnimations()[0];
    expect(Number(animation?.effect?.getComputedTiming().duration)).toBeLessThanOrEqual(150);
  });
});
