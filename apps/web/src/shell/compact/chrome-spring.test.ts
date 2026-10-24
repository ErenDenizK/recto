/**
 * The phone chrome's scroll spring (MOT-16, `chrome-spring.ts`): the step a scroll's speed picks,
 * the curves' shape (slow without bounce, a fling with its small overshoot), and the stylesheet's
 * four steps as `chromeCurve()` writes them.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { chromeCurve, springChrome, springStep, STEP_SPEEDS } from './chrome-spring';
import '../../styles/tokens.css';
import '../../styles/motion.css';
import '../../styles/materials.css';
import css from './CompactChrome.module.css?raw';
import styles from './CompactChrome.module.css';

/** The stops of a `linear()` curve, as numbers. */
const stops = (easing: string) =>
  [...easing.matchAll(/(-?[\d.]+)(?: [\d.]+%)?[,)]/g)].map((m) => Number(m[1]));

const flat = (s: string) => s.replace(/\s+/g, ' ').replace(/\( /g, '(').replace(/ \)/g, ')');

afterEach(() => {
  vi.useRealTimers();
  delete document.documentElement.dataset.chromeSpring;
  document.body.replaceChildren();
});

describe('the chrome’s scroll spring (MOT-16)', () => {
  it('picks a step from the scroll’s speed', () => {
    expect([0, 299, 300, 899, 900, 1799, 1800, 9000].map(springStep)).toEqual([
      0, 0, 1, 1, 2, 2, 3, 3,
    ]);
  });

  it('eases a slow scroll away without bounce, and sends a fling off with a small overshoot', () => {
    const slow = chromeCurve(STEP_SPEEDS[0]);
    const fling = chromeCurve(STEP_SPEEDS[3]);
    expect(Math.max(...stops(slow.easing))).toBe(1);
    expect(slow.ms).toBeGreaterThan(800);
    const peak = Math.max(...stops(fling.easing));
    expect(peak).toBeGreaterThan(1.01);
    expect(peak).toBeLessThan(1.06);
    expect(fling.ms).toBeLessThan(slow.ms);
    // It starts at the scroll's speed: a fling covers more of the way in its first tenth.
    const early = (easing: string) => stops(easing)[2] ?? 0;
    expect(early(fling.easing)).toBeGreaterThan(early(slow.easing));
  });

  it('holds the stylesheet to the four steps’ curves', () => {
    const sheet = flat(css);
    for (const [step, speed] of STEP_SPEEDS.entries()) {
      const { easing, ms } = chromeCurve(speed);
      const rule = `:global(:root[data-chrome-spring='${step}']:not([data-motion='reduced'])) [data-compact-chrome] { --hide-ms: ${ms}ms; --hide-ease: ${easing};`;
      expect(sheet).toContain(flat(rule));
    }
  });

  it('marks the step on the root for one move, and lets it go', () => {
    vi.useFakeTimers();
    springChrome(-2000);
    expect(document.documentElement.dataset.chromeSpring).toBe('3');
    vi.advanceTimersByTime(1000);
    expect(document.documentElement.dataset.chromeSpring).toBeUndefined();
  });

  it('keeps the capsule’s spring while its glass settles after the edit morph', () => {
    // `glassSettle()` (ui/glass-moving.ts) marks the capsule for a moment once the ✎ morph
    // rests; a scroll then must still move it on the spring its speed picked, not snap it.
    document.documentElement.dataset.chromeSpring = '0';
    for (const name of ['capsule', 'edit'] as const) {
      const el = document.createElement(name === 'capsule' ? 'nav' : 'button');
      el.className = `${styles[name]} mat mat-glass`;
      el.dataset.compactChrome = '';
      el.dataset.glassSettle = '';
      document.body.append(el);
      const style = getComputedStyle(el);
      const names = style.transitionProperty.split(',').map((n) => n.trim());
      const at = names.lastIndexOf('transform');
      expect(at, `${name}: ${style.transitionProperty}`).toBeGreaterThanOrEqual(0);
      expect(style.transitionDuration.split(',')[at]?.trim()).toBe('0.9s');
      expect(names).toContain('box-shadow');
    }
  });
});
