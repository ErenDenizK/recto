/**
 * The container transform (motion-2026-10/platform.md §1): the region starts as the trigger's
 * rounded rect laid over the trigger, opens to the popup's box and its shadow, turns from where
 * it is when reversed, leaves nothing at rest and only fades under reduced motion; the
 * *receive* pulse swells the trigger's `scale` and settles.
 */
import { afterEach, describe, expect, it } from 'vitest';

import {
  CONTAINER_BLEED,
  containerFrame,
  containerMotion,
  containerStart,
  FADE_SPAN,
  PULSE_PEAK,
  receivePulse,
} from './container';

function box(css: string): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText = `position:fixed;${css}`;
  document.body.append(el);
  return el;
}

const keys = (el: Element) =>
  el.getAnimations().flatMap((a) => (a.effect as KeyframeEffect).getKeyframes());

afterEach(() => {
  delete document.documentElement.dataset.motion;
  document.body.replaceChildren();
});

describe('containerStart', () => {
  it('a trigger above a menu: a trigger-sized region at the top, shifted up over the trigger', () => {
    const trigger = { x: 100, y: 20, width: 32, height: 32 };
    const popup = { x: 60, y: 60, width: 200, height: 300 };
    const start = containerStart(trigger, popup, 999);
    // The region is the trigger's size, as near to it as the popup allows (its top edge).
    expect(start.inset).toEqual([0, 200 - 40 - 32, 300 - 32, 40]);
    // Capsule radius: half the shorter side.
    expect(start.radius).toBe(16);
    // Its centre (60 + 40 + 16, 60 + 16) is carried onto the trigger's (116, 36).
    expect(start.shift).toEqual([0, -40]);
  });

  it('a trigger wider than the popup is clamped to the popup', () => {
    const start = containerStart(
      { x: 0, y: 0, width: 400, height: 40 },
      { x: 50, y: 48, width: 200, height: 100 },
      10,
    );
    expect(start.inset).toEqual([0, 0, 60, 0]);
    // Centre on centre: the region (the popup's width) slides over the trigger's middle.
    expect(start.shift).toEqual([50, -48]);
  });

  it('frames run from the trigger to the popup with its shadow, fading over the first part', () => {
    const start = containerStart(
      { x: 100, y: 20, width: 32, height: 32 },
      { x: 60, y: 60, width: 200, height: 300 },
      8,
    );
    const first = containerFrame(start, 16, 0);
    expect(first.clipPath).toBe('inset(0px 128px 268px 40px round 8px)');
    expect(first.transform).toBe('translate(0px, -40px)');
    expect(first.opacity).toBe('0');
    const last = containerFrame(start, 16, 1);
    const b = -CONTAINER_BLEED;
    expect(last.clipPath).toBe(
      `inset(${b}px ${b}px ${b}px ${b}px round ${16 + CONTAINER_BLEED}px)`,
    );
    expect(last.transform).toBe('translate(0px, 0px)');
    expect(containerFrame(start, 16, FADE_SPAN).opacity).toBe('1');
  });
});

describe('containerMotion', () => {
  const start = containerStart(
    { x: 100, y: 20, width: 32, height: 32 },
    { x: 60, y: 60, width: 200, height: 300 },
    8,
  );

  it('opens on a spring, then leaves nothing inline and no animation', async () => {
    const el = box('left:60px;top:60px;width:200px;height:300px');
    const motion = containerMotion(el, start, 16);
    motion.to(1);
    const frames = keys(el);
    expect(frames.length).toBeGreaterThan(20);
    expect(frames[0]?.opacity).toBe('0');
    await motion.finished;
    expect(el.getAnimations()).toEqual([]);
    expect(el.style.cssText).toBe(
      'position: fixed; left: 60px; top: 60px; width: 200px; height: 300px;',
    );
    expect(motion.progress).toBe(1);
  });

  it('a close mid-open turns from where it is, without a jump', async () => {
    const el = box('left:60px;top:60px;width:200px;height:300px');
    const motion = containerMotion(el, start, 16);
    motion.to(1);
    const [run] = el.getAnimations();
    (run as Animation).currentTime = 60;
    const midway = motion.progress;
    expect(midway).toBeGreaterThan(0.1);
    expect(midway).toBeLessThan(0.9);
    motion.to(0);
    const [back] = el.getAnimations();
    const first = (back?.effect as KeyframeEffect).getKeyframes()[0];
    expect(first?.transform).toBe(containerFrame(start, 16, midway).transform);
    // Still heading out for a moment (its speed carried through the turn), then closing.
    const frames = (back?.effect as KeyframeEffect).getKeyframes();
    expect(frames.at(-1)?.opacity).toBe('0');
    await motion.finished;
    // Closed: the last frame holds until the popup unmounts.
    expect(getComputedStyle(el).opacity).toBe('0');
  });

  it('only fades under reduced motion, within 150 ms', () => {
    document.documentElement.dataset.motion = 'reduced';
    const el = box('left:0;top:0;width:100px;height:100px');
    containerMotion(el, start, 16).to(1);
    const [run] = el.getAnimations();
    expect(Number(run?.effect?.getTiming().duration)).toBeLessThanOrEqual(150);
    expect(Object.keys(keys(el)[0] ?? {})).toContain('opacity');
    expect(keys(el).some((k) => 'transform' in k || 'clipPath' in k)).toBe(false);
  });
});

describe('receivePulse', () => {
  it('swells the scale by the peak, settles at 1 and leaves nothing', async () => {
    const el = box('left:0;top:0;width:32px;height:32px');
    receivePulse(el);
    const scales = keys(el).map((k) => Number(k.scale));
    expect(Math.max(...scales)).toBeCloseTo(1 + PULSE_PEAK, 3);
    expect(scales.at(-1)).toBe(1);
    await el.getAnimations()[0]?.finished;
    await new Promise((r) => requestAnimationFrame(r));
    expect(el.getAnimations()).toEqual([]);
  });

  it('does nothing under reduced motion', () => {
    document.documentElement.dataset.motion = 'reduced';
    const el = box('left:0;top:0;width:32px;height:32px');
    receivePulse(el);
    expect(el.getAnimations()).toEqual([]);
  });
});
