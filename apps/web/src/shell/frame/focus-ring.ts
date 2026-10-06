/**
 * The read surfaces' focus ring after keyboard navigation only (review finding 23; V2 review
 * item 2). The pages of the stage and of the compact reader are one large focusable region
 * that also takes focus from script (opening a document, a mode key, focus-opened-page.ts).
 * Chromium rings a scripted focus as `:focus-visible` until the first pointer press, so a
 * document opened from a link or a restored session would ring the whole screen. The ring
 * shows only while the focus inside the root arrived by Tab or F6; the CSS hides it otherwise
 * (stage/ReadView.module.css, shell/compact/CompactReader.module.css).
 */

/** Keys after which the root shows its focus ring: Tab (and Shift+Tab) and F6. */
const NAVIGATION_KEYS: ReadonlySet<string> = new Set(['Tab', 'F6']);
/** A focus change this soon after a navigation key came from it (ms). */
const NAVIGATION_FOCUS_MS = 500;
/** On the root while the focus inside it arrived by Tab or F6. */
export const FOCUS_RING_ATTR = 'data-focus-ring';

/**
 * Marks the element `root` returns with `data-focus-ring` while the focus in it arrived by
 * Tab or F6, and clears it on any other focus change and on a press. Returns a disposer.
 */
export function watchFocusRing(
  root: () => HTMLElement | null,
  doc: Document = document,
): () => void {
  let navigatedAt = Number.NEGATIVE_INFINITY;
  const onKeyDown = (event: globalThis.KeyboardEvent) => {
    navigatedAt = NAVIGATION_KEYS.has(event.key) ? performance.now() : Number.NEGATIVE_INFINITY;
  };
  const onFocusIn = (event: FocusEvent) => {
    const element = root();
    if (!element || !(event.target instanceof Node) || !element.contains(event.target)) return;
    element.toggleAttribute(
      FOCUS_RING_ATTR,
      performance.now() - navigatedAt <= NAVIGATION_FOCUS_MS,
    );
  };
  const onPointerDown = () => {
    navigatedAt = Number.NEGATIVE_INFINITY;
    root()?.removeAttribute(FOCUS_RING_ATTR);
  };
  doc.addEventListener('keydown', onKeyDown, true);
  doc.addEventListener('focusin', onFocusIn, true);
  doc.addEventListener('pointerdown', onPointerDown, true);
  return () => {
    doc.removeEventListener('keydown', onKeyDown, true);
    doc.removeEventListener('focusin', onFocusIn, true);
    doc.removeEventListener('pointerdown', onPointerDown, true);
  };
}
