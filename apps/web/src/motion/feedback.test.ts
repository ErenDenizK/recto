/**
 * The feedback entries (motion-2026-10 forms-compact): each moves what it says, reduces to
 * colour or opacity within 150 ms (A-9), ends within 500 ms (A-10) and leaves nothing on its
 * element at rest (Q-2).
 */
import { afterEach, describe, expect, it } from 'vitest';

import { disclose, navPush, receivePulse, SHAKE, shake } from './feedback';

const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

function box(width = 300, height = 80): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText = `position:fixed;left:40px;top:40px;width:${width}px;height:${height}px`;
  document.body.append(el);
  return el;
}

/** The properties the running animations of `el` change. */
function properties(el: Element): Set<string> {
  const out = new Set<string>();
  for (const animation of el.getAnimations()) {
    for (const k of (animation.effect as KeyframeEffect).getKeyframes()) {
      for (const key of Object.keys(k)) {
        if (!['offset', 'computedOffset', 'easing', 'composite'].includes(key)) out.add(key);
      }
    }
  }
  return out;
}

const settled = (el: Element) =>
  Promise.all(el.getAnimations().map((a) => a.finished.catch(() => undefined)));

afterEach(() => {
  delete document.documentElement.dataset.motion;
  document.body.replaceChildren();
});

describe('shake (refusal)', () => {
  it('shakes sideways for 360 ms, three decaying cycles, ending at rest', async () => {
    const el = box();
    const run = shake(el);
    expect(run?.effect?.getComputedTiming().duration).toBe(SHAKE.ms);
    const xs = (run?.effect as KeyframeEffect)
      .getKeyframes()
      .map((k) => Number(/translateX\((-?[\d.]+)px\)/.exec(String(k.transform))?.[1]));
    expect(Math.max(...xs)).toBeLessThanOrEqual(SHAKE.amplitudePx);
    expect(Math.max(...xs)).toBeGreaterThan(SHAKE.amplitudePx / 2);
    expect(Math.abs(xs.at(-1) ?? 1)).toBeLessThan(0.01);
    // Six sign changes: three cycles.
    let turns = 0;
    for (let i = 1; i < xs.length - 1; i++) {
      if (Math.sign(xs[i] ?? 0) !== Math.sign(xs[i + 1] ?? 0) && xs[i + 1] !== 0) turns++;
    }
    expect(turns).toBeGreaterThanOrEqual(5);
    await settled(el);
    expect(el.getAnimations()).toHaveLength(0);
    expect(el.style.transform).toBe('');
  });

  it('pulses a colour only, within 150 ms, under reduced motion', () => {
    document.documentElement.dataset.motion = 'reduced';
    const el = box();
    const run = shake(el);
    expect([...properties(el)]).toEqual(['backgroundColor']);
    expect(Number(run?.effect?.getComputedTiming().duration)).toBeLessThanOrEqual(150);
  });
});

