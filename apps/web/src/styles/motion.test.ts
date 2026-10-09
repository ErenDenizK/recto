/**
 * The motion tokens (language.md §7.1, §7.2, §7.5, §7.6; ADR-0026 §2 items 1, 2, 8, §3; spec
 * redesign D3-4): `motion.css` holds exactly the registered names, its curves and durations are
 * the analytic springs' (`springToLinear()`), its values are `motion/tokens.ts`'s, the reduced
 * forms are per token and the same for the system query and the setting, and every reduced-motion
 * rule anywhere in the app answers the setting too. The rendered half (computed styles) closes
 * the file: the setting really reaches the cascade.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { springs, springToLinear } from '../motion/springs';
import {
  DURATION_MS,
  ENTER_SCALE,
  EASE,
  EXIT_SCALE,
  MOTION_TOKENS,
  PRESS_SCALE,
  REDUCED_DURATION_MS,
  RISE_PX,
  SHEET_PUSH_PX,
  SPRING_CSS_MS,
  TOOLTIP_SCALE,
  VT_MS,
  VT_REDUCED_MS,
} from '../motion/tokens';
import motionCss from './motion.css?raw';
import tokensCss from './tokens.css?raw';

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const source = stripComments(motionCss);

function declarations(body: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const part of body.split(';')) {
    const match = /^\s*(--[\w-]+)\s*:\s*([\s\S]+?)\s*$/.exec(part);
    if (match?.[1] !== undefined && match[2] !== undefined) {
      map.set(
        match[1],
        match[2].replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')'),
      );
    }
  }
  return map;
}

/** §1: the first plain `:root { … }`. */
const free = declarations(/(?:^|\n):root\s*\{([^{}]*)\}/.exec(source)?.[1] ?? '');
const media = (query: string) =>
  declarations(
    new RegExp(
      `@media \\(${query.replace(/[()]/g, '\\$&')}\\)\\s*\\{\\s*:root\\s*\\{([^{}]*)\\}`,
    ).exec(source)?.[1] ?? '',
  );
const coarse = media('pointer: coarse), (any-pointer: coarse');
const reducedMedia = media('prefers-reduced-motion: reduce');
const reducedSetting = declarations(
  /:root\[data-motion='reduced'\]\s*\{([^{}]*)\}/.exec(source)?.[1] ?? '',
);

/** A token's value at rest, `var()`s resolved, with `over` laid on top (a settings block). */
function resolve(name: string, over = new Map<string, string>(), depth = 0): string {
  const value = over.get(name) ?? free.get(name);
  if (value === undefined) throw new Error(`motion.css does not define ${name}`);
  if (depth > 8) throw new Error(`var() cycle at ${name}`);
  return value.replace(/var\((--[\w-]+)\)/g, (_, inner: string) => resolve(inner, over, depth + 1));
}

const ms = (value: string) => Number(/^(-?[\d.]+)ms$/.exec(value)?.[1] ?? Number.NaN);

