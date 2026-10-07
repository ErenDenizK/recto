/**
 * `animate()` on the shared requestAnimationFrame loop and `animateStyle()` on Web Animations
 * (09-primitives §31; language.md §7.4–§7.5; quality-bar.md Q-2, Q-6, Q-10; MP-9; spec D0-12).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { animate, animateStyle } from './animate';
import { springs } from './springs';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The `translateY` of an element's rendered transform, from its computed matrix. */
const renderedY = (el: Element) => new DOMMatrix(getComputedStyle(el).transform).f;

function box(css = ''): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText = `position: absolute; left: 0; top: 0; width: 80px; height: 40px; ${css}`;
  document.body.append(el);
  return el;
}

afterEach(() => {
  delete document.documentElement.dataset.motion;
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('animate: numbers on one requestAnimationFrame loop', () => {
  it('springs to the target, ends exactly on it and completes once', async () => {
    const values: number[] = [];
    const onComplete = vi.fn();
    const motion = animate(0, 100, {
      spring: 'press',
      onUpdate: (value) => values.push(value),
      onComplete,
    });
    await motion.finished;
    expect(values.length).toBeGreaterThan(3);
    expect(values.at(-1)).toBe(100);
    // Zero bounce: no overshoot on the way.
    expect(values.every((value) => value >= 0 && value <= 100)).toBe(true);
    expect(onComplete).toHaveBeenCalledOnce();
    expect(motion.value).toBe(100);
    expect(motion.velocity).toBe(0);
  });

  it('retargets from the present position and velocity, with no jump and no restart', async () => {
    // Frames as drawn: the time each was computed at (the loop's clock), value and velocity.
    const samples: [time: number, value: number, velocity: number][] = [];
    const motion = animate(0, 400, {
      spring: 'glide',
      onUpdate: (value, velocity) => samples.push([performance.now(), value, velocity]),
    });
    await wait(100);
    const t1 = performance.now();
    const before = { value: motion.value, velocity: motion.velocity };
    motion.retarget(0);
    const after = { value: motion.value, velocity: motion.velocity };
    const dt = (performance.now() - t1) / 1000;
    // Moving forward fast when it is sent back.
    expect(before.velocity).toBeGreaterThan(300);
    // Continuous in position and velocity: they differ only by the motion in `dt`, bounded by
    // the spring's largest acceleration (k · 400 px + c · 2000 px/s), where a restart would drop
    // the velocity to zero.
    expect(Math.abs(after.value - before.value)).toBeLessThan(2000 * dt + 0.5);
    const maxAcceleration = springs.glide.stiffness * 400 + springs.glide.damping * 2000;
    expect(Math.abs(after.velocity - before.velocity)).toBeLessThan(maxAcceleration * dt + 1);
    // It carries its speed through the turn (research 18 §6.2): 8 ms later it is still further
    // along than where it was sent back (read analytically, so frame timing does not matter).
    const t2 = performance.now();
    while (performance.now() - t2 < 8);
    expect(motion.value).toBeGreaterThan(after.value);
    await motion.finished;
    expect(motion.value).toBe(0);
    // The drawn frames never jump: each step is within the fastest speed seen over its time.
    // The spring's true peak can fall between two drawn frames, a few per cent above the
    // fastest sampled one, so the bound carries 5 %; a jump would be many times over it.
    const fastest = Math.max(...samples.map(([, , velocity]) => Math.abs(velocity)));
    for (let i = 1; i < samples.length; i++) {
      const [ta, a] = samples[i - 1]!;
      const [tb, b] = samples[i]!;
      expect(Math.abs(b - a)).toBeLessThanOrEqual(fastest * 1.05 * ((tb - ta) / 1000) + 0.5);
    }
  });

  it('draws no frame at rest: the loop stops when nothing moves (Q-10)', async () => {
    const raf = vi.spyOn(window, 'requestAnimationFrame');
    await wait(50);
    expect(raf).not.toHaveBeenCalled();
    const motion = animate(0, 10, { spring: 'track' });
    await motion.finished;
    const settled = raf.mock.calls.length;
    expect(settled).toBeGreaterThan(1);
    await wait(150);
    expect(raf.mock.calls.length).toBe(settled);
  });

  it('runs several motions on one loop', async () => {
    const raf = vi.spyOn(window, 'requestAnimationFrame');
    const motions = [animate(0, 1, { spring: 'quick' }), animate(5, 9, { spring: 'pop' })];
    motions.push(animate(0, 3, { spring: 'track' }));
    expect(raf).toHaveBeenCalledOnce();
    await Promise.all(motions.map((motion) => motion.finished));
  });

  it("keeps one loop when a motion starts inside another one's onComplete", async () => {
    // Count the frames asked for but not yet run: one loop never has more than one pending. (Timing
    // gaps between steps would say the same, but a busy runner delivers frames back to back.)
    const native = window.requestAnimationFrame.bind(window);
    let pending = 0;
    let most = 0;
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      pending += 1;
      most = Math.max(most, pending);
      return native((time) => {
        pending -= 1;
        callback(time);
      });
    });
    let steps = 0;
    let chained: ReturnType<typeof animate<number>> | undefined;
    const first = animate(0, 1, {
      spring: 'quick',
      onComplete: () => {
        chained = animate(0, 100, { spring: 'track', onUpdate: () => (steps += 1) });
      },
    });
    await first.finished;
    await wait(150);
    chained?.stop();
    raf.mockRestore();
    expect(steps).toBeGreaterThan(3);
    expect(most).toBe(1);
  });

  it('stop() halts where it is and returns position and velocity for a gesture', async () => {
    const onUpdate = vi.fn();
    const onComplete = vi.fn();
    const motion = animate(0, 100, { spring: 'smooth', onUpdate, onComplete });
    await wait(80);
    const { value, velocity } = motion.stop();
    expect(value).toBeGreaterThan(0);
    expect(value).toBeLessThan(100);
    expect(velocity).toBeGreaterThan(0);
    await motion.finished;
    const calls = onUpdate.mock.calls.length;
    await wait(80);
    expect(onUpdate.mock.calls.length).toBe(calls);
    expect(onComplete).not.toHaveBeenCalled();
    expect(motion.value).toBe(value);
    expect(motion.velocity).toBe(0);
  });

  it('starts with a release velocity, and restarts after rest with a new `finished`', async () => {
    const onComplete = vi.fn();
    const motion = animate(0, 0, { spring: 'fling', velocity: 2000, onComplete });
    await wait(40);
    expect(motion.value).toBeGreaterThan(10);
    await motion.finished;
    const first = motion.finished;
    motion.retarget(50);
    expect(motion.finished).not.toBe(first);
    await motion.finished;
    expect(motion.value).toBe(50);
    expect(onComplete).toHaveBeenCalledTimes(2);
  });

  it('moves tuples together', async () => {
    const motion = animate([0, 0, 1], [10, -20, 0.5], { spring: 'quick' });
    await wait(60);
    const [x = 0, y = 0] = motion.value;
    expect(x).toBeGreaterThan(0);
    expect(y).toBeLessThan(0);
    await motion.finished;
    expect(motion.value).toEqual([10, -20, 0.5]);
  });

  it('is instant under reduced motion, before it returns (language.md §7.5)', () => {
    document.documentElement.dataset.motion = 'reduced';
    const values: number[] = [];
    const onComplete = vi.fn();
    const motion = animate(0, 100, {
      spring: 'glide',
      velocity: 3000,
      onUpdate: (value) => values.push(value),
      onComplete,
    });
    expect(values).toEqual([100]);
    expect(onComplete).toHaveBeenCalledOnce();
    expect(motion.value).toBe(100);
  });

  it('keeps a fade under reduced motion, within 150 ms or so (§7.5)', async () => {
    document.documentElement.dataset.motion = 'reduced';
    const onUpdate = vi.fn();
    const start = performance.now();
    const motion = animate(0, 1, { spring: 'glide', fade: true, onUpdate });
    expect(onUpdate).not.toHaveBeenCalled();
    await motion.finished;
    // The reduced fade ends within 150 ms; `glide` would take 680.
    expect(performance.now() - start).toBeLessThan(450);
    expect(onUpdate.mock.calls.length).toBeGreaterThan(1);
  });
});

