/**
 * The edition's chunk at launch (ADR-0033 §2.1, `main.tsx`) is the one import the page cannot
 * do without: when it fails, nothing mounts and the page stays blank with no way out. A load
 * can fail for a reason the next one does not have (PRD-26): in CI, right after Settings removed
 * the Office package and the page reloaded out of isolation (ADR-0035 §4, PRD-21), a few of the
 * app chunk's module requests answered by the service worker came back `net::ERR_ABORTED`, and
 * a fresh load of the same page booted. A module that failed to load is not fetched again by a
 * later `import()` of the same URL, so the chunk is first imported again under a fresh URL in
 * the page (`loadOrReload`), and only when that fails too does the page reload, once (a failed
 * static dependency of the chunk keeps failing in the page; a reload fetches it again). A
 * second failure within
 * `BOOT_RELOAD_WINDOW_MS` is thrown as before: that is a real outage (offline on a first visit,
 * a broken deploy) and a loop would hide it. Without session storage the guard cannot hold, so
 * nothing reloads. The reload waits for the document's `load` when the chunk failed before it:
 * a reload started while the page is still loading is not one in every engine (Firefox runs it
 * as a new navigation, and WebKit fails the loads still in flight).
 */

/** `sessionStorage`: when this tab last reloaded for a failed launch chunk (ms since epoch). */
export const BOOT_RELOAD_KEY = 'pdf-editor:boot-reload:v1';
export const BOOT_RELOAD_WINDOW_MS = 60_000;

export interface BootWindow {
  readonly sessionStorage: Pick<Storage, 'getItem' | 'setItem'>;
  readonly location: Pick<Location, 'reload'>;
  readonly document: Pick<Document, 'readyState'>;
  addEventListener(type: 'load', listener: () => void, options: { once: true }): void;
}

/**
 * Whether the page reloads for a failed launch chunk (and notes that it did): now, or once the
 * document has loaded.
 */
export function reloadForFailedBoot(win: BootWindow = window, now = Date.now()): boolean {
  try {
    const last = Number(win.sessionStorage.getItem(BOOT_RELOAD_KEY) ?? Number.NaN);
    if (Number.isFinite(last) && now - last >= 0 && now - last < BOOT_RELOAD_WINDOW_MS) {
      return false;
    }
    win.sessionStorage.setItem(BOOT_RELOAD_KEY, String(now));
  } catch {
    return false;
  }
  if (win.document.readyState === 'complete') win.location.reload();
  else win.addEventListener('load', () => win.location.reload(), { once: true });
  return true;
}

/**
 * The URL `load` imports, as the build wrote it (`() => import(`./app-<hash>.js`)`, resolved
 * against this module, which sits beside it in `assets/`), with a cache-busting `?r=`: a URL the
 * engine has not failed yet. Undefined when the source names no emitted `.js` file (dev).
 */
export function retryUrl(
  load: () => unknown,
  now = Date.now(),
  base = import.meta.url,
): string | undefined {
  const match = /import\(\s*[`'"]([^`'"]+\.js)[`'"]\s*\)/.exec(String(load));
  if (match?.[1] === undefined) return undefined;
  const url = new URL(match[1], base);
  url.searchParams.set('r', String(now));
  return url.href;
}

/**
 * The module that carries `name` in what a chunk exports: the chunk itself, or the namespace
 * the build re-exports it under (`import(...).then((e) => e.t)` when the module shares a chunk).
 */
export function moduleWith<T>(chunk: unknown, name: string): T | undefined {
  if (chunk === null || typeof chunk !== 'object') return undefined;
  if (name in chunk) return chunk as T;
  for (const value of Object.values(chunk)) {
    if (value !== null && typeof value === 'object' && name in value) return value as T;
  }
  return undefined;
}

const importUrl = (url: string): Promise<unknown> => import(/* @vite-ignore */ url);

/**
 * `load()`; when it fails, the same chunk again under a fresh URL (`retryUrl`: a module that
 * failed keeps failing under its own URL, in WebKit even after a reload); when that fails too,
 * one reload (`reloadForFailedBoot`). After a reload the returned promise never settles, so the
 * blank page is not rendered as an error on its way out. `name` is an export of the module, to
 * find it in the retried chunk.
 */
export function loadOrReload<T>(
  load: () => Promise<T>,
  name: string,
  win: BootWindow = window,
  retry: (url: string) => Promise<unknown> = importUrl,
): Promise<T> {
  return load().catch(async (error: unknown) => {
    const url = retryUrl(load);
    if (url !== undefined) {
      const found = await retry(url).then(
        (chunk) => moduleWith<T>(chunk, name),
        () => undefined,
      );
      if (found !== undefined) return found;
    }
    if (!reloadForFailedBoot(win)) throw error;
    return new Promise<T>(() => undefined);
  });
}