describe('motion.css (language.md §7)', () => {
  it('defines exactly the registered names, and tokens.css imports it before anything else', () => {
    expect([...free.keys()].sort()).toEqual([...MOTION_TOKENS].sort());
    expect(new Set(MOTION_TOKENS).size).toBe(MOTION_TOKENS.length);
    const body = stripComments(tokensCss).trim();
    expect(body.startsWith("@import './motion.css';")).toBe(true);
    // No motion token is defined twice: tokens.css leaves them to this file.
    for (const name of MOTION_TOKENS) {
      expect(stripComments(tokensCss), name).not.toMatch(new RegExp(`${name}\\s*:`));
    }
  });

  it('writes each spring as the analytic solution (springToLinear, §7.2)', () => {
    expect(resolve('--ease-spring')).toBe(springToLinear('quick').easing);
    expect(resolve('--ease-spring-fling')).toBe(springToLinear('fling').easing);
    expect(resolve('--ease-spring-pop')).toBe(springToLinear('pop').easing);
    for (const name of Object.keys(springs) as (keyof typeof springs)[]) {
      expect(ms(resolve(`--spring-${name}`)), name).toBe(springToLinear(name).duration);
      expect(SPRING_CSS_MS[name], name).toBe(springToLinear(name).duration);
    }
  });

  it('gives script the same values (motion/tokens.ts)', () => {
    for (const [name, value] of Object.entries(DURATION_MS)) {
      expect(ms(resolve(`--duration-${name}`)), name).toBe(value);
      expect(ms(resolve(`--duration-${name}`, reducedMedia)), name).toBe(
        REDUCED_DURATION_MS[name as keyof typeof REDUCED_DURATION_MS],
      );
    }
    expect(resolve('--ease-out')).toBe(EASE.out);
    expect(resolve('--ease-exit')).toBe(EASE.exit);
    expect(resolve('--ease-standard')).toBe(EASE.standard);
    expect(ms(resolve('--vt-duration'))).toBe(VT_MS);
    expect(ms(resolve('--vt-duration', reducedMedia))).toBe(VT_REDUCED_MS);
    expect(Number(resolve('--press-scale-mouse'))).toBe(PRESS_SCALE.mouse);
    expect(Number(resolve('--press-scale-touch'))).toBe(PRESS_SCALE.touch);
    expect(Number(resolve('--press-scale-large-mouse'))).toBe(PRESS_SCALE.largeMouse);
    expect(Number(resolve('--press-scale-large-touch'))).toBe(PRESS_SCALE.largeTouch);
    expect(Number(resolve('--enter-scale'))).toBe(ENTER_SCALE);
    expect(Number(resolve('--exit-scale'))).toBe(EXIT_SCALE);
    expect(Number(resolve('--tooltip-scale'))).toBe(TOOLTIP_SCALE);
    expect(resolve('--rise-distance')).toBe(`${RISE_PX}px`);
    expect(resolve('--motion-rise')).toBe(`translateY(${RISE_PX}px)`);
    expect(resolve('--sheet-push-distance')).toBe(`${SHEET_PUSH_PX}px`);
  });

  it('presses 0.97 / 0.94, and 0.98 / 0.96 on large surfaces (§7.3 press, 02.5)', () => {
    expect(resolve('--press-scale')).toBe('0.97');
    expect(resolve('--press-scale-large')).toBe('0.98');
    expect(resolve('--press-scale', coarse)).toBe('0.94');
    expect(resolve('--press-scale-large', coarse)).toBe('0.96');
  });

  it('keeps every token inside A-10: input-blocking ≤ 250 ms, View Transitions included', () => {
    expect(ms(resolve('--vt-duration'))).toBeLessThanOrEqual(250);
    // The eases are the durations themselves; the springs' limits are read on their 99 %
    // settle in springs.test.ts.
    expect(Math.max(...Object.values(DURATION_MS))).toBeLessThanOrEqual(500);
  });

  describe('reduced motion, per token (§7.5, §7.6)', () => {
    it('sets the same values for the system query and the Reduce motion setting', () => {
      expect(reducedSetting.size).toBeGreaterThan(0);
      expect([...reducedSetting.entries()].sort()).toEqual([...reducedMedia.entries()].sort());
    });

    it('makes spatial springs instant, fling and pop included (no overshoot)', () => {
      for (const name of Object.keys(springs)) {
        expect(resolve(`--spring-${name}`, reducedMedia), name).toBe('0ms');
      }
    });

    it('keeps fades, 0 · 100 · 150 · 150 ms, never over 150 ms (A-9)', () => {
      expect(
        Object.keys(DURATION_MS).map((name) => ms(resolve(`--duration-${name}`, reducedMedia))),
      ).toEqual([0, 100, 150, 150]);
      expect(ms(resolve('--vt-duration', reducedMedia))).toBe(150);
    });

    it('rests the rise, the entrances, the sheet push and the press (colour change only)', () => {
      expect(resolve('--rise-distance', reducedMedia)).toBe('0px');
      expect(resolve('--motion-rise', reducedMedia)).toBe('translateY(0px)');
      expect(resolve('--enter-scale', reducedMedia)).toBe('1');
      expect(resolve('--exit-scale', reducedMedia)).toBe('1');
      expect(resolve('--tooltip-scale', reducedMedia)).toBe('1');
      expect(resolve('--sheet-push-distance', reducedMedia)).toBe('0px');
      expect(resolve('--press-scale', reducedMedia)).toBe('1');
      expect(resolve('--press-scale-large', reducedMedia)).toBe('1');
      // A finger is no exception: the reduced block comes after the coarse one.
      expect(source.search(/@media \(prefers-reduced-motion/)).toBeGreaterThan(
        source.search(/@media \(pointer: coarse\)/),
      );
      expect(resolve('--press-scale', new Map([...coarse, ...reducedMedia]))).toBe('1');
    });

    it('takes every name off View Transitions under both paths, so only the root fades', () => {
      expect(source).toMatch(
        /@media \(prefers-reduced-motion: reduce\)\s*\{\s*:root body,\s*:root body \*\s*\{\s*view-transition-name: none !important;/,
      );
      expect(source).toMatch(
        /:root\[data-motion='reduced'\] body,\s*:root\[data-motion='reduced'\] body \*\s*\{\s*view-transition-name: none !important;/,
      );
    });
  });
});

describe('one source for reduced motion (ADR-0026 §3, ADR-0028 §3)', () => {
  const sources = import.meta.glob<string>(['../**/*.{css,ts,tsx}', '!../**/*.test.{ts,tsx}'], {
    query: '?raw',
    import: 'default',
    eager: true,
  });

  it('has no global "0.01 ms" rule left', () => {
    for (const [file, text] of Object.entries(sources)) {
      if (!file.endsWith('.css')) continue;
      expect(stripComments(text), file).not.toMatch(/0\.01ms\s*!important/);
    }
  });

  it('asks the motion module in script, never the media query itself', () => {
    const allowed = new Set(['../motion/reduced-motion.ts']);
    const offenders = Object.entries(sources)
      .filter(([file]) => /\.tsx?$/.test(file) && !allowed.has(file))
      .filter(([, text]) => /matchMedia\(\s*['"`]\(prefers-reduced-motion/.test(text))
      .map(([file]) => file);
    expect(offenders).toEqual([]);
  });

  /**
   * Every rule a stylesheet keeps for `prefers-reduced-motion` also answers the Reduce motion
   * setting (`[data-motion='reduced']`), so the setting is the system query's exact twin
   * (§7.6). Matched by the last class of each selector, its subject, so a twin may shorten a
   * selector (`.button:active` for `.button:active:not(…)`, `.dot` for `.swatch .dot`).
   */
  it('gives every reduced-motion rule its data-motion twin', () => {
    const missing: string[] = [];
    for (const [file, text] of Object.entries(sources)) {
      if (!file.endsWith('.css') || file.endsWith('/styles/motion.css')) continue;
      const css = stripComments(text);
      const twins = [...css.matchAll(/([^{}]*data-motion='reduced'[^{}]*)\{/g)].map((m) => m[1]);
      for (const block of css.matchAll(/@media[^{]*prefers-reduced-motion: reduce[^{]*\{/g)) {
        // The block's rules: from its brace to the matching one.
        let depth = 1;
        let i = (block.index ?? 0) + block[0].length;
        const start = i;
        while (depth > 0 && i < css.length) {
          if (css[i] === '{') depth++;
          else if (css[i] === '}') depth--;
          i++;
        }
        const inner = css.slice(start, i - 1);
        for (const rule of inner.matchAll(/([^{}]+)\{/g)) {
          for (const selector of (rule[1] ?? '').split(',')) {
            const lead = selector.match(/[.#][\w-]+/g)?.at(-1);
            if (!lead) continue;
            const twin = twins.some((t) => t?.includes(lead));
            if (!twin) missing.push(`${file}: ${selector.trim()}`);
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });
});

describe('the cascade (computed styles)', () => {
  afterEach(() => {
    delete document.documentElement.dataset.motion;
  });

  it('reduces every token under the setting, in the rendered styles', async () => {
    await import('./tokens.css');
    const root = document.documentElement;
    const read = (name: string) => getComputedStyle(root).getPropertyValue(name).trim();
    // The test browser runs without the reduced-motion preference.
    expect(read('--spring-quick')).toBe('420ms');
    expect(read('--duration-fast')).toBe('120ms');
    expect(read('--press-scale')).toMatch(/^0\.9[47]$/);
    root.dataset.motion = 'reduced';
    expect(read('--spring-quick')).toBe('0ms');
    expect(read('--duration-fast')).toBe('100ms');
    expect(read('--press-scale')).toBe('1');
    expect(read('--rise-distance')).toBe('0px');
    expect(read('--vt-duration')).toBe('150ms');
  });
});
