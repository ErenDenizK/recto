/**
 * `materials.css` and the rules around it (components/09-primitives.md §26; language.md §2.3,
 * §2.5, §10.2; quality-bar Q-1; docs/specs/redesign.md D0-1, D3-3).
 *
 * - **Generated.** The committed file is what `tooling/materials.ts` writes from the coverage
 *   registry and the tier tokens (whitespace folded: Biome formats it), so a registry entry, a
 *   tier's chain and the CSS cannot drift.
 * - **Q-1, no grain.** Glass is smooth at every tier: no `background` or `background-image`
 *   with `url(` or `image-set(` in any `.mat*` rule or in a module rule that composes one, and
 *   no `feTurbulence` anywhere in `src/` (the aurora's in-shader dither, AU-3, is the one
 *   dither Recto has). The concept prototype's glass read as dirty because its sheets carried a
 *   128 px noise tile scaled up on HiDPI screens.
 * - **The `.glass*` rules are gone** (D3-3's acceptance): no `.glass`, `.glass-menu` or
 *   `.glass-frame` rule or composition is left.
 * - **Lit glass stays off the page** (language.md §10.2): no module under `stage/`, `viewer/` or
 *   `pages/` composes `mat-lit` or reads the lit module.
 * - **Material classes come from CSS modules or `ui/Surface`**: no other script writes a `mat-`
 *   class (09 §26).
 */
import { describe, expect, it } from 'vitest';

import { COVERAGE_REGISTRY } from './coverage-registry';
import globalCss from './global.css?raw';
import { materialsFrom } from './materials-css';
import materialsCss from './materials.css?raw';
import tokensCss from './tokens.css?raw';

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const fold = (css: string) => stripComments(css).replace(/\s+/g, '');

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

const modules = import.meta.glob<string>('../**/*.module.css', {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('materials.css (09-primitives §26, D3-3)', () => {
  it('is what the generator writes from the coverage registry and tokens.css', () => {
    expect(fold(materialsCss)).toBe(fold(materialsFrom(COVERAGE_REGISTRY, tokensCss)));
  });

  it('is imported by global.css, before the controls and the focus ring', () => {
    const css = stripComments(globalCss);
    const at = (file: string) => css.indexOf(`@import './${file}';`);
    expect(at('materials.css')).toBeGreaterThanOrEqual(0);
    expect(at('materials.css')).toBeLessThan(at('controls.css'));
    expect(at('controls.css')).toBeLessThan(at('focus.css'));
  });
});

describe('materials: no grain or raster texture (quality-bar Q-1)', () => {
  it('paints no raster on the material rules', () => {
    const materialRules = rules(materialsCss).filter((rule) => /\.mat[\w-]*\b/.test(rule.selector));
    expect(materialRules.length).toBeGreaterThan(10);
    for (const rule of materialRules) {
      for (const declaration of backgrounds(rule.body)) {
        expect(declaration, rule.selector).not.toMatch(RASTER);
      }
    }
  });

  it('paints no raster on any module rule that composes a material', () => {
    let composing = 0;
    for (const [file, source] of Object.entries(modules)) {
      for (const rule of rules(source)) {
        if (!/composes:\s*[^;]*\bmat[\w-]*[^;]*from global/.test(rule.body)) continue;
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
    expect(composing).toBeGreaterThan(25);
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

describe('the M8 glass classes are gone (D3-3)', () => {
  it('leaves no .glass, .glass-menu or .glass-frame rule in the global styles', () => {
    const globals = import.meta.glob<string>('./*.css', {
      query: '?raw',
      import: 'default',
      eager: true,
    });
    expect(Object.keys(globals).length).toBeGreaterThan(4);
    for (const [file, source] of Object.entries(globals)) {
      for (const rule of rules(source)) {
        expect(rule.selector, file).not.toMatch(/\.glass(?:-menu|-frame)?\b/);
      }
    }
  });

  it('leaves no module composing them, nor a selector reaching them', () => {
    for (const [file, source] of Object.entries(modules)) {
      const css = stripComments(source);
      expect(css, file).not.toMatch(/composes:[^;]*\bglass(?:-menu|-frame)?\b[^;]*from global/);
      expect(css, file).not.toMatch(/:global\([^)]*\.glass(?:-menu|-frame)?\b/);
    }
  });
});

describe('where materials come from (09 §26, language.md §10.2)', () => {
  const scripts = import.meta.glob<string>(
    ['../**/*.{ts,tsx}', '!../**/*.test.{ts,tsx}', '!../i18n/paraglide/**'],
    { query: '?raw', import: 'default', eager: true },
  );

  it('keeps lit glass out of the stage, the viewer and the pages', () => {
    for (const [file, source] of Object.entries({ ...modules, ...scripts })) {
      if (!/^\.\.\/(?:stage|viewer|pages)\//.test(file)) continue;
      expect(source, file).not.toMatch(/\bmat-lit\b|lit\.module\.css/);
    }
  });

  it('writes material classes in script only in ui/Surface (and the registry that names them)', () => {
    const allowed = ['ui/Surface.tsx', 'coverage-registry.ts', 'materials-css.ts'];
    expect(Object.keys(scripts).length).toBeGreaterThan(200);
    for (const [file, source] of Object.entries(scripts)) {
      if (allowed.some((end) => file.endsWith(end))) continue;
      // Comments may name the classes; code may not write them.
      const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      expect(/['"`]mat(?:-[a-z]+)?(?:\s|['"`])/.test(code), file).toBe(false);
    }
  });
});
