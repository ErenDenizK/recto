/**
 * The fonts in the Office package's rewritten `soffice.data` against the package NOTICE
 * (PRD-20, docs/research/conversion-2026-10/office-phase-2.md Lane C): every font file that is
 * served belongs to a family NOTICE lists with its licence, no dropped (GPL or size) family
 * stays, and every substitute in `fc_local.conf` is a family that stays. The file list comes from
 * the vendored `soffice.js` table when `fetch.ts` has written it (CI restores it); without it
 * the lock-only checks still run.
 */
/// <reference types="vite/client" />

import { describe, expect, it } from 'vitest';

import lockJson from '../office/office.lock.json';
import fcLocal from '../office/data/fc_local.conf?raw';
import noticeRaw from '../office/NOTICE.txt?raw';

// Tests run in the browser (Vitest browser mode), so the files come in through Vite.
const vendored = import.meta.glob<string>('../office/vendor/*/soffice.js', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const TRUETYPE = '/instdir/share/fonts/truetype/';
const OPEN_SYMBOL = '/instdir/program/resource/common/fonts/opens___.ttf';

interface Lock {
  directory: string;
  data: { drop: string[]; replace: Record<string, { file: string }> };
}

const lock = lockJson as unknown as Lock;
const notice = noticeRaw.replace(/\s+/g, ' ');
const kept = notice.slice(
  notice.indexOf('Fonts in soffice.data ---'),
  notice.indexOf('Fonts removed ---'),
);
const removed = notice.slice(
  notice.indexOf('Fonts removed ---'),
  notice.indexOf('Font substitution table (fc_local.conf) ---'),
);

/** Served font file name prefix → the family name NOTICE lists. */
const FAMILIES: readonly (readonly [prefix: string, family: string])[] = [
  ['Alef-', 'Alef'],
  ['AmiriQuran', 'Amiri Quran'],
  ['Amiri-', 'Amiri'],
  ['Caladea-', 'Caladea'],
  ['Carlito-', 'Carlito'],
  ['DavidLibre-', 'David Libre'],
  ['DejaVuMathTeXGyre', 'DejaVu Math TeX Gyre'],
  ['DejaVuSansCondensed', 'DejaVu Sans Condensed'],
  ['DejaVuSansMono', 'DejaVu Sans Mono'],
  ['DejaVuSans', 'DejaVu Sans'],
  ['DejaVuSerif', 'DejaVu Serif'],
  ['FrankRuhlHofshi-', 'Frank Ruhl Hofshi'],
  ['LiberationMono-', 'Liberation Mono'],
  ['LiberationSans-', 'Liberation Sans'],
  ['LiberationSerif-', 'Liberation Serif'],
  ['MiriamLibre-', 'Miriam Libre'],
  ['NotoKufiArabic-', 'Noto Kufi Arabic'],
  ['NotoNaskhArabic-', 'Noto Naskh Arabic'],
  ['NotoSans', 'Noto Sans'],
  ['NotoSerif', 'Noto Serif'],
  ['ReemKufi-', 'Reem Kufi'],
  ['Rubik-', 'Rubik'],
  ['Scheherazade-', 'Scheherazade'],
];

/** Family names of everything dropped; none may stay in the table or the kept list. */
const DROPPED = [
  'Linux Libertine',
  'Linux Biolinum',
  'Gentium',
  'DejaVu Serif Condensed',
  'DejaVu Sans ExtraLight',
  'Culmus',
  'Liberation Sans Narrow',
];

function familyOf(path: string): string {
  if (path === OPEN_SYMBOL || path.endsWith('/opens___.ttf')) return 'OpenSymbol';
  const name = path.slice(TRUETYPE.length);
  const hit = FAMILIES.find(([prefix]) => name.startsWith(prefix));
  if (hit === undefined) throw new Error(`${path}: no family in this test's table`);
  return hit[1];
}

/** The font files of the vendored, rewritten table, or null when `fetch.ts` has not run. */
function servedFonts(): string[] | null {
  const js = vendored[`../office/vendor/${lock.directory}/soffice.js`];
  if (js === undefined) return null;
  const names = [...js.matchAll(/\{filename:"([^"]*)",start:/g)].map((hit) => hit[1] ?? '');
  return names.filter(
    (name) => (name.startsWith(TRUETYPE) && /\.(ttf|otf)$/.test(name)) || name === OPEN_SYMBOL,
  );
}

describe('Office package fonts (PRD-20)', () => {
  it('drops only font files under the truetype folder, and nothing it replaces', () => {
    for (const path of lock.data.drop) {
      expect(path.startsWith(TRUETYPE), path).toBe(true);
      expect(/\.(ttf|otf)$/.test(path), path).toBe(true);
    }
    expect(Object.keys(lock.data.replace)).toEqual([`${TRUETYPE}fc_local.conf`]);
  });

  it('names every dropped family under "Fonts removed" and keeps none in the kept list', () => {
    for (const family of DROPPED) {
      expect(removed, family).toContain(family);
      expect(kept, family).not.toContain(family);
    }
  });

  it('substitutes only families that stay in the package', () => {
    const conf = fcLocal;
    const stay = new Set([...FAMILIES.map(([, family]) => family), 'OpenSymbol']);
    stay.add('DejaVu Sans Condensed');
    const targets = [...conf.matchAll(/<(?:prefer|accept)>\s*<family>([^<]+)<\/family>/g)].map(
      (hit) => hit[1] ?? '',
    );
    expect(targets.length).toBeGreaterThan(10);
    for (const target of targets) expect(stay.has(target), target).toBe(true);
    expect(conf).toContain('OpenSymbol');
    for (const family of DROPPED) {
      expect(conf.replace(/<!--[\s\S]*?-->/g, ''), family).not.toContain(family);
    }
  });

  it('lists every served font file in NOTICE, with no dropped family left', () => {
    const files = servedFonts();
    if (files === null) return; // fetch.ts has not written vendor/ here
    expect(files.length).toBeGreaterThan(50);
    const families = new Set(files.map(familyOf));
    for (const family of families) expect(kept, family).toContain(family);
    for (const dropped of lock.data.drop) expect(files, dropped).not.toContain(dropped);
    for (const file of files) {
      for (const family of DROPPED) {
        expect(file.replace(/[^A-Za-z]/g, ''), file).not.toMatch(
          new RegExp(family.replace(/[^A-Za-z]/g, ''), 'i'),
        );
      }
    }
    // The families kept in the test table are all served (a stale NOTICE entry fails here).
    for (const [, family] of FAMILIES) expect(families.has(family), family).toBe(true);
  });
});
