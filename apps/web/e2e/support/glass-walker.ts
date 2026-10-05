/**
 * The quality-bar walker (docs/design/redesign-2026-10/quality-bar.md Q-1 to Q-5 and Q-11, as
 * D0-1 of docs/specs/redesign.md §11.1 carries them): finds every element whose computed
 * `backdrop-filter` is not `none` (the element itself or its `::before` / `::after`) and
 * checks what makes glass render the same on every engine.
 *
 * - **Q-3, one backdrop root.** No ancestor up to the root has `filter`, `opacity` below 1,
 *   `mask`, `clip-path`, `mix-blend-mode`, `backdrop-filter`, or a `will-change` naming one of
 *   them: each starts a new backdrop root, and the glass would blur only that ancestor.
 * - **Q-4, no glass in glass.** No glass element contains another.
 * - **Q-5, small parts never blur.** Rendered size at least 32 px in both directions.
 * - **Q-2, glass rests crisp.** At rest the element and every ancestor carry `transform: none`
 *   or a translation by whole device pixels (a fractional one puts the surface and its text
 *   between device pixels: the position must round, Q-2; at 2× a half CSS pixel is whole, as
 *   Floating UI rounds it), and the element has no `will-change`.
 * - **Q-11, the budget.** At most four visible surfaces at rest (six during a transition).
 * - **Q-8, text set once and sharp.** Every visible piece of text on a glass surface (an element
 *   with a text node of its own, or a text field) is at least 11 px, weighs 400, 500 or 600,
 *   and at rest sits under no scale between it and the glass (the glass and what is above it
 *   are Q-2's). Visually hidden text (a 1 px box) and SVG drawings are not text on glass.
 * - **A-2, coverage.** The surface's own σ (the `blur()` of its filter) meets
 *   `erf(h / 2√2σ) · erf(w / 2√2σ) ≥ 0.985` at its rendered size, the same rule
 *   `styles/tokens.test.ts` asserts for the coverage registry, checked here on what renders.
 *
 * "At rest" means after every finite animation and transition in the document has finished
 * (`document.getAnimations()`); infinite ones (spinners) are ignored.
 */
import { expect, type Page } from '@playwright/test';

/** The coverage floor of `language.md` §2.9 (A-2). */
export const MIN_COVERAGE = 0.985;
/** Q-5: the smallest side a glass surface may render at, CSS px. */
export const MIN_GLASS_SIDE = 32;
/** Q-11: visible backdrop-filter surfaces at rest, and during a transition. */
export const MAX_AT_REST = 4;
export const MAX_IN_TRANSITION = 6;
/** Q-8: the smallest text on glass, CSS px, and the weights of the type scale. */
export const MIN_TEXT_ON_GLASS = 11;
export const TEXT_WEIGHTS: readonly number[] = [400, 500, 600];

export type GlassRule = 'Q-2' | 'Q-3' | 'Q-4' | 'Q-5' | 'Q-8' | 'Q-11' | 'A-2';

export interface GlassSurface {
  /** `tag.class.class` (CSS-module hashes kept), with `::before` / `::after` when it is one. */
  readonly name: string;
  readonly width: number;
  readonly height: number;
  /** The `blur()` radius of its backdrop filter, CSS px (0 without one). */
  readonly sigma: number;
  /** Coverage at its rendered size (A-2). */
  readonly coverage: number;
  readonly visible: boolean;
  readonly filter: string;
}

export interface GlassViolation {
  readonly rule: GlassRule;
  readonly surface: string;
  readonly detail: string;
}

export interface GlassWalk {
  readonly surfaces: readonly GlassSurface[];
  /** How many surfaces are visible (Q-11 counts these). */
  readonly visible: number;
  readonly violations: readonly GlassViolation[];
  /** How many pieces of text on visible glass Q-8 read. */
  readonly texts: number;
}

export interface WalkOptions {
  /** Wait for animations to settle and apply the at-rest rules (Q-2, the at-rest count). */
  readonly atRest?: boolean;
  /** Longest wait for animations to finish, ms. */
  readonly settleTimeout?: number;
}

