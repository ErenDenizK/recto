/**
 * The desk's paint mark (DSN-87, `masa.md` §4 rules 3 and 6): `performance.mark('recto:desk-painted')`
 * once the desk is on screen with its hero settled (Recents read; the slot stops holding after
 * `HERO_WAIT_MS`, `desk-model.ts`) and its visible covers decoded, or `COVER_WAIT_MS` after
 * that, whichever is first (a slow decode never holds the mark hostage; the cover then fades in).
 * The perf baseline reads it as "Desk painted" (`tools/perf/baseline.ts`) and `e2e/masa.spec.ts`
 * asserts it. Only with the desk on, and only the first time: a desk revisited later is not a
 * paint. It watches the DOM rather than the component, so it adds nothing to the desk's render
 * path, and stops watching after `WATCH_MS` when the app starts in a document.
 */
import { prefetchCovers } from './covers';
import { deskEnabled } from './desk-flag';
import { LOADING_FALLBACK_MS } from './desk-model';

export const DESK_PAINTED_MARK = 'recto:desk-painted';
/** The most the mark waits for the hero slot to leave its holding state (ms). */
export const HERO_WAIT_MS = LOADING_FALLBACK_MS;
/** The most the mark waits for covers after the hero is settled (ms). */
export const COVER_WAIT_MS = 150;
/** The watch ends this long after the page started (ms). */
const WATCH_MS = 10_000;

const DESK = '[data-testid="home"][data-desk]';

function mark(): void {
  if (performance.getEntriesByName(DESK_PAINTED_MARK).length === 0) {
    performance.mark(DESK_PAINTED_MARK);
  }
}

/** Resolves once `ready()` holds inside `root` (watching its changes), or after `ms`. */
function whenReady(root: Element, ready: () => boolean, ms: number): Promise<void> {
  return new Promise((resolve) => {
    if (ready()) {
      resolve();
      return;
    }
    const done = () => {
      observer.disconnect();
      window.clearTimeout(timer);
      resolve();
    };
    const observer = new MutationObserver(() => ready() && done());
    observer.observe(root, { childList: true, subtree: true, attributes: true });
    const timer = window.setTimeout(done, ms);
  });
}

/** Resolves once every cover image of `desk` that is there decodes, or at `ms`. */
async function coversDecoded(desk: Element, ms: number): Promise<void> {
  const deadline = new Promise<void>((resolve) => window.setTimeout(resolve, ms));
  const decoded = (async () => {
    // No stored covers: nothing to wait for. Otherwise the images arrive a frame or two after
    // the desk mounts (the hook reads the prefetched records in an effect).
    if ((await prefetchCovers()).length === 0) return;
    await whenReady(desk, () => desk.querySelector('img[data-cover]') !== null, ms);
    const images = [...desk.querySelectorAll<HTMLImageElement>('img[data-cover]')];
    await Promise.all(images.map((image) => image.decode().catch(() => undefined)));
  })();
  await Promise.race([decoded, deadline]);
}

/** Starts watching for the desk's first paint (the module does it once on load). */
export function watchDeskPainted(): void {
  if (typeof document === 'undefined' || !deskEnabled()) return;
  if (performance.getEntriesByName(DESK_PAINTED_MARK).length > 0) return;
  const found = (): boolean => {
    const desk = document.querySelector(DESK);
    if (!desk) return false;
    void whenReady(
      desk,
      () => desk.querySelector('[data-hero]')?.getAttribute('data-hero') !== 'holding',
      HERO_WAIT_MS,
    )
      .then(() => coversDecoded(desk, COVER_WAIT_MS))
      .then(() => requestAnimationFrame(mark));
    return true;
  };
  if (found()) return;
  const observer = new MutationObserver(() => {
    if (found()) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.setTimeout(() => observer.disconnect(), WATCH_MS);
}

watchDeskPainted();
