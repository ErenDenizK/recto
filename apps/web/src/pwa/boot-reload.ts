/**
 * The edition's chunk at launch (ADR-0033 §2.1, `main.tsx`) is the one import the page cannot
 * do without: when it fails, nothing mounts. A load can fail for a reason the next one does not
 * have (PRD-26): in CI, right after Settings removed the Office package and the page reloaded
 * out of isolation (ADR-0035 §4, PRD-21), a few of the app's module requests answered by the
 * service worker came back `net::ERR_ABORTED`, and a fresh load of the same page booted. So:
 *
 * 1. **In the page.** A module that failed is not fetched again by a later `import()` of the
 *    same URL (WebKit keeps it failed even in the reloaded page), so the edition's chunk is
 *    imported again under a fresh URL (`?r=<time>`), after any stylesheet that failed to load is
 *    asked for again the same way. The build keeps that chunk a thin facade no other chunk
 *    imports (vite.config.ts `editionChunks`), so the retried copy is the only one, and
 *    writes its file and export key over `EDITION_CHUNKS`.
 * 2. **One reload**, when that fails too (a failed module the facade imports keeps failing in
 *    the page; a reload asks for it again in Chromium and Firefox). It waits for the document's
 *    `load`: a reload started while the page is loading is not one in every engine (Firefox
 *    runs it as a new navigation). A second failure within `BOOT_RELOAD_WINDOW_MS`, or no session
 *    storage to guard it, never reloads again: a loop would hide a real outage.
 * 3. **A static screen** then, never a blank page: what failed, and Reload, which loads a
 *    cache-busted document URL (`_r=<time>`). It needs no React, and its two lines are kept here
 *    rather than in messages/*.json: the messages' modules would cost the first paint more
 *    than the text (V1-P1), and this is the page shown when modules fail to load.
 */
import { getLocale } from '../i18n/locale';

/** `sessionStorage`: when this tab last reloaded for a failed launch chunk (ms since epoch). */
export const BOOT_RELOAD_KEY = 'pdf-editor:boot-reload:v1';
export const BOOT_RELOAD_WINDOW_MS = 60_000;

/**
 * Replaced at build (vite.config.ts `editionChunks`) with the JSON list of the editions' chunk
 * files, full then compact, relative to the base path (`assets/app-<hash>.js`).
 */
const EDITION_CHUNKS = '__RECTO_EDITION_CHUNKS__';

export type Edition = 'full' | 'compact';

/** The screen's text by locale: what failed, and the button (`error_reload` in messages). */
const TEXT = {
  en: ['Recto could not start: part of the app did not load. Reload to try again.', 'Reload'],
  tr: [
    'Recto başlatılamadı: uygulamanın bir bölümü yüklenemedi. Yeniden yükleyip tekrar deneyin.',
    'Yeniden yükle',
  ],
} as const;

export interface BootWindow {
  readonly sessionStorage: Pick<Storage, 'getItem' | 'setItem'>;
  readonly location: Pick<Location, 'reload' | 'replace' | 'href'>;
  readonly document: Pick<Document, 'readyState'>;
  addEventListener(type: 'load', listener: () => void, options: { once: true }): void;
}

/** The edition's chunk file as the build wrote it; undefined before the build (dev, tests). */
export function editionChunk(edition: Edition, raw: string = EDITION_CHUNKS): string | undefined {
  try {
    return (JSON.parse(raw) as string[])[edition === 'full' ? 0 : 1];
  } catch {
    return undefined;
  }
}

/** `url` with `name=<now>` set, keeping its other parameters and its hash. */
export function bustedUrl(url: string, name: string, now = Date.now()): string {
  const busted = new URL(url);
  busted.searchParams.set(name, String(now));
  return busted.href;
}

/**
 * Stylesheet links whose load failed (Vite's preload of the edition's CSS rejects its import
 * then). Seen through `error` in the capture phase, as a failed link keeps a `sheet` in Chromium.
 */
export const failedStyles = new Set<HTMLLinkElement>();
document.addEventListener(
  'error',
  (event) => {
    if (event.target instanceof HTMLLinkElement && event.target.rel === 'stylesheet') {
      failedStyles.add(event.target);
    }
  },
  true,
);

/** Asks again, under a fresh URL, for each failed stylesheet; resolves whether all loaded. */
export function retryStyles(doc: Document = document, now = Date.now()): Promise<boolean> {
  const failed = [...failedStyles];
  failedStyles.clear();
  return Promise.all(
    failed.map(
      (link) =>
        new Promise<boolean>((resolve) => {
          const fresh = doc.createElement('link');
          fresh.rel = 'stylesheet';
          fresh.href = bustedUrl(link.href, 'r', now);
          fresh.onload = () => resolve(true);
          fresh.onerror = () => resolve(false);
          link.replaceWith(fresh);
        }),
    ),
  ).then((loaded) => !loaded.includes(false));
}

/**
 * Whether the page reloads for a failed launch chunk (and notes that it did): now, or once the
 * document has loaded.
 */
export function reloadForFailedBoot(win: BootWindow = window, now = Date.now()): boolean {
  try {
    const last = Number(win.sessionStorage.getItem(BOOT_RELOAD_KEY));
    if (now - last < BOOT_RELOAD_WINDOW_MS) return false;
    win.sessionStorage.setItem(BOOT_RELOAD_KEY, String(now));
  } catch {
    return false;
  }
  if (win.document.readyState === 'complete') win.location.reload();
  else win.addEventListener('load', () => win.location.reload(), { once: true });
  return true;
}

/**
 * The screen of a launch that could not load (`data-testid="boot-failure"`), outside React.
 * Its text is the app's own, never input, so it is written as markup.
 */
export function showBootFailure(doc: Document = document, win: BootWindow = window): HTMLElement {
  const screen = doc.createElement('section');
  screen.dataset.testid = 'boot-failure';
  screen.setAttribute('role', 'alert');
  screen.style.cssText =
    'position:fixed;inset:0;display:grid;place-content:center;gap:12px;padding:16px;text-align:center';
  const [text, reload] = TEXT[getLocale() === 'tr' ? 'tr' : 'en'];
  screen.innerHTML = `<p>${text}</p><button type=button>${reload}</button>`;
  (screen.lastChild as HTMLElement).onclick = () =>
    win.location.replace(bustedUrl(win.location.href, '_r'));
  doc.body.append(screen);
  return screen;
}

const importUrl = (url: string): Promise<unknown> => import(/* @vite-ignore */ url);

/**
 * `load()`; when it fails, the edition's chunk again under a fresh URL; then one reload; then
 * the static screen (the module comment). After a reload or the screen the promise never
 * settles, so React renders nothing on the way. `name` is the edition's export, which the build
 * checks its chunk has.
 */
export function loadOrReload<T>(
  load: () => Promise<T>,
  edition: Edition,
  name: string,
  win: BootWindow = window,
  retry: (url: string) => Promise<unknown> = importUrl,
  file: string | undefined = editionChunk(edition),
): Promise<T> {
  return load().catch(async () => {
    if (file !== undefined && (await retryStyles())) {
      const url = bustedUrl(new URL(import.meta.env.BASE_URL + file, win.location.href).href, 'r');
      const module = (await retry(url).catch(() => undefined)) as
        | Record<string, unknown>
        | undefined;
      if (module?.[name] !== undefined) return module as T;
    }
    // The error is not rethrown: the screen says it, and React would only unmount the root.
    if (!reloadForFailedBoot(win)) showBootFailure(document, win);
    return new Promise<T>(() => undefined);
  });
}
