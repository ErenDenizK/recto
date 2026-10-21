/**
 * The pure half of the r2 rewrite (PRD-20): applies the lock's `data` section to `soffice.data`
 * and the `loadPackage` table in `soffice.js`. No node imports, so the unit tests can run it.
 */

/** The `data` section of the lock (PRD-20): how `soffice.data` is rewritten. */
export interface DataRewrite {
  /** Served font files after the rewrite, in table order (written by `--pin`). */
  readonly fonts?: readonly string[];
  /** Exact in-package paths to remove. */
  readonly drop: readonly string[];
  /** In-package path → the committed file (relative to this folder) that replaces it. */
  readonly replace: Readonly<Record<string, { readonly file: string; readonly sha256: string }>>;
}

const TABLE_HEAD = 'loadPackage({files:[';
const TABLE_ENTRY = /\{filename:"([^"]*)",start:(\d+(?:e\d+)?),end:(\d+(?:e\d+)?)\}/y;
const TABLE_TAIL = /\],remote_package_size:(\d+(?:e\d+)?)\}\)/y;

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

const FONT =
  /^\/instdir\/(share\/fonts\/truetype|program\/resource\/common\/fonts)\/.*\.(ttf|otf)$/;

/** The font files named in the `loadPackage` table of `js`, in table order. */
export function servedFonts(js: string): string[] {
  const from = js.indexOf(TABLE_HEAD) + TABLE_HEAD.length;
  const out: string[] = [];
  for (const hit of js.slice(from).matchAll(/\{filename:"([^"]*)",start:/g)) {
    const name = hit[1] ?? '';
    if (FONT.test(name)) out.push(name);
  }
  return out;
}

/**
 * Applies the lock's `data` section: returns the new `soffice.data` bytes and `soffice.js` text
 * with its `loadPackage` table rewritten (entry order kept, offsets and size recomputed). Throws
 * unless the table occurs once, parses completely and round-trips, and every path exists.
 */
export function rewriteData(
  js: string,
  data: Uint8Array,
  spec: DataRewrite,
  read: (file: string) => Uint8Array,
): { js: string; data: Uint8Array } {
  const head = count(js, TABLE_HEAD);
  if (head !== 1) throw new Error(`soffice.js: loadPackage table found ${head} times`);
  const from = js.indexOf(TABLE_HEAD) + TABLE_HEAD.length;
  const entries: { filename: string; start: number; end: number }[] = [];
  let at = from;
  for (;;) {
    TABLE_ENTRY.lastIndex = at;
    const hit = TABLE_ENTRY.exec(js);
    if (hit === null) break;
    entries.push({ filename: hit[1] ?? '', start: Number(hit[2]), end: Number(hit[3]) });
    at += hit[0].length;
    if (js[at] === ',') at += 1;
  }
  TABLE_TAIL.lastIndex = at;
  const tail = TABLE_TAIL.exec(js);
  if (tail === null) throw new Error('soffice.js: loadPackage table does not end as expected');
  const size = Number(tail[1]);
  let expected = 0;
  for (const entry of entries) {
    if (entry.start !== expected) throw new Error(`${entry.filename}: table is not contiguous`);
    expected = entry.end;
  }
  if (expected !== size || size !== data.length) {
    throw new Error(`soffice.data: ${data.length} bytes, table says ${size}`);
  }
  const names = new Set(entries.map((entry) => entry.filename));
  if (names.size !== entries.length) throw new Error('soffice.js: duplicate table entries');
  for (const path of [...spec.drop, ...Object.keys(spec.replace)]) {
    if (!names.has(path)) throw new Error(`soffice.data: no entry ${path}`);
  }
  const drop = new Set(spec.drop);
  const chunks: Uint8Array[] = [];
  const kept: string[] = [];
  let offset = 0;
  for (const entry of entries) {
    if (drop.has(entry.filename)) continue;
    const replacement = spec.replace[entry.filename];
    const bytes =
      replacement === undefined ? data.subarray(entry.start, entry.end) : read(replacement.file);
    chunks.push(bytes);
    kept.push(`{filename:"${entry.filename}",start:${offset},end:${offset + bytes.length}}`);
    offset += bytes.length;
  }
  const out = new Uint8Array(offset);
  let cursor = 0;
  for (const chunk of chunks) {
    out.set(chunk, cursor);
    cursor += chunk.length;
  }
  const rewritten = `${kept.join(',')}],remote_package_size:${offset}})`;
  return { js: js.slice(0, from) + rewritten + js.slice(at + tail[0].length), data: out };
}
