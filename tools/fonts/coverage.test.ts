/**
 * The committed 'Inter Recto' files cover what the UI shows (09-primitives §29, redesign §11.1
 * D3-5: "Font coverage test (EN, TR); 98 KB"): every character of the English and Turkish
 * catalogs, the Turkish letters and the keycaps, in files that stay within the ADR's budget
 * (ADR-0027 §2.1), carry both axes, are what `subset.sh` cut (SHA256SUMS), and are declared in
 * `fonts.css` with a `unicode-range` equal to their own cmap.
 *
 * The files are read as they ship: WOFF2's brotli stream is unpacked with Node's zlib and only
 * the untransformed `cmap` and `fvar` tables are parsed, so no font library is needed.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { brotliDecompressSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..');
const FONTS = join(ROOT, 'apps/web/public/fonts');
const LATIN = 'inter-recto-latin.woff2';
const LATIN_EXT = 'inter-recto-latin-ext.woff2';
const FILES = [LATIN, LATIN_EXT, 'recto-signature-latin.woff2', 'recto-signature-latin-ext.woff2'];

/** WOFF2's known-table index (WOFF2 §5.1), as far as the tables read here. */
const KNOWN_TAGS: Record<number, string> = { 0: 'cmap', 10: 'glyf', 11: 'loca', 47: 'fvar' };

function base128(bytes: Buffer, at: { offset: number }): number {
  let value = 0;
  for (let i = 0; i < 5; i++) {
    const byte = bytes[at.offset++] ?? 0;
    value = value * 128 + (byte & 0x7f);
    if ((byte & 0x80) === 0) return value;
  }
  throw new Error('bad UIntBase128');
}

/** The decompressed bytes of each table, by tag. */
function woff2Tables(file: Buffer): Map<string, Buffer> {
  expect(file.toString('latin1', 0, 4)).toBe('wOF2');
  const numTables = file.readUInt16BE(12);
  const compressedSize = file.readUInt32BE(20);
  const at = { offset: 48 };
  const entries: { tag: string; length: number }[] = [];
  for (let i = 0; i < numTables; i++) {
    const flags = file[at.offset++] ?? 0;
    const index = flags & 0x3f;
    let tag = KNOWN_TAGS[index] ?? `#${index}`;
    if (index === 63) {
      tag = file.toString('latin1', at.offset, at.offset + 4);
      at.offset += 4;
    }
    const version = flags >> 6;
    const length = base128(file, at);
    const glyfOrLoca = index === 10 || index === 11;
    const transformed = glyfOrLoca ? version !== 3 : version !== 0;
    entries.push({ tag, length: transformed ? base128(file, at) : length });
  }
  const data = brotliDecompressSync(file.subarray(at.offset, at.offset + compressedSize));
  const tables = new Map<string, Buffer>();
  let offset = 0;
  for (const { tag, length } of entries) {
    tables.set(tag, data.subarray(offset, offset + length));
    offset += length;
  }
  return tables;
}

/** Code points mapped to a glyph other than .notdef, from a format 4 or 12 Unicode subtable. */
function cmapCodePoints(cmap: Buffer): Set<number> {
  const records = [];
  for (let i = 0; i < cmap.readUInt16BE(2); i++) {
    const at = 4 + i * 8;
    records.push({
      platform: cmap.readUInt16BE(at),
      encoding: cmap.readUInt16BE(at + 2),
      offset: cmap.readUInt32BE(at + 4),
    });
  }
  const points = new Set<number>();
  const full = records.find((r) => r.platform === 3 && r.encoding === 10);
  if (full && cmap.readUInt16BE(full.offset) === 12) {
    const groups = cmap.readUInt32BE(full.offset + 12);
    for (let g = 0; g < groups; g++) {
      const at = full.offset + 16 + g * 12;
      const start = cmap.readUInt32BE(at);
      const end = cmap.readUInt32BE(at + 4);
      const glyph = cmap.readUInt32BE(at + 8);
      for (let c = start; c <= end; c++) if (glyph + (c - start) !== 0) points.add(c);
    }
    return points;
  }
  const bmp = records.find((r) => r.platform === 3 && r.encoding === 1);
  if (!bmp || cmap.readUInt16BE(bmp.offset) !== 4) throw new Error('no Unicode cmap');
  const segments = cmap.readUInt16BE(bmp.offset + 6) / 2;
  const ends = bmp.offset + 14;
  const starts = ends + segments * 2 + 2;
  const deltas = starts + segments * 2;
  const rangeOffsets = deltas + segments * 2;
  for (let s = 0; s < segments; s++) {
    const end = cmap.readUInt16BE(ends + s * 2);
    const start = cmap.readUInt16BE(starts + s * 2);
    const delta = cmap.readInt16BE(deltas + s * 2);
    const rangeOffset = cmap.readUInt16BE(rangeOffsets + s * 2);
    for (let c = start; c <= end && c !== 0xffff; c++) {
      let glyph: number;
      if (rangeOffset === 0) glyph = (c + delta) & 0xffff;
      else {
        const at = rangeOffsets + s * 2 + rangeOffset + (c - start) * 2;
        glyph = cmap.readUInt16BE(at);
        if (glyph !== 0) glyph = (glyph + delta) & 0xffff;
      }
      if (glyph !== 0) points.add(c);
    }
  }
  return points;
}

