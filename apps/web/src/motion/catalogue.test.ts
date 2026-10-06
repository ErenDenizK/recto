/**
 * The catalogue entries that run from script (language.md §7.3; spec D3-4: X8, 02.5, 02.6,
 * 05.2): each moves what the catalogue says on its token, reduces as §7.5 says, and leaves
 * nothing on its element at rest (Q-2).
 */
import { afterEach, describe, expect, it } from 'vitest';

import { fold, revealWhenShown, ringFlash, sheetPush } from './catalogue';
import { duration, pressScale, RING_FLASH } from './tokens';

const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

function box(): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:40px;top:40px;width:120px;height:80px';
  document.body.append(el);
  return el;
}

/** What animates on `el` now: property → [first, last] keyframe values. */
function animated(el: Element): Map<string, [string, string]> {
  const out = new Map<string, [string, string]>();
  for (const animation of el.getAnimations()) {
    const frames = (animation.effect as KeyframeEffect).getKeyframes();
    for (const key of Object.keys(frames[0] ?? {})) {
      if (['offset', 'computedOffset', 'easing', 'composite'].includes(key)) continue;
      out.set(key, [String(frames[0]?.[key]), String(frames.at(-1)?.[key])]);
    }
  }
  return out;
}

afterEach(() => {
  delete document.documentElement.dataset.motion;
  document.body.replaceChildren();
});

describe('sheetPush (X8)', () => {
  it('slides 24 px in from the side it comes from and fades in, then leaves nothing', async () => {
    const el = box();
    sheetPush(el, 1);
    const pushed = animated(el);
    expect(pushed.get('transform')?.[0]).toBe('translate(24px, 0px) scale(1, 1)');
    expect(pushed.get('opacity')?.[0]).toBe('0');
    sheetPush(el, -1);
    expect(animated(el).get('transform')?.[0]).toBe('translate(-24px, 0px) scale(1, 1)');
    await Promise.all(el.getAnimations().map((a) => a.finished.catch(() => undefined)));
    await frame();
    expect(el.style.transform).toBe('');
    expect(el.style.opacity).toBe('');
    expect(el.style.willChange).toBe('');
    expect(el.getAnimations()).toHaveLength(0);
  });

  it('starts a push that interrupts another from the opacity that one reached', async () => {
    const el = box();
    sheetPush(el, 1);
    for (let i = 0; i < 6; i++) await frame();
    const reached = Number(getComputedStyle(el).opacity);
    expect(reached).toBeGreaterThan(0);
    sheetPush(el, -1);
    const start = Number(animated(el).get('opacity')?.[0]);
    expect(start).toBeGreaterThan(0);
    expect(Math.abs(start - reached)).toBeLessThan(0.25);
  });

  it('only fades, within 150 ms, under reduced motion', () => {
    document.documentElement.dataset.motion = 'reduced';
    const el = box();
    sheetPush(el, 1);
    const moved = animated(el);
    expect(moved.has('transform')).toBe(false);
    expect(moved.get('opacity')?.[0]).toBe('0');
    for (const animation of el.getAnimations()) {
      expect(Number(animation.effect?.getComputedTiming().duration)).toBeLessThanOrEqual(150);
    }
  });
});

describe('ringFlash (undo reveal)', () => {
  it('flashes a ring 80 ms in, 160 held and 260 out: 500 ms (A-10)', () => {
    const el = box();
    const flash = ringFlash(el);
    expect(flash?.effect?.getComputedTiming().duration).toBe(RING_FLASH.totalMs);
    const offsets = (flash?.effect as KeyframeEffect)
      .getKeyframes()
      .map((k) => Math.round(k.computedOffset * 500));
    expect(offsets).toEqual([0, 80, 240, 500]);
  });

  it('holds the ring still under reduced motion (no keyframe changes it)', () => {
    document.documentElement.dataset.motion = 'reduced';
    const el = box();
    const frames = (ringFlash(el)?.effect as KeyframeEffect).getKeyframes();
    expect(new Set(frames.map((k) => k.outlineColor)).size).toBe(1);
  });

  it('replaces a running flash on the same element', () => {
    const el = box();
    const first = ringFlash(el);
    ringFlash(el, 'chrome');
    expect(first?.playState).toBe('idle');
    expect(el.getAnimations()).toHaveLength(1);
  });
});

describe('revealWhenShown (find step, 05.2)', () => {
  it('flashes the target once it has been laid out', async () => {
    let target: HTMLElement | null = null;
    const shown = revealWhenShown(() => target);
    await frame();
    target = box();
    const flash = await shown;
    expect(flash).toBeDefined();
    expect(target.getAnimations()).toHaveLength(1);
  });

  it('gives up without a target', async () => {
    expect(await revealWhenShown(() => null)).toBeUndefined();
  });
});

describe('fold (02.6)', () => {
  it('leaves toward the target on the popup exit, then rings the target', async () => {
    const surface = box();
    const into = document.createElement('button');
    into.style.cssText = 'position:fixed;left:400px;top:40px;width:24px;height:24px';
    document.body.append(into);
    let gone = false;
    const exit = fold(surface, into, () => {
      gone = true;
    });
    const end = (exit?.effect as KeyframeEffect).getKeyframes().at(-1);
    expect(end?.opacity).toBe('0');
    // 16 px at most toward the ⓘ's centre on each axis (up and to the right here).
    expect(String(end?.transform)).toBe('translate(16px, -16px) scale(0.96)');
    expect(exit?.effect?.getComputedTiming().duration).toBe(duration('fast'));
    await exit?.finished;
    await frame();
    expect(gone).toBe(true);
    expect(into.getAnimations()).toHaveLength(1);
    expect(surface.getAnimations()).toHaveLength(0);
  });
});

describe('pressScale (02.5)', () => {
  it('presses 0.97 / 0.94, 0.98 / 0.96 from 120 px, and not at all under reduced motion', () => {
    expect(pressScale('mouse')).toBe(0.97);
    expect(pressScale('touch')).toBe(0.94);
    expect(pressScale('pen', 80)).toBe(0.94);
    expect(pressScale('mouse', 120)).toBe(0.98);
    expect(pressScale('touch', 300)).toBe(0.96);
    document.documentElement.dataset.motion = 'reduced';
    expect(pressScale('touch', 300)).toBe(1);
    expect(duration('fast')).toBe(100);
  });
});
