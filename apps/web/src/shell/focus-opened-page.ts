/**
 * After files open from the picker (+ on the strip, Home's "Open files", Mod+O, the palette),
 * focus moves to the pages of the document now showing (01-frame F3 §6: "on success the new tab
 * is active and focus goes to the page"). Left on +, the focus made the first shortcut draw the
 * ring around + (XD-3), and the arrow keys did not scroll the new document.
 *
 * It does not take the focus when the open should keep it:
 * - the caller skips it when the open lands on Home (several files: their cards are selected);
 * - focus moved while the files were read (into a field, a dialog, another control): only when
 *   the focus is still where it was when the picker opened, or fell to `<body>` because that
 *   control left with its view (Home's "Open files", the previous document's pages), is it moved.
 *
 * The pages mount a frame or more after the open resolves, so it waits for them, at most
 * `MAX_FRAMES` frames; a view without the page viewport (Arrange) keeps the focus where it is.
 */

/** About one second at 60 Hz: the page view mounts within a few frames of the open. */
const MAX_FRAMES = 60;

// The stage and tab ids (`STAGE_ID`, `tabDomId` in shell/frame/ids.ts), kept here as literals
// as before the frame (D2-1) moved them.
const STAGE = 'stage';
const tabId = (documentId: string) => `tab-${documentId}`;

/** Whether the focus is still the picker's to move (module header). */
function focusUnmoved(before: Element | null, doc: Document): boolean {
  const active = doc.activeElement;
  return active === null || active === doc.body || active === before;
}

/**
 * Moves the focus to `documentId`'s page viewport (stage/ReadView: the focusable region that is
 * Read and Edit's Tab stop) once the stage shows that document, unless the focus moved since
 * `before` (the element focused when the picker opened). Returns a canceller.
 */
export function focusOpenedPage(
  documentId: string,
  before: Element | null,
  doc: Document = document,
): () => void {
  let frame = 0;
  let handle = 0;
  const tick = () => {
    if (!focusUnmoved(before, doc)) return;
    // The stage is labelled by the tab of the document it shows: not the previous one's pages.
    const stage = doc.getElementById(STAGE);
    const viewport =
      stage?.getAttribute('aria-labelledby') === tabId(documentId)
        ? stage.querySelector<HTMLElement>('[data-read-viewport]')
        : null;
    if (viewport) {
      // No scroll: the page view places itself; the stage shows its ring only after Tab or
      // F6 (Stage.tsx `watchStageFocusRing`), so this focus draws none.
      viewport.focus({ preventScroll: true });
      return;
    }
    frame += 1;
    if (frame < MAX_FRAMES) handle = requestAnimationFrame(tick);
  };
  handle = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(handle);
}
