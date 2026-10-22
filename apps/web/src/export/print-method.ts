/**
 * How Print… prints (PRD-25; `docs/research/print-2026-10.md`), chosen by feature detection:
 *
 * - **`frame`**: the exported PDF in a hidden iframe, printed by the browser's own PDF viewer
 *   (`contentWindow.print()`). Exact output, vector text, no rendering of ours. Taken where
 *   `navigator.pdfViewerEnabled` says a viewer exists, except on WebKit, whose PDF view in a
 *   frame prints blank or the parent page (Safari) and does not print at all on iPadOS.
 * - **`pages`**: every page rendered to an image in a print-only sheet and `window.print()`;
 *   works everywhere, at `printDpi`.
 *
 * WebKit is told by what only it ships (`GestureEvent`, iOS's `navigator.standalone`), not by
 * its user agent.
 */

export type PrintMethod = 'frame' | 'pages';

export interface PrintEnvironment {
  /** `navigator.pdfViewerEnabled`; undefined where the browser does not say. */
  readonly pdfViewer: boolean | undefined;
  readonly webkit: boolean;
}

export function printEnvironment(win: Window = window): PrintEnvironment {
  return {
    pdfViewer: win.navigator.pdfViewerEnabled,
    webkit: 'GestureEvent' in win || 'standalone' in win.navigator,
  };
}

export function choosePrintMethod(env: PrintEnvironment): PrintMethod {
  return env.pdfViewer === true && !env.webkit ? 'frame' : 'pages';
}

/** The rendered pages' resolution: print quality, never below screen. */
export const PRINT_DPI = 150;
export const PRINT_MIN_DPI = 72;
/**
 * Decoded pixels all rendered pages may hold together (≈ 1 GB as RGBA): the print snapshot
 * decodes every image at once, and a 400-page document at 150 dpi would need about 3.4 GB,
 * past what an iPad tab may use. Longer documents print at a lower resolution instead.
 */
export const PRINT_PIXEL_BUDGET = 240_000_000;

/** The dpi to render `sizes` (pages in points) at: `PRINT_DPI` within the budget. */
export function printDpi(sizes: readonly { width: number; height: number }[]): number {
  const squarePoints = sizes.reduce((sum, s) => sum + s.width * s.height, 0);
  if (squarePoints <= 0) return PRINT_DPI;
  const fit = 72 * Math.sqrt(PRINT_PIXEL_BUDGET / squarePoints);
  return Math.max(PRINT_MIN_DPI, Math.min(PRINT_DPI, Math.floor(fit)));
}
