/**
 * The Library's text-safe band (`02-library` L3 §2, Issue 2, decision 02.2; ADR-0025; A-5): the
 * one Library text that sits on bare canvas is the open-documents head ("Open · 3 documents ·
 * 16 pages · Select"). When the Library field lands (D3-8), its shader multiplies the light to 0
 * within 24 px of that row, so the text never sits on bare light (Y ≤ 0.026 under it).
 *
 * D4-1 publishes the row; D3-8 consumes it. The head row carries `data-text-safe`, and
 * `libraryTextSafeRect()` reads its rectangle in viewport pixels, already grown by the band's
 * 24 px, for the field's `textSafe` uniform. `watchLibraryTextSafe()` calls back with the rect
 * whenever the row moves or resizes (scroll, layout, the head appearing or leaving), so the
 * field can recompute on its own 150 ms ResizeObserver cadence without knowing the Library's
 * markup. Nothing here draws; with no field the attribute is inert.
 */

/** The attribute on the head row, and the selector D3-8 can use. */
export const TEXT_SAFE_ATTR = 'data-text-safe';
export const TEXT_SAFE_SELECTOR = `[${TEXT_SAFE_ATTR}]`;
/** How far beyond the row the light falls to 0 (L3 §2). */
export const TEXT_SAFE_BAND_PX = 24;

export interface TextSafeRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** The head row's rectangle grown by the band, in viewport CSS px; null with no head shown. */
export function libraryTextSafeRect(root: ParentNode = document): TextSafeRect | null {
  const row = root.querySelector<HTMLElement>(TEXT_SAFE_SELECTOR);
  if (!row) return null;
  const box = row.getBoundingClientRect();
  if (box.width === 0 && box.height === 0) return null;
  return {
    left: box.left - TEXT_SAFE_BAND_PX,
    top: box.top - TEXT_SAFE_BAND_PX,
    width: box.width + 2 * TEXT_SAFE_BAND_PX,
    height: box.height + 2 * TEXT_SAFE_BAND_PX,
  };
}

/**
 * Calls `onChange` with the text-safe rect now and after every change that can move it: the
 * row resizing, any scroll, the window resizing, and the row being added or removed. Returns
 * the disposer.
 */
export function watchLibraryTextSafe(
  onChange: (rect: TextSafeRect | null) => void,
  root: Document = document,
): () => void {
  let observed: Element | null = null;
  let frame = 0;
  const report = () => {
    frame = 0;
    onChange(libraryTextSafeRect(root));
  };
  const schedule = () => {
    if (frame === 0) frame = requestAnimationFrame(report);
  };
  const resize = new ResizeObserver(schedule);
  const track = () => {
    const row = root.querySelector(TEXT_SAFE_SELECTOR);
    if (row === observed) return;
    if (observed) resize.unobserve(observed);
    observed = row;
    if (row) resize.observe(row);
    schedule();
  };
  const mutations = new MutationObserver(track);
  mutations.observe(root.body, { childList: true, subtree: true });
  root.addEventListener('scroll', schedule, { capture: true, passive: true });
  root.defaultView?.addEventListener('resize', schedule);
  track();
  report();
  return () => {
    if (frame !== 0) cancelAnimationFrame(frame);
    resize.disconnect();
    mutations.disconnect();
    root.removeEventListener('scroll', schedule, { capture: true });
    root.defaultView?.removeEventListener('resize', schedule);
  };
}
