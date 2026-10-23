/**
 * The page's flight into the tab (the save receipt, DSN-67; MOT-3: things go back into what
 * they came from): on the press that saves, the first changed page of the receipt lifts off the
 * sheet, a fixed copy of its thumbnail over everything, and flies into the document's tab (else
 * the title button) on `smooth`, shrinking and fading as it arrives; the tab takes a receive
 * pulse. The toast that says the copy was written follows when the job is done.
 *
 * Moved by `transform` and `opacity` only and removed when it ends (Q-2). Under reduced motion
 * there is no flight: the copy stays where it is and fades out (§7.5).
 */
import { animateStyle, reducedMotion } from '../motion';
import { receivePulse } from '../motion/feedback';

/** Marks the receipt's first thumbnail, the page that flies. */
export const FLIGHT_SOURCE_ATTRIBUTE = 'data-receipt-flight';

/** Where the page lands: the document's tab, else the title button. Only a shown one counts. */
function destination(): HTMLElement | null {
  for (const selector of ['[role="tab"][aria-selected="true"]', '[data-testid="document-menu"]']) {
    const found = document.querySelector<HTMLElement>(selector);
    if (found && found.getBoundingClientRect().width > 0) return found;
  }
  return null;
}

/** A still of the sheet's thumbnail: its page canvas drawn into a fixed copy at the same place. */
function lift(source: HTMLElement): HTMLCanvasElement | null {
  const page = source.querySelector<HTMLCanvasElement>('canvas');
  const rect = source.getBoundingClientRect();
  if (!page || page.width === 0 || rect.width <= 0 || rect.height <= 0) return null;
  const copy = document.createElement('canvas');
  copy.width = page.width;
  copy.height = page.height;
  copy.getContext('2d')?.drawImage(page, 0, 0);
  copy.setAttribute('aria-hidden', 'true');
  copy.dataset.receiptFlyer = '';
  Object.assign(copy.style, {
    position: 'fixed',
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    zIndex: '1000',
    pointerEvents: 'none',
    borderRadius: 'var(--radius-page)',
    background: 'var(--page-background)',
    boxShadow: '0 0 0 1px var(--border-hairline)',
    // Dim pages composites the copy as it does the page (MOB-17).
    filter: 'var(--page-filter)',
  });
  document.body.append(copy);
  return copy;
}

/** The flight on its way, so the toast can wait for the page to land. */
let landing: Promise<void> = Promise.resolve();

/** Resolves when the page has landed in the tab (at once when none is flying). */
export const flightLanded = (): Promise<void> => landing;

/**
 * Flies the receipt's first thumbnail into the tab. Call it inside the press that saves, while
 * the sheet still shows; `flightLanded` resolves when the page is in. Does nothing without a
 * thumbnail.
 */
export function flyPageToTab(): void {
  landing = fly();
}

function fly(): Promise<void> {
  const source = document.querySelector<HTMLElement>(`[${FLIGHT_SOURCE_ATTRIBUTE}]`);
  const flyer = source ? lift(source) : null;
  const rect = source?.getBoundingClientRect();
  const target = destination();
  if (!flyer || !rect) return Promise.resolve();
  if (reducedMotion() || !target) {
    return animateStyle(flyer, 'opacity', 1, 0, { spring: 'quick', keep: true }).finished.then(() =>
      flyer.remove(),
    );
  }
  const to = target.getBoundingClientRect();
  // Into the tab, centre on centre, down to the tab's height; it fades once it has arrived.
  const scale = Math.min(0.4, Math.max(0.12, to.height / rect.height));
  const dx = to.left + to.width / 2 - (rect.left + rect.width / 2);
  const dy = to.top + to.height / 2 - (rect.top + rect.height / 2);
  const flight = animateStyle(flyer, 'transform', [0, 0, 1, 1], [dx, dy, scale, scale], {
    spring: 'smooth',
    keep: true,
    onComplete: () => {
      receivePulse(target);
      animateStyle(flyer, 'opacity', 1, 0, {
        spring: 'quick',
        keep: true,
        onComplete: () => flyer.remove(),
      });
    },
  });
  return flight.finished;
}
