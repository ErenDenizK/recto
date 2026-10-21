/**
 * Fetches, pins and verifies the Office conversion package (ADR-0035 §1), like `ocr/fetch.ts`
 * for OCR:
 *
 *   node packages/engine/office/fetch.ts           # download the tarball if needed, write
 *                                                  # vendor/<directory>/, then verify it
 *   node packages/engine/office/fetch.ts --verify  # verify only (no network)
 *   node packages/engine/office/fetch.ts --pin     # re-pin: rewrite office.lock.json from the
 *                                                  # tarball named below
 *
 * The tarball is npm's `@matbee/libreoffice-converter`, checked against the lock's `sha512`
 * integrity before anything is read from it. Five files are taken from it; `soffice.js` gets
 * the threads patch (ADR-0035 §3: the pre-started pthread pool grows from 4 to 16, which ends
 * the "Loading document" deadlock the spike measured), and `soffice.wasm` and `soffice.data`
 * are gzipped at level 9 (no name, mtime 0). Since r2 (PRD-20) `soffice.data` is also rewritten
 * from the lock's `data` section: `drop` removes font files, `replace` swaps a file for a
 * committed one, and the `loadPackage` table in `soffice.js` (offsets, `remote_package_size`)
 * is rewritten to match, a second change to that MPL file. Nothing here is committed: `vendor/` is
 * git-ignored, and the build copies it into `dist/convert/` when present (`assets.ts`).
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

import {
  LOCK_PATH,
  type LockedOfficeFile,
  type OfficeLock,
  isVendored,
  LICENSE_FILES,
  OFFICE_DIR,
  type OfficePatch,
  readLock,
  servedName,
  sha256,
  VENDOR_DIR,
  verifyOfficeAssets,
} from './assets.ts';

/** What `--pin` pins (the spike's measured build, docs/research/conversion-2026-10). */
const PIN = {
  name: '@matbee/libreoffice-converter',
  version: '2.7.2',
  libreoffice: '24.8',
  /** Bumped whenever the patches change, so browsers fetch the package again. */
  revision: 2,
} as const;

/** The `data` section of the lock (PRD-20): how `soffice.data` is rewritten. */
export interface DataRewrite {
  /** Exact in-package paths to remove. */
  readonly drop: readonly string[];
  /** In-package path → the committed file (relative to this folder) that replaces it. */
  readonly replace: Readonly<Record<string, { readonly file: string; readonly sha256: string }>>;
}

type PinnedLock = OfficeLock & { readonly data: DataRewrite };

/**
 * r2 drops (PRD-20, BQ-1 and size): Linux Libertine G and Biolinum G, Gentium Basic and Book
 * Basic, DejaVu Serif Condensed and Sans ExtraLight, the Culmus families (GPL 2) and Liberation
 * Sans Narrow (GPL 2 with exceptions). Hebrew documents use the OFL David Libre, Miriam Libre
 * and Frank Ruhl Hofshi that stay in the package; Arial Narrow falls back to Liberation Sans.
 */
const TRUETYPE = '/instdir/share/fonts/truetype/';
const DROP: readonly string[] = [
  ...['RB_G', 'RI_G', 'R_G'].map((s) => `LinBiolinum_${s}.ttf`),
  ...['DR_G', 'RBI_G', 'RB_G', 'RI_G', 'RZI_G', 'RZ_G', 'R_G'].map((s) => `LinLibertine_${s}.ttf`),
  ...['B', 'BI', 'I', 'R'].map((s) => `GenBas${s}.ttf`),
  ...['B', 'BI', 'I', 'R'].map((s) => `GenBkBas${s}.ttf`),
  'DejaVuSans-ExtraLight.ttf',
  ...['', '-Bold', '-BoldItalic', '-Italic'].map((s) => `DejaVuSerifCondensed${s}.ttf`),
  ...['-Bold', '-BoldItalic', '-Medium', '-MediumItalic'].map((s) => `DavidCLM${s}.otf`),
  ...['-Bold', '-BoldOblique', '-Medium', '-MediumOblique'].map((s) => `FrankRuehlCLM${s}.ttf`),
  ...['-Bold', '-Book'].map((s) => `MiriamCLM${s}.ttf`),
  ...['-Bold', '-BoldOblique', '-Book', '-BookOblique'].map((s) => `MiriamMonoCLM${s}.ttf`),
  ...['-Bold', '-BoldOblique', '-Light', '-LightOblique'].map((s) => `NachlieliCLM${s}.otf`),
  ...['-Bold', '-BoldItalic', '-Italic', '-Regular'].map((s) => `LiberationSansNarrow${s}.ttf`),
].map((name) => `${TRUETYPE}${name}`);

