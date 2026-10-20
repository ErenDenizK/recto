/**
 * The Office conversion package served from the app's origin (ADR-0035 §1–§3), for Node: the
 * lock's shape, the verification shared with `fetch.ts`, and the Vite plugin that serves the
 * package in dev and copies it into `dist/convert/` at build.
 *
 *   convert/<directory>/browser.worker.global.js   the converter's worker host (MPL-2.0)
 *   convert/<directory>/soffice.js                  LibreOffice's Emscripten glue, patched (§3)
 *   convert/<directory>/soffice.worker.js           its pthread worker
 *   convert/<directory>/soffice.wasm.gz             LibreOffice, gzip -9
 *   convert/<directory>/soffice.data.gz             its file system (fonts, filters), gzip -9
 *   convert/<directory>/NOTICE.txt, MPL-2.0.txt     the package's notices (§2)
 *
 * The files come from the npm tarball of `@matbee/libreoffice-converter`, pinned by its
 * `sha512` integrity in `office.lock.json`; `fetch.ts` downloads it, applies the threads patch
 * and gzips the two large files into `vendor/<directory>/`, which is never committed (the wasm
 * is 147 MB raw, over GitHub's file limit). Every file is checked against the lock whenever it
 * is served or copied: the small files by their SHA-256, the gzip files by the SHA-256 of what
 * they inflate to (gzip output is not pinned: another zlib may compress differently), so a
 * changed tarball, a lost patch or a corrupt file fails the build instead of shipping.
 *
 * The package is never a dependency of the app and never in a bundle: nothing imports it, the
 * service worker does not precache `convert/**` (apps/web/vite.config.ts), and the browser
 * downloads it only after the user agrees (apps/web/src/office/). A build without the vendored
 * files still succeeds; it ships no `convert/` and the download reports the package missing.
 */
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import type { Plugin } from 'vite';

export const OFFICE_DIR = fileURLToPath(new URL('.', import.meta.url));
export const LOCK_PATH = join(OFFICE_DIR, 'office.lock.json');
/** Where `fetch.ts` writes the package (git-ignored). */
export const VENDOR_DIR = join(OFFICE_DIR, 'vendor');
/** Notices committed beside this file and shipped with the package (ADR-0035 §2). */
export const LICENSE_FILES = ['NOTICE.txt', 'MPL-2.0.txt'] as const;

export interface LockedOfficeFile {
  /** Path inside the npm tarball. */
  readonly source: string;
  /** SHA-256 and size of the file as the converter reads it (after the patch, inflated). */
  readonly sha256: string;
  readonly bytes: number;
  /** Served gzip-compressed as `<name>.gz`; `downloadBytes` is its size when pinned. */
  readonly gzip?: boolean;
  readonly downloadBytes?: number;
}

export interface OfficePatch {
  readonly file: string;
  readonly from: string;
  readonly to: string;
  readonly why: string;
}

export interface OfficeLock {
  readonly $comment?: string;
  readonly package: {
    readonly name: string;
    readonly version: string;
    readonly tarball: string;
    /** npm's `dist.integrity` of the tarball. */
    readonly integrity: string;
    readonly license: string;
    readonly repository: string;
    readonly libreoffice: string;
  };
  /** Directory under `convert/`; a new package or patch gets a new one. */
  readonly directory: string;
  readonly patches: readonly OfficePatch[];
  /** By served name (gzip files without their `.gz`). */
  readonly files: Readonly<Record<string, LockedOfficeFile>>;
}

export function readLock(): OfficeLock {
  return JSON.parse(readFileSync(LOCK_PATH, 'utf8')) as OfficeLock;
}

export function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** The name a locked file is served under. */
export function servedName(name: string, file: LockedOfficeFile): string {
  return file.gzip === true ? `${name}.gz` : name;
}

export interface OfficeAsset {
  /** Path under `convert/`, e.g. `lo-2.7.2-r1/soffice.js`. */
  readonly path: string;
  readonly source: string;
  /** The locked file it is, or undefined for a notice. */
  readonly locked?: { readonly name: string; readonly file: LockedOfficeFile };
}