describe('receivePulse (receive)', () => {
  it('swells about 10 % and settles back, leaving no transform', async () => {
    const el = box(40, 40);
    receivePulse(el);
    const frames = (el.getAnimations()[0]?.effect as KeyframeEffect).getKeyframes();
    const scales = frames.map((k) => Number(/scale\(([\d.]+)/.exec(String(k.transform))?.[1]));
    expect(Math.max(...scales)).toBeGreaterThan(1.05);
    expect(Math.max(...scales)).toBeLessThan(1.16);
    expect(scales.at(-1)).toBe(1);
    await settled(el);
    await frame();
    expect(el.style.transform).toBe('');
    expect(el.style.willChange).toBe('');
  });

  it('holds the ring instead under reduced motion (no transform)', () => {
    document.documentElement.dataset.motion = 'reduced';
    const el = box(40, 40);
    receivePulse(el);
    expect(properties(el).has('transform')).toBe(false);
  });
});

describe('navPush (navigation push)', () => {
  it('slides the child in from the trailing side over its dimming, parallaxed parent', async () => {
    const host = box();
    const incoming = document.createElement('div');
    incoming.style.cssText = 'width:300px;height:80px';
    const outgoing = document.createElement('div');
    outgoing.style.cssText = 'position:absolute;inset:0';
    host.append(incoming, outgoing);
    navPush(incoming, outgoing, 1);
    const child = (incoming.getAnimations()[0]?.effect as KeyframeEffect).getKeyframes();
    const parent = (outgoing.getAnimations()[0]?.effect as KeyframeEffect).getKeyframes();
    expect(child[0]?.transform).toBe('translateX(300px)');
    expect(child.at(-1)?.transform).toBe('translateX(0px)');
    expect(parent[0]?.transform).toBe('translateX(0px)');
    expect(parent.at(-1)?.transform).toBe('translateX(-90px)');
    expect(Number(parent.at(-1)?.opacity)).toBeCloseTo(0.45);
    // The parent is clipped at the child's leading edge: at the end, all of it.
    expect(parent.at(-1)?.clipPath).toBe('inset(0px 210px 0px 0px)');
    // Within 1 % of its end by A-10's 500 ms: the frame nearest 500 ms is all but there.
    const at500 = child[Math.min(child.length - 1, 60)]?.transform;
    expect(Math.abs(Number(/(-?[\d.]+)px/.exec(String(at500))?.[1]))).toBeLessThan(3);
    await settled(incoming);
    await frame();
    expect(outgoing.isConnected).toBe(false);
    expect(incoming.getAnimations()).toHaveLength(0);
  });

  it('pops the other way: the parent comes back from 30 % and the child leaves', () => {
    const host = box();
    const incoming = document.createElement('div');
    incoming.style.cssText = 'width:300px;height:80px';
    const outgoing = document.createElement('div');
    host.append(incoming, outgoing);
    navPush(incoming, outgoing, -1);
    const parent = (incoming.getAnimations()[0]?.effect as KeyframeEffect).getKeyframes();
    const child = (outgoing.getAnimations()[0]?.effect as KeyframeEffect).getKeyframes();
    expect(parent[0]?.transform).toBe('translateX(-90px)');
    expect(child.at(-1)?.transform).toBe('translateX(300px)');
  });

  it('fades the incoming page only, within 150 ms, under reduced motion', () => {
    document.documentElement.dataset.motion = 'reduced';
    const incoming = box();
    const outgoing = box();
    navPush(incoming, outgoing, 1);
    expect(outgoing.isConnected).toBe(false);
    expect([...properties(incoming)]).toEqual(['opacity']);
    for (const a of incoming.getAnimations()) {
      expect(Number(a.effect?.getComputedTiming().duration)).toBeLessThanOrEqual(150);
    }
  });
});

describe('disclose (disclosure)', () => {
  it('grows height and padding together from 0, fading the content in, then clears', async () => {
    const el = box(300, 0);
    el.style.cssText = 'position:fixed;width:300px;padding:6px 0;box-sizing:border-box';
    el.innerHTML = '<div style="height:60px"></div>';
    disclose(el, true);
    const frames = (el.getAnimations()[0]?.effect as KeyframeEffect).getKeyframes();
    expect(frames[0]?.height).toBe('0px');
    expect(frames[0]?.paddingTop).toBe('0px');
    expect(Number(frames[0]?.opacity)).toBe(0);
    expect(frames.at(-1)?.height).toBe('72px');
    expect(frames.at(-1)?.paddingTop).toBe('6px');
    expect(el.style.overflow).toBe('clip');
    await settled(el);
    await frame();
    expect(el.style.overflow).toBe('');
    expect(el.getAnimations()).toHaveLength(0);
  });

  it('reverses from where it is, and reports the fold once closed', async () => {
    const el = box(300, 0);
    el.style.cssText = 'position:fixed;width:300px';
    el.innerHTML = '<div style="height:60px"></div>';
    disclose(el, true);
    for (let i = 0; i < 6; i++) await frame();
    let closed = false;
    disclose(el, false, () => {
      closed = true;
    });
    const frames = (el.getAnimations()[0]?.effect as KeyframeEffect).getKeyframes();
    const start = parseFloat(String(frames[0]?.height));
    expect(start).toBeGreaterThan(0);
    expect(start).toBeLessThan(60);
    expect(frames.at(-1)?.height).toBe('0px');
    await settled(el);
    await frame();
    expect(closed).toBe(true);
  });

  it('only fades, within 150 ms, under reduced motion', () => {
    document.documentElement.dataset.motion = 'reduced';
    const el = box();
    disclose(el, true);
    expect([...properties(el)]).toEqual(['opacity']);
    expect(Number(el.getAnimations()[0]?.effect?.getComputedTiming().duration)).toBeLessThanOrEqual(
      150,
    );
  });
});
