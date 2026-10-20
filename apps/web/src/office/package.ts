/**
 * The Office conversion package as the browser sees it (ADR-0035 §1, §4): the pinned files of
 * `packages/engine/office/office.lock.json` (bundled into this lazy chunk, so the trust anchor
 * is the app's own code, not a file beside the package) and where they live.
 *
 * - **Served** under `convert/<directory>/` on the app's origin; the two large files as
 *   `<name>.gz`, which is what goes over the wire.
 * - **Stored** in the `pdf-editor-office` cache under the name the converter asks for
 *   (`soffice.wasm`), still compressed and marked `X-Recto-Encoding: gzip`; the service worker
 *   (`public/sw-office.js`) inflates it on the way out.
 * - **Installed** once every file is stored: the marker `convert/installed.json` names the
 *   directory. The service worker reads the same names; `sw-office.test.ts` keeps them equal.
 */
import lockJson from '@pdf-editor/engine/office/office.lock.json';

interface BrowserLockFile {
  readonly sha256: string;
  readonly bytes: number;
  readonly gzip?: boolean;
  readonly downloadBytes?: number;
}

interface BrowserLock {
  readonly package: { readonly version: string; readonly libreoffice: string };
  readonly directory: string;
  readonly files: Readonly<Record<string, BrowserLockFile>>;
  /** The notices (NOTICE.txt, MPL-2.0.txt), stored with the package so the link works offline. */
  readonly notices: Readonly<Record<string, BrowserLockFile>>;
}

export const OFFICE_LOCK: BrowserLock = lockJson;

/** The cache the download manager fills and the service worker serves from. */
export const OFFICE_CACHE = 'pdf-editor-office';
/** The service worker's message to read the marker again. */
export const OFFICE_REFRESH_MESSAGE = 'RECTO_OFFICE_REFRESH';
/** The header that marks a stored file as gzip-compressed. */
export const STORED_ENCODING_HEADER = 'X-Recto-Encoding';

/** `convert/` under the deployment base, absolute. */
export function convertRoot(): string {
  return new URL('convert/', new URL(import.meta.env.BASE_URL, location.href)).href;
}

/** The package directory's URL, ending in `/`. */
export function packageBase(): string {
  return `${convertRoot()}${OFFICE_LOCK.directory}/`;
}

export const markerUrl = (): string => `${convertRoot()}installed.json`;
export const pendingRoot = (): string => `${convertRoot()}pending/`;
/** The package's notices (MPL-2.0 text, LibreOffice, fonts), served beside it. */
export const noticeUrl = (): string => `${packageBase()}NOTICE.txt`;

export interface PackageFile {
  readonly name: string;
  /** What is fetched (the `.gz` for compressed files). */
  readonly downloadUrl: string;
  /** What the converter asks for and the cache keeps it under. */
  readonly storedUrl: string;
  readonly sha256: string;
  /** Size once inflated. */
  readonly bytes: number;
  readonly gzip: boolean;
  /** Expected transfer size (the pinned gzip's size; the real one may differ by a few bytes). */
  readonly downloadBytes: number;
}

export function packageFiles(lock: BrowserLock = OFFICE_LOCK): readonly PackageFile[] {
  const base = packageBase();
  return Object.entries({ ...lock.files, ...lock.notices }).map(([name, file]) => {
    const gzip = file.gzip === true;
    return {
      name,
      downloadUrl: `${base}${gzip ? `${name}.gz` : name}`,
      storedUrl: `${base}${name}`,
      sha256: file.sha256,
      bytes: file.bytes,
      gzip,
      downloadBytes: file.downloadBytes ?? file.bytes,
    };
  });
}

/** What the consent asks for: the whole download, bytes. */
export function packageDownloadBytes(lock: BrowserLock = OFFICE_LOCK): number {
  return packageFiles(lock).reduce((sum, file) => sum + file.downloadBytes, 0);
}

/** Converter URLs for the worker host (`converter.ts`): the names Emscripten asks for. */
export function converterUrls(): {
  readonly host: string;
  readonly sofficeJs: string;
  readonly sofficeWasm: string;
  readonly sofficeData: string;
  readonly sofficeWorkerJs: string;
} {
  const base = packageBase();
  return {
    host: `${base}browser.worker.global.js`,
    sofficeJs: `${base}soffice.js`,
    sofficeWasm: `${base}soffice.wasm`,
    sofficeData: `${base}soffice.data`,
    sofficeWorkerJs: `${base}soffice.worker.js`,
  };
}