/** Waits until no finite animation or transition is running or pending in the document. */
export async function settleAnimations(page: Page, timeout = 5_000): Promise<void> {
  await page.waitForFunction(
    () =>
      document.getAnimations().every((animation) => {
        const iterations = animation.effect?.getTiming().iterations ?? 1;
        if (iterations === Number.POSITIVE_INFINITY) return true;
        return animation.playState !== 'running' && !animation.pending;
      }),
    undefined,
    { timeout },
  );
}

/** Walks every glass surface on the page and returns what it found, violations included. */
export async function walkGlass(page: Page, options: WalkOptions = {}): Promise<GlassWalk> {
  const atRest = options.atRest ?? true;
  if (atRest) {
    // A popup Base UI has just mounted sits in its starting style (opacity 0) for a frame
    // before its transition begins, with no animation yet to wait for; on a slow engine that
    // frame is long enough for the walk to find the menu unseen.
    await page.waitForFunction(() => document.querySelector('[data-starting-style]') === null, {
      timeout: options.settleTimeout ?? 5_000,
    });
    await settleAnimations(page, options.settleTimeout);
  }
  return page.evaluate(
    ({ atRest, minCoverage, minSide, maxAtRest, maxInTransition, minText, weights }) => {
      /** Abramowitz and Stegun 7.1.26 (|error| < 1.5e-7), enough for a 0.985 floor. */
      const erf = (x: number): number => {
        const sign = x < 0 ? -1 : 1;
        const t = 1 / (1 + 0.3275911 * Math.abs(x));
        const poly =
          t *
          (0.254829592 +
            t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
        return sign * (1 - poly * Math.exp(-x * x));
      };
      const coverage = (w: number, h: number, sigma: number): number =>
        sigma <= 0 ? 1 : erf(h / (2 * Math.SQRT2 * sigma)) * erf(w / (2 * Math.SQRT2 * sigma));

      const backdropOf = (style: CSSStyleDeclaration): string =>
        style.getPropertyValue('backdrop-filter') ||
        style.getPropertyValue('-webkit-backdrop-filter') ||
        'none';
      const describe = (el: Element, pseudo = ''): string => {
        const classes = [...el.classList].join('.');
        const id = el.id ? `#${el.id}` : '';
        return `${el.tagName.toLowerCase()}${id}${classes ? `.${classes}` : ''}${pseudo}`;
      };
      /** `none`, or a 2D translation by whole device pixels, is at rest (Q-2). */
      const restingTransform = (transform: string): boolean => {
        if (transform === 'none' || transform === '') return true;
        const m = /^matrix\(([^)]+)\)$/.exec(transform);
        if (!m?.[1]) return false;
        const [a, b, c, d, tx, ty] = m[1].split(',').map((v) => Number.parseFloat(v));
        const dpr = window.devicePixelRatio || 1;
        const whole = (v: number | undefined) =>
          v !== undefined && Math.abs(v * dpr - Math.round(v * dpr)) < 0.01;
        return a === 1 && b === 0 && c === 0 && d === 1 && whole(tx) && whole(ty);
      };
      /** What makes an element a backdrop root (Filter Effects 2), as Q-3 lists it. */
      const backdropRootCause = (style: CSSStyleDeclaration): string | undefined => {
        if (style.filter !== 'none' && style.filter !== '') return `filter: ${style.filter}`;
        if (Number.parseFloat(style.opacity) < 1) return `opacity: ${style.opacity}`;
        const mask =
          style.getPropertyValue('mask-image') || style.getPropertyValue('-webkit-mask-image');
        if (mask && mask !== 'none') return `mask-image: ${mask}`;
        if (style.clipPath !== 'none' && style.clipPath !== '') {
          return `clip-path: ${style.clipPath}`;
        }
        if (style.mixBlendMode !== 'normal' && style.mixBlendMode !== '') {
          return `mix-blend-mode: ${style.mixBlendMode}`;
        }
        const backdrop = backdropOf(style);
        if (backdrop !== 'none') return `backdrop-filter: ${backdrop}`;
        const willChange = style.willChange;
        if (/filter|opacity|mask|clip-path|mix-blend-mode/.test(willChange)) {
          return `will-change: ${willChange}`;
        }
        return undefined;
      };

      interface Found {
        readonly el: Element;
        readonly pseudo: '' | '::before' | '::after';
        readonly style: CSSStyleDeclaration;
      }
      const found: Found[] = [];
      for (const el of document.querySelectorAll('*')) {
        for (const pseudo of ['', '::before', '::after'] as const) {
          const style = getComputedStyle(el, pseudo || null);
          if (pseudo && (style.content === 'none' || style.content === 'normal')) continue;
          if (backdropOf(style) !== 'none') found.push({ el, pseudo, style });
        }
      }

      const violations: { rule: string; surface: string; detail: string }[] = [];
      const surfaces = found.map(({ el, pseudo, style }) => {
        const name = describe(el, pseudo);
        const filter = backdropOf(style);
        const rect = el.getBoundingClientRect();
        const visible =
          el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) &&
          rect.width > 0 &&
          rect.height > 0 &&
          rect.right > 0 &&
          rect.bottom > 0 &&
          rect.left < innerWidth &&
          rect.top < innerHeight;
        const sigma = Number.parseFloat(/blur\(([\d.]+)px\)/.exec(filter)?.[1] ?? '0');
        const c = coverage(rect.width, rect.height, sigma);

        if (visible) {
          // Q-5: only surfaces of at least 32 px both ways may be glass.
          if (rect.width < minSide || rect.height < minSide) {
            violations.push({
              rule: 'Q-5',
              surface: name,
              detail: `renders ${rect.width.toFixed(1)} × ${rect.height.toFixed(1)} px`,
            });
          }
          // A-2: coverage at the rendered size.
          if (c < minCoverage) {
            violations.push({
              rule: 'A-2',
              surface: name,
              detail: `c = ${c.toFixed(4)} at ${rect.width.toFixed(0)} × ${rect.height.toFixed(0)} px, σ ${sigma}`,
            });
          }
        }
        // Q-3: nothing between the glass and the root starts a backdrop root. A pseudo-element's
        // host is its first ancestor.
        for (let a = pseudo ? el : el.parentElement; a; a = a.parentElement) {
          const cause = backdropRootCause(getComputedStyle(a));
          if (cause) {
            violations.push({ rule: 'Q-3', surface: name, detail: `${describe(a)} has ${cause}` });
          }
        }
        // Q-4: no glass inside this one.
        for (const other of found) {
          if (other.el !== el && el.contains(other.el)) {
            violations.push({
              rule: 'Q-4',
              surface: name,
              detail: `contains ${describe(other.el, other.pseudo)}`,
            });
          }
        }
        // Q-2: crisp at rest.
        if (atRest && visible) {
          if (style.willChange !== 'auto') {
            violations.push({
              rule: 'Q-2',
              surface: name,
              detail: `will-change: ${style.willChange}`,
            });
          }
          if (!restingTransform(style.transform)) {
            violations.push({
              rule: 'Q-2',
              surface: name,
              detail: `transform: ${style.transform}`,
            });
          }
          for (let a = pseudo ? el : el.parentElement; a; a = a.parentElement) {
            const transform = getComputedStyle(a).transform;
            if (!restingTransform(transform)) {
              violations.push({
                rule: 'Q-2',
                surface: name,
                detail: `ancestor ${describe(a)} has transform: ${transform}`,
              });
            }
          }
        }
        return {
          name,
          width: Math.round(rect.width * 10) / 10,
          height: Math.round(rect.height * 10) / 10,
          sigma,
          coverage: Math.round(c * 10_000) / 10_000,
          visible,
          filter,
        };
      });

      // Q-8: the text on each visible glass surface.
      const TEXT_FIELD =
        'input:not([type="checkbox"], [type="radio"], [type="range"], [type="hidden"], [type="color"]), textarea, select';
      /** A scale (or anything but a 2D translation) in a computed transform. */
      const scaled = (transform: string): boolean => {
        if (transform === 'none' || transform === '') return false;
        const m = /^matrix\(([^)]+)\)$/.exec(transform);
        if (!m?.[1]) return true;
        const [a, b, c, d] = m[1].split(',').map((v) => Number.parseFloat(v));
        return a !== 1 || b !== 0 || c !== 0 || d !== 1;
      };
      /** Visually hidden: in, or itself, a clipped box of 1 px or less (`.visually-hidden`). */
      const hidden = (node: Element, glass: Element): boolean => {
        for (let a: Element | null = node; a && a !== glass; a = a.parentElement) {
          const box = a.getBoundingClientRect();
          if (box.width > 1 && box.height > 1) continue;
          if (a === node || getComputedStyle(a).overflow !== 'visible') return true;
        }
        return false;
      };
      let texts = 0;
      found.forEach(({ el, pseudo }, i) => {
        if (!surfaces[i]?.visible) return;
        const glass = surfaces[i].name;
        for (const node of [el, ...el.querySelectorAll('*')]) {
          if (node instanceof SVGElement) continue;
          const own = [...node.childNodes].some(
            (child) => child.nodeType === Node.TEXT_NODE && child.textContent?.trim(),
          );
          if (!own && !node.matches(TEXT_FIELD)) continue;
          if (!node.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
          if (hidden(node, el)) continue;
          texts += 1;
          const style = getComputedStyle(node);
          const text = (
            node.textContent?.trim() ||
            (node as HTMLInputElement).value ||
            node.tagName
          )
            .replace(/\s+/g, ' ')
            .slice(0, 32);
          const size = Number.parseFloat(style.fontSize);
          if (size < minText - 0.01) {
            violations.push({ rule: 'Q-8', surface: glass, detail: `"${text}" at ${size} px` });
          }
          const weight = Number.parseFloat(style.fontWeight);
          if (!weights.includes(weight)) {
            violations.push({
              rule: 'Q-8',
              surface: glass,
              detail: `"${text}" at weight ${weight}`,
            });
          }
          if (atRest) {
            // Between the text and the glass (a pseudo-element's glass is its host).
            const stop = pseudo ? el.parentElement : el;
            for (let a: Element | null = node; a && a !== stop; a = a.parentElement) {
              const transform = getComputedStyle(a).transform;
              if (a !== el && scaled(transform)) {
                violations.push({
                  rule: 'Q-8',
                  surface: glass,
                  detail: `"${text}" rests under ${describe(a)} with transform: ${transform}`,
                });
                break;
              }
            }
          }
        }
      });

      const visibleCount = surfaces.filter((s) => s.visible).length;
      const max = atRest ? maxAtRest : maxInTransition;
      if (visibleCount > max) {
        violations.push({
          rule: 'Q-11',
          surface: 'document',
          detail: `${visibleCount} visible glass surfaces (at most ${max} ${atRest ? 'at rest' : 'in a transition'}): ${surfaces
            .filter((s) => s.visible)
            .map((s) => s.name)
            .join(', ')}`,
        });
      }
      // One line per distinct finding (a table repeats its header's fault per group).
      const distinct = [
        ...new Map(violations.map((v) => [`${v.rule} ${v.surface} ${v.detail}`, v])).values(),
      ];
      return { surfaces, visible: visibleCount, violations: distinct, texts };
    },
    {
      atRest,
      minCoverage: MIN_COVERAGE,
      minSide: MIN_GLASS_SIDE,
      maxAtRest: MAX_AT_REST,
      maxInTransition: MAX_IN_TRANSITION,
      minText: MIN_TEXT_ON_GLASS,
      weights: TEXT_WEIGHTS,
    },
  ) as Promise<GlassWalk>;
}

/**
 * Walks the glass in the state the page is in and fails with every violation listed. Returns
 * the walk, so a spec can also assert on what it found (that a surface it expects is there).
 */
export async function expectGlassClean(
  page: Page,
  state: string,
  options: WalkOptions = {},
): Promise<GlassWalk> {
  const walk = await walkGlass(page, options);
  const lines = walk.violations.map((v) => `${v.rule} ${v.surface}: ${v.detail}`);
  expect(lines, `glass in ${state}`).toEqual([]);
  return walk;
}
