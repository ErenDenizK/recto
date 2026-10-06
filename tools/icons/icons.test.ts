/**
 * The icon pipeline (ADR-0027 §2.6; components/09-primitives.md §30; spec redesign §11.1 D3-6,
 * "Generator fails on an unknown name"): the checks run on a few hand-written SVGs, and the
 * committed manifest and generated module are checked against each other, so neither needs the
 * Phosphor package installed.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildIcons, type Manifest, type ReadSvg, renderModule, svgPaths } from './icons.ts';

const svg = (...paths: string[]) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor">${paths
    .map((d) => `<path d="${d}"/>`)
    .join('')}</svg>`;

const SET: Record<string, string> = {
  'regular/x': svg('M1,1Z'),
  'regular/cursor': svg('M2,2Z'),
  'fill/cursor-fill': svg('M3,3Z', 'M4,4Z'),
  'regular/eye-slash': svg('M5,5Z'),
  'fill/eye-slash-fill': svg('M6,6Z'),
  'regular/lonely': svg('M7,7Z'),
};
const read: ReadSvg = (weight, file) => SET[`${weight}/${file}`];
const manifest = (icons: Manifest['icons'], lucide: Manifest['lucide'] = {}): Manifest => ({
  source: { package: '@phosphor-icons/core', version: '2.1.1' },
  icons,
  lucide,
});

describe('svgPaths', () => {
  it('keeps every path of a 256-grid currentColor SVG', () => {
    expect(svgPaths(svg('M1,1Z', 'M2,2Z'))).toEqual(['M1,1Z', 'M2,2Z']);
  });

  it('refuses another grid, another element or an attribute it would drop', () => {
    expect(svgPaths(svg('M1Z').replace('0 0 256 256', '0 0 24 24'))).toMatch(/256-grid/);
    expect(svgPaths(svg('M1Z').replace('</svg>', '<circle r="2"/></svg>'))).toMatch(/more than/);
    expect(svgPaths(svg('M1Z').replace('"/>', '" opacity="0.2"/>'))).toMatch(/more than/);
  });
});

describe('buildIcons', () => {
  it('takes the regular weight, the fill twin when asked, and a renamed source', () => {
    const { icons, errors } = buildIcons(
      manifest(
        { x: {}, cursor: { fill: true }, redact: { from: 'eye-slash', fill: true } },
        { X: 'x', EyeOff: ['redact', 'x'] },
      ),
      read,
    );
    expect(errors).toEqual([]);
    expect(Object.fromEntries(icons)).toEqual({
      cursor: { r: ['M2,2Z'], f: ['M3,3Z', 'M4,4Z'] },
      redact: { r: ['M5,5Z'], f: ['M6,6Z'] },
      x: { r: ['M1,1Z'] },
    });
  });

  it('fails on an unknown name, a missing twin and a table entry with no icon, listing all', () => {
    const { errors } = buildIcons(
      manifest(
        { x: {}, 'not-in-phosphor': {}, lonely: { fill: true }, Bad_Name: { from: 'x' } },
        { MousePointer2: 'cursor' },
      ),
      read,
    );
    expect(errors).toEqual([
      '"Bad_Name": not a kebab-case app name',
      '"lonely": "lonely" has no fill twin (assets/fill/lonely-fill.svg)',
      '"not-in-phosphor": no Phosphor icon "not-in-phosphor" (assets/regular/not-in-phosphor.svg)',
      'lucide "MousePointer2" → "cursor": no such app icon',
    ]);
  });
});

describe('the committed manifest and module', () => {
  const committed = JSON.parse(
    readFileSync(join(import.meta.dirname, 'manifest.json'), 'utf8'),
  ) as Manifest;
  const generated = readFileSync(
    join(import.meta.dirname, '../../apps/web/src/ui/icons.generated.tsx'),
    'utf8',
  );

  it('generated every manifest icon, with a fill twin exactly where the manifest asks', () => {
    const table = generated.slice(generated.indexOf('export const ICONS'));
    const starts = [...table.matchAll(/^ {2}'?([a-z0-9-]+)'?: \{/gm)];
    const entries = starts.map((m, i) => ({
      name: m[1] ?? '',
      body: table.slice(m.index, starts[i + 1]?.index ?? table.length),
    }));
    expect(entries.map((e) => e.name)).toEqual(Object.keys(committed.icons).sort());
    for (const { name, body } of entries) {
      expect(body.includes('f: ['), name).toBe(committed.icons[name]?.fill === true);
    }
  });

  it('maps every Lucide name to an app icon', () => {
    const { errors } = buildIcons(committed, () => svg('M0Z'));
    expect(errors).toEqual([]);
  });

  it('renders a module that names every icon in its type', () => {
    const out = renderModule(committed, new Map([['x', { r: ['M1Z'] }]]));
    expect(out).toContain("export type IconName = 'x';");
    expect(out).toContain("'x': { r: ['M1Z'] },");
  });
});
