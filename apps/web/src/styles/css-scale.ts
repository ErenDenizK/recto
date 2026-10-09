/**
 * The scale scan (system-audit-2026-10 §3.11 gate 1; quality-bar Q-8, Q-9, Q-10): what a style
 * sheet writes by hand that the token scales of `tokens.css` and `motion.css` should carry.
 * `css-scale.test.ts` runs it over every module and holds the result to a ratchet, the
 * committed allow-list in `css-scale.allow.ts`, which may only shrink.
 *
 * Each finding has a kind:
 *
 * - `font-size`: a literal size (px, rem, em, pt); the type steps are `--type-*`, fields
 *   `--field-text`.
 * - `radius`: a literal `border-radius` other than 0 and 50 %; the radii are `--radius-*`.
 * - `weight`: a `font-weight` outside 400 · 500 · 600 (Q-8).
 * - `duration`: a literal time in a transition or an animation other than 0; the springs,
 *   eases and loops are `--spring-*`, `--duration-*` and `--loop-*` (Q-10).
 * - `icon`: an SVG drawn at a literal box outside 16, 20 and 32 (12 only in a badge); the
 *   icon steps are `--icon-*` (Q-9, §3.10).
 * - `stroke`: a `stroke-width` on a UI glyph: icons are Phosphor's filled outlines (§2.3).
 * - `uppercase`: `text-transform: uppercase`; section labels are sentence case (T-9).
 * - `spacing`: a padding, margin or gap off the 4 px grid and its 2 px half-step (an odd or
 *   fractional pixel count; a 1 px hairline nudge is allowed); the steps are `--space-*`.
 */

export type ScaleKind =
  | 'font-size'
  | 'radius'
  | 'weight'
  | 'duration'
  | 'icon'
  | 'stroke'
  | 'uppercase'
  | 'spacing';

export const SCALE_KINDS: readonly ScaleKind[] = [
  'font-size',
  'radius',
  'weight',
  'duration',
  'icon',
  'stroke',
  'uppercase',
  'spacing',
];

export interface ScaleFinding {
  readonly kind: ScaleKind;
  readonly selector: string;
  readonly declaration: string;
}

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** Innermost rules of a style sheet: an `@media` block's rules come out as plain rules. */
function rules(css: string): { selector: string; declarations: [string, string][] }[] {
  const found: { selector: string; declarations: [string, string][] }[] = [];
  for (const match of stripComments(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = (match[1] ?? '').trim().replace(/\s+/g, ' ');
    if (selector.startsWith('@font-face')) continue;
    const declarations: [string, string][] = [];
    for (const part of (match[2] ?? '').split(';')) {
      const decl = /^\s*([\w-]+)\s*:\s*([\s\S]+?)\s*$/.exec(part);
      if (decl?.[1] && decl[2]) declarations.push([decl[1], decl[2].replace(/\s+/g, ' ')]);
    }
    found.push({ selector, declarations });
  }
  return found;
}

const LENGTH = /(?<![\w.-])(-?\d*\.?\d+)(px|rem|em|pt)\b/g;
const TIME = /(?<![\w.-])(\d*\.?\d+)(ms|s)\b/g;
const SPACING = /^(padding|margin|gap|row-gap|column-gap)(-[\w-]+)?$/;
const ICON_STEPS = new Set([16, 20, 32]);

/** What one declaration writes off the scales. */
function kindsOf(selector: string, property: string, value: string): ScaleKind[] {
  const kinds: ScaleKind[] = [];
  const lengths = [...value.matchAll(LENGTH)].map((m) => ({
    n: Number(m[1]),
    unit: m[2] ?? '',
  }));
  if (property === 'font-size' && lengths.length > 0) kinds.push('font-size');
  if (/^border(-[\w]+)*-radius$/.test(property) && lengths.some((l) => l.n !== 0)) {
    kinds.push('radius');
  }
  if (property === 'font-weight' && !/^(400|500|600|inherit|var\(.*\))$/.test(value)) {
    kinds.push('weight');
  }
  if (/^(transition|animation)(-duration|-delay)?$/.test(property)) {
    if ([...value.matchAll(TIME)].some((m) => Number(m[1]) !== 0)) kinds.push('duration');
  }
  if (/(^|[\s>+~])svg(?![\w-])[^\s>+~]*$/.test(selector) && /^(width|height)$/.test(property)) {
    const badge = /badge/i.test(selector);
    if (lengths.some((l) => !(ICON_STEPS.has(l.n) || (badge && l.n === 12)))) kinds.push('icon');
  }
  if (property === 'stroke-width') kinds.push('stroke');
  if (property === 'text-transform' && value === 'uppercase') kinds.push('uppercase');
  if (SPACING.test(property)) {
    const off = lengths.some(
      (l) => l.unit === 'px' && Math.abs(l.n) !== 1 && (!Number.isInteger(l.n) || l.n % 2 !== 0),
    );
    if (off) kinds.push('spacing');
  }
  return kinds;
}

/** Every finding in one style sheet. */
export function scanScale(css: string): ScaleFinding[] {
  const found: ScaleFinding[] = [];
  for (const { selector, declarations } of rules(css)) {
    for (const [property, value] of declarations) {
      // A custom property is a module's own token: what reads it is what counts.
      if (property.startsWith('--')) continue;
      for (const kind of kindsOf(selector, property, value)) {
        found.push({ kind, selector, declaration: `${property}: ${value}` });
      }
    }
  }
  return found;
}

/** The findings of one sheet counted per kind, the shape of the allow-list. */
export function countScale(css: string): Partial<Record<ScaleKind, number>> {
  const found = scanScale(css);
  const counts: Partial<Record<ScaleKind, number>> = {};
  for (const kind of SCALE_KINDS) {
    const n = found.filter((f) => f.kind === kind).length;
    if (n > 0) counts[kind] = n;
  }
  return counts;
}