/** `fvar` axes as `tag min default max`. */
function axes(fvar: Buffer | undefined): string[] {
  if (!fvar) return [];
  const offset = fvar.readUInt16BE(4);
  const count = fvar.readUInt16BE(8);
  const size = fvar.readUInt16BE(10);
  const fixed = (at: number) => fvar.readInt32BE(at) / 65536;
  return Array.from({ length: count }, (_, i) => {
    const at = offset + i * size;
    const tag = fvar.toString('latin1', at, at + 4);
    return `${tag} ${fixed(at + 4)} ${fixed(at + 8)} ${fixed(at + 12)}`;
  });
}

const fonts = new Map(
  FILES.map((name) => {
    const bytes = readFileSync(join(FONTS, name));
    const tables = woff2Tables(bytes);
    const cmap = tables.get('cmap');
    if (!cmap) throw new Error(`${name} has no cmap`);
    return [name, { bytes, points: cmapCodePoints(cmap), axes: axes(tables.get('fvar')) }];
  }),
);
const font = (name: string) => {
  const entry = fonts.get(name);
  if (!entry) throw new Error(name);
  return entry;
};
const ui = new Set([...font(LATIN).points, ...font(LATIN_EXT).points]);

function catalogText(locale: 'en' | 'tr'): string {
  const catalog = JSON.parse(
    readFileSync(join(ROOT, `apps/web/messages/${locale}.json`), 'utf8'),
  ) as Record<string, unknown>;
  const parts: string[] = [];
  const walk = (value: unknown) => {
    if (typeof value === 'string') parts.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') Object.values(value).forEach(walk);
  };
  for (const [key, value] of Object.entries(catalog)) if (!key.startsWith('$')) walk(value);
  return parts.join('');
}

const missing = (text: string, points: Set<number>) =>
  [...new Set(text)]
    .filter((char) => !/\s/.test(char) || char === ' ')
    .filter((char) => !points.has(char.codePointAt(0) ?? 0))
    .map((char) => `${char} U+${(char.codePointAt(0) ?? 0).toString(16).toUpperCase()}`);

/** `unicode-range` of each @font-face in fonts.css, by file. */
function declaredRanges(): Map<string, Set<number>> {
  const css = readFileSync(join(ROOT, 'apps/web/src/styles/fonts.css'), 'utf8');
  const ranges = new Map<string, Set<number>>();
  for (const [, body] of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const file = /url\('\/fonts\/([^']+)'\)/.exec(body ?? '')?.[1];
    const range = /unicode-range:\s*([^;]+);/.exec(body ?? '')?.[1];
    if (!file || !range) continue;
    const points = new Set<number>();
    for (const part of range.split(',')) {
      const [first, last = first] = part.trim().replace('U+', '').split('-');
      for (let c = Number.parseInt(first ?? '', 16); c <= Number.parseInt(last ?? '', 16); c++) {
        points.add(c);
      }
    }
    ranges.set(file, points);
  }
  return ranges;
}

describe("'Inter Recto' coverage", () => {
  it.each(['en', 'tr'] as const)('covers every character of the %s catalog', (locale) => {
    expect(missing(catalogText(locale), ui)).toEqual([]);
  });

  it('covers the Turkish letters, ₺ and the Romanian comma-below letters', () => {
    expect(missing('İıŞşĞğÇçÖöÜüÂâÎîÛû₺ȘșȚț', ui)).toEqual([]);
  });

  it('carries the keycaps of commands/shortcuts.ts in the preloaded Latin file', () => {
    // ↵ ⇥ ⇧ ⌃ and the arrows (Issue 12). macOS's ⌘ ⌥ ⌫ ⌦ are in no Inter the subsetter can
    // read offline (tools/fonts/build.py); they are shown only on macOS, whose system face draws
    // them through the font stack.
    expect(
      missing(
        '↵⇥⇧⌃←→↑↓EscEnterTabSpaceDelBackspacePgUpPgDnHomeEndCtrlAltShiftWin',
        font(LATIN).points,
      ),
    ).toEqual([]);
  });

  it('keeps both axes in the UI files and none in the signature files', () => {
    for (const name of [LATIN, LATIN_EXT]) {
      expect(font(name).axes).toEqual(['opsz 14 14 32', 'wght 100 400 900']);
    }
    expect(font('recto-signature-latin.woff2').axes).toEqual([]);
  });

  it('stays within the budget of ADR-0027 (98 KB for the pair)', () => {
    const total = font(LATIN).bytes.length + font(LATIN_EXT).bytes.length;
    expect(total).toBeLessThanOrEqual(98 * 1024);
  });

  it('declares each file in fonts.css with its own cmap as the unicode-range', () => {
    const ranges = declaredRanges();
    for (const name of FILES) {
      expect([...(ranges.get(name) ?? [])].sort((a, b) => a - b)).toEqual(
        [...font(name).points].sort((a, b) => a - b),
      );
    }
  });

  it('ships the files subset.sh cut (SHA256SUMS)', () => {
    const sums = readFileSync(join(import.meta.dirname, 'SHA256SUMS'), 'utf8');
    for (const name of FILES) {
      const hash = createHash('sha256').update(font(name).bytes).digest('hex');
      expect(sums).toContain(`${hash}  ${name}`);
    }
  });

  it('is preloaded by index.html (Latin only; ADR-0027 §2.1)', () => {
    const html = readFileSync(join(ROOT, 'apps/web/index.html'), 'utf8');
    expect(html).toMatch(
      /<link\s+rel="preload"\s+href="%BASE_URL%fonts\/inter-recto-latin\.woff2"\s+as="font"\s+type="font\/woff2"\s+crossorigin/,
    );
    expect(html).not.toContain('inter-recto-latin-ext.woff2');
  });
});
