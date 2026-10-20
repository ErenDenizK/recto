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
 * are gzipped at level 9 (no name, mtime 0). Nothing here is committed: `vendor/` is
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
  revision: 1,
} as const;

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

/** Writes vendor/<directory>/ from the tarball; returns each file's raw bytes and gzip size. */
function vendor(
  tarball: string,
  directory: string,
  patches: readonly OfficePatch[],
): Record<string, LockedOfficeFile> {
  const extracted = extract(tarball);
  const out = join(VENDOR_DIR, directory);
  rmSync(VENDOR_DIR, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const files: Record<string, LockedOfficeFile> = {};
  try {
    for (const [name, { source, gzip: compress }] of Object.entries(SOURCES)) {
      const raw = patched(name, new Uint8Array(readFileSync(join(extracted, source))), patches);
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
  const files = vendor(path, directory, PATCHES);
  const lock: OfficeLock = {
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
    files,
  };
  writeFileSync(LOCK_PATH, `${JSON.stringify(lock, null, 2)}\n`);
}

/** Downloads the pinned tarball (checking its integrity) and writes the vendored files. */
function fetchPinned(lock: OfficeLock): void {
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
  vendor(path, lock.directory, lock.patches);
}

const mode = process.argv[2];
if (mode === '--pin') pin();
else if (mode !== '--verify') fetchPinned(readLock());

const verified = verifyOfficeAssets();
let total = 0;
for (const { path, bytes } of verified) {
  total += bytes;
  console.log(`ok  convert/${path}  ${bytes.toLocaleString('en')} bytes`);
}
console.log(
  `${verified.length} files, ${total.toLocaleString('en')} bytes, match office.lock.json`,
);