/** The committed replacement for fontconfig's local file (Recto's substitution table). */
const REPLACE: Readonly<Record<string, string>> = {
  [`${TRUETYPE}fc_local.conf`]: 'data/fc_local.conf',
};

const PATCHES: readonly OfficePatch[] = [
  {
    file: 'soffice.js',
    from: 'var pthreadPoolSize=4;',
    to: 'var pthreadPoolSize=16;',
    why:
      'LibreOffice blocks its main thread while it starts more threads; with 4 pre-started ' +
      'workers the pool runs dry and "Loading document" never ends (spike §3). 16 fixes it.',
  },
];

/** Served name → path inside the tarball, and whether it is served gzipped. */
const SOURCES: Readonly<Record<string, { readonly source: string; readonly gzip?: true }>> = {
  'browser.worker.global.js': { source: 'package/dist/browser.worker.global.js' },
  'soffice.js': { source: 'package/wasm/soffice.js' },
  'soffice.worker.js': { source: 'package/wasm/soffice.worker.js' },
  'soffice.wasm': { source: 'package/wasm/soffice.wasm', gzip: true },
  'soffice.data': { source: 'package/wasm/soffice.data', gzip: true },
};

const downloads = join(tmpdir(), 'pdf-editor-office-downloads');

function tarballUrl(name: string, version: string): string {
  const bare = name.split('/').pop() ?? name;
  return `https://registry.npmjs.org/${name}/-/${bare}-${version}.tgz`;
}

function download(url: string): string {
  mkdirSync(downloads, { recursive: true });
  const path = join(downloads, url.split('/').pop() ?? 'package.tgz');
  if (!existsSync(path)) execFileSync('curl', ['-sSfL', '--retry', '3', '-o', path, url]);
  return path;
}

function integrityOf(path: string): string {
  return `sha512-${createHash('sha512').update(readFileSync(path)).digest('base64')}`;
}

/** Extracts the five files into a fresh temporary directory; returns it. */
function extract(tarball: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'pdf-editor-office-'));
  execFileSync('tar', [
    '-xzf',
    tarball,
    '-C',
    dir,
    ...Object.values(SOURCES).map((entry) => entry.source),
  ]);
  return dir;
}

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

/** Applies each patch for `name`; throws unless every patch site occurs exactly once. */
function patched(name: string, bytes: Uint8Array, patches: readonly OfficePatch[]): Uint8Array {
  const mine = patches.filter((patch) => patch.file === name);
  if (mine.length === 0) return bytes;
  let text = new TextDecoder().decode(bytes);
  for (const patch of mine) {
    const sites = count(text, patch.from);
    if (sites !== 1) throw new Error(`${name}: patch site "${patch.from}" found ${sites} times`);
    text = text.replace(patch.from, patch.to);
  }
  return new TextEncoder().encode(text);
}

/** gzip -9 with an empty header (no name, mtime 0). */
function gzip(raw: Uint8Array): Uint8Array {
  return new Uint8Array(gzipSync(raw, { level: 9 }));
}

const TABLE_HEAD = 'loadPackage({files:[';
const TABLE_ENTRY = /\{filename:"([^"]*)",start:(\d+(?:e\d+)?),end:(\d+(?:e\d+)?)\}/y;
const TABLE_TAIL = /\],remote_package_size:(\d+(?:e\d+)?)\}\)/y;

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

