/**
 * `rewriteData` (PRD-20): drops and replaces entries of a `soffice.data` package and rewrites
 * the `loadPackage` table in `soffice.js` to match. Run on a small synthetic table, including
 * the minified exponent form (`24e3`) the real file uses.
 */
import { describe, expect, it } from 'vitest';

import { rewriteData, servedFonts } from '../src/office/data-rewrite';

const bytes = (text: string) => new TextEncoder().encode(text);
const text = (data: Uint8Array) => new TextDecoder().decode(data);

/** a: 3 bytes, b: 24000 bytes, c: 2 bytes, d: 4 bytes. */
function fixture(): { js: string; data: Uint8Array } {
  const parts = ['aaa', 'b'.repeat(24000), 'cc', 'dddd'];
  const names = [
    '/instdir/share/fonts/truetype/A.ttf',
    '/instdir/share/fonts/truetype/fc_local.conf',
    '/instdir/share/fonts/truetype/C.otf',
    '/instdir/share/other.txt',
  ];
  let at = 0;
  const entries = parts.map((part, i) => {
    const start = at;
    at += part.length;
    return `{filename:"${names[i]}",start:${start},end:${at}}`;
  });
  const js = `var x=1;loadPackage({files:[${entries.join(',')}],remote_package_size:${at}})})();`;
  return { js, data: bytes(parts.join('')) };
}

const spec = {
  drop: ['/instdir/share/fonts/truetype/A.ttf'],
  replace: { '/instdir/share/fonts/truetype/fc_local.conf': { file: 'x.conf', sha256: '' } },
};
const read = () => bytes('NEW');

describe('rewriteData', () => {
  it('keeps entry order and recomputes offsets and the size', () => {
    const { js, data } = fixture();
    const out = rewriteData(js, data, spec, read);
    expect(out.js).toContain(
      '{filename:"/instdir/share/fonts/truetype/fc_local.conf",start:0,end:3},' +
        '{filename:"/instdir/share/fonts/truetype/C.otf",start:3,end:5},' +
        '{filename:"/instdir/share/other.txt",start:5,end:9}],remote_package_size:9})',
    );
    expect(out.js).not.toContain('A.ttf');
    expect(text(out.data)).toBe('NEWccdddd');
    expect(out.js.startsWith('var x=1;loadPackage({files:[')).toBe(true);
    expect(out.js.endsWith('})})();')).toBe(true);
    expect(servedFonts(out.js)).toEqual(['/instdir/share/fonts/truetype/C.otf']);
  });

  it('accepts the minified exponent form for offsets and the package size', () => {
    const data = bytes('a'.repeat(24000));
    const js =
      'loadPackage({files:[{filename:"/p/x",start:0,end:12e3},' +
      '{filename:"/p/y",start:12e3,end:24e3}],remote_package_size:24e3})';
    const out = rewriteData(js, data, { drop: ['/p/x'], replace: {} }, read);
    expect(out.js).toBe(
      'loadPackage({files:[{filename:"/p/y",start:0,end:12000}],remote_package_size:12000})',
    );
    expect(out.data.length).toBe(12000);
  });

  it('throws unless the table occurs exactly once', () => {
    const { js, data } = fixture();
    expect(() => rewriteData('var nothing=1;', data, spec, read)).toThrow(/found 0 times/);
    expect(() => rewriteData(`${js}${js}`, data, spec, read)).toThrow(/found 2 times/);
  });

  it('throws on a mismatched size, a gap or an unknown path', () => {
    const { js, data } = fixture();
    expect(() => rewriteData(js, data.subarray(1), spec, read)).toThrow(/table says/);
    expect(() =>
      rewriteData(js, data, { drop: ['/instdir/missing.ttf'], replace: {} }, read),
    ).toThrow(/no entry/);
    expect(() => rewriteData(js.replace('start:3', 'start:4'), data, spec, read)).toThrow(
      /not contiguous/,
    );
  });
});