describe('animateStyle: elements on Web Animations', () => {
  it('moves a transform and clears it and will-change at rest (Q-2)', async () => {
    const el = box();
    const motion = animateStyle(el, 'transform', [0, 40], [0, 0], { spring: 'glide' });
    expect(el.style.willChange).toBe('transform');
    expect(el.getAnimations()).toHaveLength(1);
    expect(renderedY(el)).toBeCloseTo(40, 0);
    await wait(60);
    expect(renderedY(el)).toBeGreaterThan(0);
    expect(renderedY(el)).toBeLessThan(40);
    await motion.finished;
    expect(el.style.transform).toBe('');
    expect(getComputedStyle(el).transform).toBe('none');
    expect(el.style.willChange).toBe('');
    expect(el.getAnimations()).toHaveLength(0);
    expect(document.getAnimations()).toHaveLength(0);
  });

  it('takes over a transform a drag left inline, with the release velocity', async () => {
    const el = box();
    el.style.transform = 'translate(0px, 120px)';
    const motion = animateStyle(el, 'transform', [0, 120], [0, 0], {
      spring: 'fling',
      velocity: [0, -1500],
    });
    await motion.finished;
    expect(el.style.transform).toBe('');
    expect(getComputedStyle(el).transform).toBe('none');
  });

  it('with `keep`, leaves the target inline (an exit that waits to unmount)', async () => {
    const el = box();
    const onComplete = vi.fn();
    const motion = animateStyle(el, 'opacity', 1, 0, { spring: 'quick', keep: true, onComplete });
    await motion.finished;
    expect(el.style.opacity).toBe('0');
    expect(onComplete).toHaveBeenCalledOnce();
    expect(el.getAnimations()).toHaveLength(0);
  });

  it('retargets from where it is on screen, keeping the velocity', async () => {
    const el = box();
    const motion = animateStyle(el, 'transform', [0, 0], [0, 600], { spring: 'glide' });
    await wait(100);
    const [, y1 = 0] = motion.value;
    const [, v1 = 0] = motion.velocity;
    const shown = renderedY(el);
    motion.retarget([0, 0]);
    const [, y2 = 0] = motion.value;
    const [, v2 = 0] = motion.velocity;
    expect(v1).toBeGreaterThan(300);
    expect(Math.abs(y2 - y1)).toBeLessThan(0.5);
    expect(Math.abs(v2 - v1)).toBeLessThan(1);
    expect(Math.abs(renderedY(el) - shown)).toBeLessThan(2);
    expect(el.getAnimations()).toHaveLength(1);
    await motion.finished;
    expect(getComputedStyle(el).transform).toBe('none');
  });

  it('stop() leaves the value it stopped at inline, for the gesture taking over', async () => {
    const el = box();
    const motion = animateStyle(el, 'transform', [0, 200], [0, 0], { spring: 'smooth' });
    await wait(60);
    const { value } = motion.stop();
    expect(el.getAnimations()).toHaveLength(0);
    expect(el.style.willChange).toBe('');
    expect(renderedY(el)).toBeCloseTo(value[1] ?? 0, 2);
  });

  it('moves a contained capsule’s own width and hands it back to its stylesheet (Q-6)', async () => {
    const style = document.createElement('style');
    style.textContent = '.capsule { width: 300px; contain: layout style; }';
    document.body.append(style);
    const el = box('width: auto;');
    el.className = 'capsule';
    el.style.removeProperty('width');
    const motion = animateStyle(el, 'width', 120, 300, { spring: 'smooth' });
    expect(el.getBoundingClientRect().width).toBeCloseTo(120, 0);
    await wait(80);
    const mid = el.getBoundingClientRect().width;
    expect(mid).toBeGreaterThan(120);
    expect(mid).toBeLessThan(300);
    // Width is not a compositor property: no will-change for it.
    expect(el.style.willChange).toBe('');
    await motion.finished;
    expect(el.style.width).toBe('');
    expect(el.getBoundingClientRect().width).toBe(300);
  });

  it('puts will-change on at most three elements at once (MP-9)', async () => {
    const els = Array.from({ length: 5 }, () => box());
    const motions = els.map((el) =>
      animateStyle(el, 'transform', [0, 30], [0, 0], { spring: 'quick' }),
    );
    expect(els.filter((el) => el.style.willChange === 'transform')).toHaveLength(3);
    await Promise.all(motions.map((motion) => motion.finished));
    expect(els.filter((el) => el.style.willChange !== '')).toHaveLength(0);
  });

  it('names both properties in will-change while both move', async () => {
    const el = box();
    const move = animateStyle(el, 'transform', [0, 8, 0.96], [0, 0, 1], { spring: 'quick' });
    const fade = animateStyle(el, 'opacity', 0, 1, { spring: 'press' });
    expect(el.style.willChange).toBe('transform, opacity');
    await Promise.all([move.finished, fade.finished]);
    expect(el.style.willChange).toBe('');
    expect(getComputedStyle(el).transform).toBe('none');
  });

  it('a second run on the same property stops the first where it is', async () => {
    const el = box();
    const first = animateStyle(el, 'transform', [0, 100], [0, 0], { spring: 'glide' });
    await wait(50);
    const second = animateStyle(el, 'transform', [0, 50], [0, 0], { spring: 'quick' });
    await first.finished;
    expect(el.getAnimations()).toHaveLength(1);
    await second.finished;
    expect(getComputedStyle(el).transform).toBe('none');
  });

  it('settles if its animation is cancelled from outside, and clears will-change', async () => {
    const el = box();
    const onComplete = vi.fn();
    const motion = animateStyle(el, 'transform', [0, 60], [0, 0], { spring: 'glide', onComplete });
    for (const animation of el.getAnimations()) animation.cancel();
    await motion.finished;
    expect(el.style.willChange).toBe('');
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('under reduced motion a transform jumps and a fade is kept short (§7.5)', async () => {
    document.documentElement.dataset.motion = 'reduced';
    const el = box();
    const move = animateStyle(el, 'transform', [0, 40], [0, 0], { spring: 'smooth' });
    expect(el.getAnimations()).toHaveLength(0);
    await move.finished;
    expect(getComputedStyle(el).transform).toBe('none');
    const fade = animateStyle(el, 'opacity', 0, 1, { spring: 'smooth' });
    const [animation] = el.getAnimations();
    expect(animation).toBeDefined();
    // A-9: a reduced fade lasts 150 ms at most (D3-4 shortened it from track's 158).
    expect(Number(animation!.effect!.getTiming().duration)).toBeLessThanOrEqual(150);
    await fade.finished;
    expect(el.style.opacity).toBe('');
  });
});