/** Writes vendor/<directory>/ from the tarball; returns each file's raw bytes and gzip size. */
function vendor(
  tarball: string,
  directory: string,
  patches: readonly OfficePatch[],
  rewrite: DataRewrite,
): Record<string, LockedOfficeFile> {
  const extracted = extract(tarball);
  const out = join(VENDOR_DIR, directory);
  rmSync(VENDOR_DIR, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const files: Record<string, LockedOfficeFile> = {};
  try {
    const raws = new Map<string, Uint8Array>();
    for (const [name, { source }] of Object.entries(SOURCES)) {
      raws.set(name, patched(name, new Uint8Array(readFileSync(join(extracted, source))), patches));
    }
    const rewritten = rewriteData(
      new TextDecoder().decode(raws.get('soffice.js')),
      raws.get('soffice.data') ?? new Uint8Array(),
      rewrite,
      (file) => new Uint8Array(readFileSync(join(OFFICE_DIR, file))),
    );
    raws.set('soffice.js', new TextEncoder().encode(rewritten.js));
    raws.set('soffice.data', rewritten.data);
    for (const [name, { source, gzip: compress }] of Object.entries(SOURCES)) {
      const raw = raws.get(name) ?? new Uint8Array();
      const served = compress === true ? gzip(raw) : raw;
      const file: LockedOfficeFile = {
        source,
        sha256: sha256(raw),
        bytes: raw.length,
        ...(compress === true ? { gzip: true, downloadBytes: served.length } : {}),
      };
      writeFileSync(join(out, servedName(name, file)), served);
      files[name] = file;
      console.log(`wrote convert/${directory}/${servedName(name, file)}`);
    }
  } finally {
    rmSync(extracted, { recursive: true, force: true });
  }
  return files;
}

function pin(): void {
  const tarball = tarballUrl(PIN.name, PIN.version);
  const path = download(tarball);
  const directory = `lo-${PIN.version}-r${PIN.revision}`;
  const data: DataRewrite = {
    drop: DROP,
    replace: Object.fromEntries(
      Object.entries(REPLACE).map(([target, file]) => [
        target,
        { file, sha256: sha256(new Uint8Array(readFileSync(join(OFFICE_DIR, file)))) },
      ]),
    ),
  };
  const files = vendor(path, directory, PATCHES, data);
  const lock: PinnedLock = {
    $comment:
      'Pinned Office conversion package (ADR-0035). Written by ' +
      '`node packages/engine/office/fetch.ts --pin`; checked by `--verify`, the build ' +
      '(assets.ts) and the browser download (apps/web/src/office/package.ts).',
    package: {
      name: PIN.name,
      version: PIN.version,
      tarball,
      integrity: integrityOf(path),
      license: 'MPL-2.0',
      repository: 'https://github.com/matbeedotcom/libreoffice-document-converter',
      libreoffice: PIN.libreoffice,
    },
    directory,
    patches: PATCHES,
    data,
    files,
    notices: Object.fromEntries(
      LICENSE_FILES.map((name) => {
        const bytes = new Uint8Array(readFileSync(join(OFFICE_DIR, name)));
        return [name, { sha256: sha256(bytes), bytes: bytes.length }];
      }),
    ),
  };
  writeFileSync(LOCK_PATH, `${JSON.stringify(lock, null, 2)}\n`);
}

/** Downloads the pinned tarball (checking its integrity) and writes the vendored files. */
function fetchPinned(lock: PinnedLock): void {
  if (isVendored(lock)) {
    try {
      verifyOfficeAssets(lock);
      return;
    } catch {
      // A stale or damaged copy: written again below.
    }
  }
  const path = download(lock.package.tarball);
  const integrity = integrityOf(path);
  if (integrity !== lock.package.integrity) {
    rmSync(path, { force: true });
    throw new Error(
      `${lock.package.tarball}: integrity ${integrity}, office.lock.json says ${lock.package.integrity}`,
    );
  }
  for (const { file, sha256: pinned } of Object.values(lock.data.replace)) {
    const actual = sha256(new Uint8Array(readFileSync(join(OFFICE_DIR, file))));
    if (actual !== pinned)
      throw new Error(`${file}: SHA-256 ${actual}, office.lock.json says ${pinned}`);
  }
  vendor(path, lock.directory, lock.patches, lock.data);
}

const mode = process.argv[2];
if (mode === '--pin') pin();
else if (mode !== '--verify') fetchPinned(readLock() as PinnedLock);

const verified = verifyOfficeAssets();
let total = 0;
for (const { path, bytes } of verified) {
  total += bytes;
  console.log(`ok  convert/${path}  ${bytes.toLocaleString('en')} bytes`);
}
console.log(
  `${verified.length} files, ${total.toLocaleString('en')} bytes, match office.lock.json`,
);