/** Every file served under `convert/`, with its source on disk. */
export function officeAssets(lock: OfficeLock = readLock()): OfficeAsset[] {
  const dir = lock.directory;
  const files = Object.entries(lock.files).map(([name, file]) => ({
    path: `${dir}/${servedName(name, file)}`,
    source: join(VENDOR_DIR, dir, servedName(name, file)),
    locked: { name, file },
  }));
  const notices = LICENSE_FILES.map((name) => ({
    path: `${dir}/${name}`,
    source: join(OFFICE_DIR, name),
  }));
  return [...files, ...notices];
}

/** Whether `fetch.ts` has written this lock's package. */
export function isVendored(lock: OfficeLock = readLock()): boolean {
  return officeAssets(lock).every((asset) => existsSync(asset.source));
}

/** Throws unless `bytes` (inflated when gzip) match the lock. */
export function checkLocked(name: string, bytes: Uint8Array, file: LockedOfficeFile): void {
  const raw = file.gzip === true ? new Uint8Array(gunzipSync(bytes)) : bytes;
  const actual = sha256(raw);
  if (actual !== file.sha256 || raw.length !== file.bytes) {
    throw new Error(
      `convert/${name}: SHA-256 ${actual} (${raw.length} bytes), ` +
        `office.lock.json says ${file.sha256} (${file.bytes} bytes)`,
    );
  }
}

/** Reads one served file and checks it against the lock. */
export function readVerified(asset: OfficeAsset): Uint8Array {
  const bytes = new Uint8Array(readFileSync(asset.source));
  if (asset.locked) checkLocked(asset.locked.name, bytes, asset.locked.file);
  return bytes;
}

/** Verifies every vendored file; returns their paths and sizes (for reports). */
export function verifyOfficeAssets(
  lock: OfficeLock = readLock(),
): { path: string; bytes: number }[] {
  return officeAssets(lock).map((asset) => ({
    path: asset.path,
    bytes: readVerified(asset).length,
  }));
}

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.js': 'text/javascript',
  '.txt': 'text/plain; charset=utf-8',
  // No Content-Encoding: the download manager stores the gzip bytes as they are and the
  // service worker inflates them when the converter asks (ADR-0035 §4).
  '.gz': 'application/octet-stream',
};

/**
 * Serves `convert/**` in dev and tests (under Vite's `base`) and copies it into the build
 * output, each file verified against the lock first. Without the vendored package it does
 * nothing but say so once.
 */
export function officeAssetsPlugin(): Plugin {
  let base = '/';
  let outDir = 'dist';
  return {
    name: 'pdf-editor-office-assets',
    configResolved(config) {
      base = config.base.endsWith('/') ? config.base : `${config.base}/`;
      outDir = resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      const lock = readLock();
      if (!isVendored(lock)) return;
      const assets = new Map(officeAssets(lock).map((a) => [a.path, a]));
      server.middlewares.use((req, res, next) => {
        const pathname = (req.url ?? '').split('?')[0] ?? '';
        const prefix = `${base}convert/`;
        const asset = pathname.startsWith(prefix)
          ? assets.get(decodeURIComponent(pathname.slice(prefix.length)))
          : undefined;
        if (!asset) {
          next();
          return;
        }
        try {
          const bytes = readVerified(asset);
          const ext = /\.[a-z]+$/.exec(asset.path)?.[0] ?? '';
          res.setHeader('Content-Type', CONTENT_TYPES[ext] ?? 'application/octet-stream');
          res.setHeader('Content-Length', String(bytes.length));
          res.setHeader('Cache-Control', 'no-cache');
          res.end(bytes);
        } catch (error) {
          next(error);
        }
      });
    },
    writeBundle() {
      const lock = readLock();
      if (!isVendored(lock)) {
        this.info(
          'Office conversion package not fetched (node packages/engine/office/fetch.ts): ' +
            'the build ships no convert/ (ADR-0035 §1).',
        );
        return;
      }
      for (const asset of officeAssets(lock)) {
        readVerified(asset);
        const target = join(outDir, 'convert', asset.path);
        mkdirSync(join(target, '..'), { recursive: true });
        copyFileSync(asset.source, target);
      }
    },
  };
}
