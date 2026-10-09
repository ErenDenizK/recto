/**
 * Watches the one-shot signature tool place a signature, for the placing flight (`flight.ts`,
 * motion-2026-10 forms-compact §2). The palette's Sign button runs it while it is shown.
 *
 * The page creates the placed stamp and selects it; the palette's rule clears that selection
 * in the same update and returns to Select (`markup/palette-groups.ts`), so the selection is
 * never seen from outside. What is seen is the tool leaving `signature` with a signature still
 * armed: then the flight's start is the armed signature's chip (or the Sign button), its image
 * the armed stamp's, and the stamps already on the pages are noted. The first stamp box that
 * shows up on a page within `MAX_WAIT_FRAMES` is where it lands; a still of the page from
 * before the placement covers the page's own drawing of it until the flight arrives, so the
 * signature is never drawn twice. Leaving the tool without
 * placing (Esc, another tool) adds no stamp, and the watch lapses.
 */
import { useAnnotationStore } from '../annotations/annotation-store';
import { reducedMotion } from '../motion';
import { useToolStore } from '../viewer/tool-store';
import { flyToPage, pageMask, snapshotPages } from './flight';
import { armedSavedSignature } from './saved-signatures';

/** Frames to wait for the placed stamp's box on the page (its annotations reload first). */
const MAX_WAIT_FRAMES = 45;

const STAMPS = '[data-annotation-id][data-annotation-kind="stamp"]';

let watchers = 0;
let stop: (() => void) | null = null;

function start(): () => void {
  return useToolStore.subscribe((state, previous) => {
    if (previous.mode !== 'signature' || state.mode === 'signature') return;
    const pending = useAnnotationStore.getState().pendingStamp;
    const blob = pending?.kind === 'signature' ? pending.blob : undefined;
    if (!pending || !blob) return;
    const saved = armedSavedSignature('signature', pending);
    const chip =
      (saved ? document.querySelector(`[data-saved-signature="${CSS.escape(saved)}"]`) : null) ??
      document.querySelector('[data-tool="signature"]');
    const from = chip?.getBoundingClientRect();
    if (!from || from.width <= 0) return;
    // The pages as they are before the stamp is drawn into them, to hide its early drawing.
    const pages = reducedMotion() ? [] : snapshotPages();
    const before = new Set(
      [...document.querySelectorAll<HTMLElement>(STAMPS)].map((el) => el.dataset.annotationId),
    );
    let frames = 0;
    const land = () => {
      const placed = [...document.querySelectorAll<HTMLElement>(STAMPS)].find(
        (el) => !before.has(el.dataset.annotationId),
      );
      const to = placed?.getBoundingClientRect();
      if (to && to.width > 0) {
        const cx = to.left + to.width / 2;
        const cy = to.top + to.height / 2;
        const page = pages.find(
          ({ rect }) => cx >= rect.left && cx <= rect.right && cy >= rect.top && cy <= rect.bottom,
        );
        flyToPage(blob, from, to, page ? pageMask(page, to) : null);
      } else if (++frames < MAX_WAIT_FRAMES) requestAnimationFrame(land);
    };
    requestAnimationFrame(land);
  });
}

/** Starts watching while at least one caller does; returns the caller's stop. */
export function watchPlacements(): () => void {
  watchers += 1;
  stop ??= start();
  return () => {
    watchers -= 1;
    if (watchers === 0) {
      stop?.();
      stop = null;
    }
  };
}
