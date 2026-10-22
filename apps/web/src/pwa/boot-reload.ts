/**
 * The edition's chunk at launch (ADR-0033 §2.1, `main.tsx`) is the one import the page cannot
 * do without: when it fails, nothing mounts and the page stays blank with no way out. A load
 * can fail for a reason the next one does not have (PRD-26): in CI, right after Settings removed
 * the Office package and the page reloaded out of isolation (ADR-0035 §4, PRD-21), a few of the
 * app chunk's module requests answered by the service worker came back `net::ERR_ABORTED`, and
 * a fresh load of the same page booted. A module that failed to load is not fetched again by a
 * later `import()` of the same page, so the page reloads, once. A second failure within
 * `BOOT_RELOAD_WINDOW_MS` is thrown as before: that is a real outage (offline on a first visit,
 * a broken deploy) and a loop would hide it. Without session storage the guard cannot hold, so
 * nothing reloads.
 */

/** `sessionStorage`: when this tab last reloaded for a failed launch chunk (ms since epoch). */
export const BOOT_RELOAD_KEY = 'pdf-editor:boot-reload:v1';
export const BOOT_RELOAD_WINDOW_MS = 60_000;

export interface BootWindow {
  readonly sessionStorage: Pick<Storage, 'getItem' | 'setItem'>;
  readonly location: Pick<Location, 'reload'>;
}

/** Whether the page reloads for a failed launch chunk now (and notes that it did). */
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
  win.location.reload();
  return true;
}

/**
 * `load()`, or one reload when it fails (`reloadForFailedBoot`): the returned promise then never
 * settles, so the blank page is not rendered as an error on its way out.
 */
export function loadOrReload<T>(load: () => Promise<T>, win: BootWindow = window): Promise<T> {
  return load().catch((error: unknown) => {
    if (!reloadForFailedBoot(win)) throw error;
    return new Promise<T>(() => undefined);
  });
}
