/**
 * The glass tokens as `tokens.css` writes them, for the pixel model (components/09-primitives.md
 * §28; docs/specs/redesign.md D3-1). `glass-pixels.spec.ts` computes what each surface must render
 * from the token source, never from a hard-coded colour, so D3's colour work can retune a tint,
 * a σ or a boost and the spec follows; a rendered surface that drifts from its tokens fails.
 *
 * Scopes, highest first: the Glass setting's block (Solid is today's
 * `:root[data-transparency='reduced']`; `[data-glass='solid']` and `[data-glass='tinted']` once
 * D3 writes them), the light theme's block when there is one, the dark theme block
 * (`:root, [data-theme='dark']`), then the theme-free `:root` block. `var()` is resolved
 * through the same chain, as the cascade does on the root.
 */
import { readFileSync } from 'node:fs';

import type { GlassComposition, GlassMode, RegistryEntry, Theme } from './harness';
import type { GlassStyle, Rgb } from './pixels';

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

const source = stripComments(
  readFileSync(new URL('../../src/styles/tokens.css', import.meta.url), 'utf8'),
);

type Scope = ReadonlyMap<string, string>;

function declarations(body: string): Scope {
  const map = new Map<string, string>();
  for (const part of body.split(';')) {
    const match = /^\s*(--[\w-]+)\s*:\s*([\s\S]+?)\s*$/.exec(part);
    if (match?.[1] !== undefined && match[2] !== undefined) {
      map.set(match[1], match[2].replace(/\s+/g, ' '));
    }
  }
  return map;
}

/** The custom properties of the first top-level rule whose selector matches `selector`. */
function block(selector: RegExp): Scope | undefined {
  for (const match of source.matchAll(/(^|[{};])\s*([^{};@]+?)\s*\{([^{}]*)\}/g)) {
    const prelude = (match[2] ?? '').replace(/\s+/g, ' ');
    if (selector.test(prelude)) return declarations(match[3] ?? '');
  }
  return undefined;
}

const DARK = block(/^:root, \[data-theme='dark'\]$/);
const THEME_FREE = block(/^:root$/);
const LIGHT = block(/^(?::root)?\[data-theme='light'\]$/);
const SOLID =
  block(/^:root\[data-glass='solid'\]$/) ?? block(/^:root\[data-transparency='reduced'\]$/);
const TINTED = block(/^:root\[data-glass='tinted'\]$/);

if (!DARK || !SOLID) {
  throw new Error('tokens.css has no dark theme block or no Solid block where the spec looks');
}

/** The themes `tokens.css` defines: dark always, light once D3 adds its block. */
export const TOKEN_THEMES: readonly Theme[] = LIGHT ? ['dark', 'light'] : ['dark'];

/** The Glass settings `tokens.css` defines: Clear and Solid today, Tinted once D3 adds it. */
export const TOKEN_GLASS_MODES: readonly GlassMode[] = TINTED
  ? ['clear', 'tinted', 'solid']
  : ['clear', 'solid'];

function scopes(theme: Theme, glass: GlassMode): Scope[] {
  const chain: (Scope | undefined)[] = [
    glass === 'solid' ? SOLID : glass === 'tinted' ? TINTED : undefined,
    theme === 'light' ? LIGHT : undefined,
    DARK,
    THEME_FREE,
  ];
  return chain.filter((scope): scope is Scope => scope !== undefined);
}

/** A token's value in `theme` under the Glass setting `glass`, every `var()` resolved. */
export function tokenValue(name: string, theme: Theme, glass: GlassMode): string {
  const chain = scopes(theme, glass);
  const resolve = (token: string, depth: number): string => {
    if (depth > 12) throw new Error(`var() cycle at ${token}`);
    const value = chain.find((scope) => scope.has(token))?.get(token);
    if (value === undefined) throw new Error(`tokens.css does not define ${token}`);
    return value.replace(/var\((--[\w-]+)\)/g, (_, inner: string) => resolve(inner, depth + 1));
  };
  return resolve(name, 0);
}

/** An opaque token colour (`#rrggbb` or `rgb(r g b)`). */
export function tokenColour(name: string, theme: Theme, glass: GlassMode = 'clear'): Rgb {
  const value = tokenValue(name, theme, glass).trim();
  const hex = /^#([0-9a-f]{6})$/i.exec(value)?.[1];
  if (hex !== undefined) {
    const n = Number.parseInt(hex, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgb = /^rgb\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/.exec(value);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  throw new Error(`${name} is not an opaque colour: ${value}`);
}

/**
 * The tint token each composition paints (`styles/global.css`): `.glass` paints `--glass`,
 * `.glass-menu` points it at `--glass-menu`, the docked frame paints `--glass-frame` while
 * "Glass panels" is on. Each Solid block maps the tint to its solid token, so Solid needs no case
 * of its own.
 */
const TINT: Record<GlassComposition, string> = {
  glass: '--glass',
  'glass glass-menu': '--glass-menu',
  'glass-frame': '--glass-frame',
};

/** What an entry paints, by its tokens: its tint and its own filter token. */
export function tokenGlass(entry: RegistryEntry, theme: Theme, glass: GlassMode): GlassStyle {
  return {
    background: tokenValue(TINT[entry.composes], theme, glass),
    backdropFilter: tokenValue(entry.filter, theme, glass),
  };
}
