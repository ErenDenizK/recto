/**
 * Q-1, no grain (docs/design/redesign-2026-10/quality-bar.md; language.md §2.3, G-7 removed;
 * docs/specs/redesign.md D0-1): glass is smooth at every tier. The concept prototype's glass
 * read as dirty because its sheets carried a 128 px noise tile scaled up on HiDPI screens.
 *
 * - No glass rule paints a raster: no `background` or `background-image` with `url(` or
 *   `image-set(` on the global `.glass*` rules (today's material classes, the `.mat*` of
 *   09-primitives §26 once they land) or on any module rule that composes them.
 * - No `feTurbulence` anywhere in `src/`: no live noise, in CSS, SVG or script. (The aurora's
 *   in-shader dither of ±0.5 LSB, AU-3, is the one dither Recto has.)
 */
import { describe, expect, it } from 'vitest';

import globalCss from './global.css?raw';

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** A raster in a background value: a bitmap URL or an image set. */
const RASTER = /url\(|image-set\(/i;

interface Rule {
  readonly selector: string;
  readonly body: string;
}

function rules(css: string): Rule[] {
  return [...stripComments(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selector: (match[1] ?? '').trim().replace(/\s+/g, ' '),
    body: match[2] ?? '',
  }));
}

/** The background declarations of a rule body. */
function backgrounds(body: string): string[] {
  return [...body.matchAll(/(?:^|;)\s*(background(?:-image)?)\s*:\s*([^;]+)/g)].map(
    (match) => `${match[1]}: ${(match[2] ?? '').trim()}`,
  );
}

describe('materials: no grain or raster texture (quality-bar Q-1)', () => {
  it('paints no raster on the global glass rules', () => {
    const glassRules = rules(globalCss).filter((rule) =>
      /\.(?:glass|mat)(?:[\w-]*)\b/.test(rule.selector),
    );
    expect(glassRules.length).toBeGreaterThan(3);
    for (const rule of glassRules) {
      for (const declaration of backgrounds(rule.body)) {
        expect(declaration, rule.selector).not.toMatch(RASTER);
      }
    }
  });

  it('paints no raster on any module rule that composes the glass', () => {
    const modules = import.meta.glob<string>('../**/*.module.css', {
      query: '?raw',
      import: 'default',
      eager: true,
    });
    let composing = 0;
    for (const [file, source] of Object.entries(modules)) {
      for (const rule of rules(source)) {
        if (!/composes:\s*[^;]*\b(?:glass|mat)[\w-]*[^;]*from global/.test(rule.body)) continue;
        composing++;
        for (const declaration of backgrounds(rule.body)) {
          expect(declaration, `${file} ${rule.selector}`).not.toMatch(RASTER);
        }
        // Nor through a pseudo-element of the same class (the prototype's grain layer).
        const name = /^\.([\w-]+)$/.exec(rule.selector)?.[1];
        if (name === undefined) continue;
        for (const pseudo of rules(source).filter((r) =>
          new RegExp(`^\\.${name}(?:\\[[^\\]]*\\])*::?(?:before|after)$`).test(r.selector),
        )) {
          for (const declaration of backgrounds(pseudo.body)) {
            expect(declaration, `${file} ${pseudo.selector}`).not.toMatch(RASTER);
          }
        }
      }
    }
    expect(composing).toBeGreaterThan(15);
  });

  it('has no feTurbulence anywhere in src', () => {
    const sources = import.meta.glob<string>(
      ['../**/*.{ts,tsx,css,svg,html}', '!../**/*.test.{ts,tsx}', '!../i18n/paraglide/**'],
      { query: '?raw', import: 'default', eager: true },
    );
    expect(Object.keys(sources).length).toBeGreaterThan(200);
    for (const [file, source] of Object.entries(sources)) {
      expect(/feTurbulence/i.test(source), file).toBe(false);
    }
  });
});
