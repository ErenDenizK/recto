/**
 * The scale gate (system-audit-2026-10 §3.11 gate 1, beside `focus-scan.test.ts`): every style
 * sheet under `src/` keeps to the token scales, as `css-scale.ts` defines them, except what the
 * ratchet in `css-scale.allow.ts` still lists. The list holds each file's findings counted per
 * kind and must match exactly: a new literal fails, and so does a fixed one until its count
 * comes down, so the list only shrinks. A lane is done when it has no entry under its files.
 *
 * The token files themselves (`tokens.css`, `motion.css`, the generated `materials.css` and the
 * `@font-face` rules of `fonts.css`) define the scales and are not scanned.
 */
import { describe, expect, it } from 'vitest';

import { CSS_SCALE_ALLOW } from './css-scale.allow';
import { countScale, SCALE_KINDS, type ScaleKind, scanScale } from './css-scale';

const sheets = import.meta.glob<string>('../**/*.css', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const DEFINITIONS = new Set([
  'styles/tokens.css',
  'styles/motion.css',
  'styles/materials.css',
  'styles/fonts.css',
]);

/** Paths relative to `src/` (the glob names this folder's own sheets `./x.css`). */
const files = Object.entries(sheets)
  .map(
    ([path, css]) =>
      [
        path.startsWith('./') ? `styles/${path.slice(2)}` : path.replace(/^\.\.\//, ''),
        css,
      ] as const,
  )
  .filter(([file]) => !DEFINITIONS.has(file))
  .sort(([a], [b]) => a.localeCompare(b));

describe('the scale gate (system audit §3.11)', () => {
  it('reads the app’s style sheets', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('finds nothing off the scales beyond the ratchet, which only shrinks', () => {
    const actual: Record<string, Partial<Record<ScaleKind, number>>> = {};
    for (const [file, css] of files) {
      const counts = countScale(css);
      if (Object.keys(counts).length > 0) actual[file] = counts;
    }
    const mismatched = Object.keys({ ...actual, ...CSS_SCALE_ALLOW }).filter(
      (file) => JSON.stringify(actual[file] ?? {}) !== JSON.stringify(CSS_SCALE_ALLOW[file] ?? {}),
    );
    // What each mismatched file writes now, so a fix knows its new count and a new literal
    // names itself.
    const report = mismatched.map((file) => {
      const css = files.find(([name]) => name === file)?.[1] ?? '';
      const findings = scanScale(css).map(
        (f) => `  ${f.kind} · ${f.selector} { ${f.declaration} }`,
      );
      return `${file}: now ${JSON.stringify(actual[file] ?? {})}, listed ${JSON.stringify(CSS_SCALE_ALLOW[file] ?? {})}\n${findings.join('\n')}`;
    });
    expect(report).toEqual([]);
  });

  it('lists only files that exist, kinds in order, and no zero counts', () => {
    for (const [file, counts] of Object.entries(CSS_SCALE_ALLOW)) {
      expect(
        sheets[`../${file}`] ?? sheets[`./${file.replace(/^styles\//, '')}`],
        file,
      ).toBeDefined();
      const kinds = Object.keys(counts) as ScaleKind[];
      expect(kinds, file).toEqual(SCALE_KINDS.filter((kind) => kinds.includes(kind)));
      for (const kind of kinds) expect(counts[kind], `${file} ${kind}`).toBeGreaterThan(0);
    }
  });

  it('catches what it is for', () => {
    const kinds = (css: string) => scanScale(css).map((f) => f.kind);
    expect(kinds('.a { font-size: 13px; }')).toEqual(['font-size']);
    expect(kinds('.a { font-size: var(--type-body); }')).toEqual([]);
    expect(kinds('.a { border-radius: 10px; }')).toEqual(['radius']);
    expect(kinds('.a { border-radius: 50%; border-top-left-radius: 0; }')).toEqual([]);
    expect(kinds('.a { font-weight: 550; } .b { font-weight: 600; }')).toEqual(['weight']);
    expect(kinds('.a { transition: opacity 120ms ease; }')).toEqual(['duration']);
    expect(kinds('.a { transition: visibility 0s linear var(--duration-fast); }')).toEqual([]);
    expect(kinds('.a svg { width: 14px; height: 14px; }')).toEqual(['icon', 'icon']);
    expect(kinds('.a svg { width: 16px; } .badge svg { width: 12px; }')).toEqual([]);
    expect(kinds('.a svg { stroke-width: 1.75; }')).toEqual(['stroke']);
    expect(kinds('.a { text-transform: uppercase; }')).toEqual(['uppercase']);
    expect(kinds('.a { padding: 5px 8px; gap: 3px; margin: -1px; }')).toEqual([
      'spacing',
      'spacing',
    ]);
    expect(kinds('.a { padding: 6px var(--space-2); margin: 0 -2px; }')).toEqual([]);
    expect(kinds('.a { --own: 13px; }')).toEqual([]);
  });
});
