/**
 * The Pages grid's cells as the reflow and its motion read them (docs/design/motion-2026-10/
 * pages.md): the drawn cells by page id, still copies of their pages, and where a drop left
 * its pages. Apart from `cell-motion.ts`, which holds the motion itself and loads with the first
 * document rather than with the editor (`grid-motion.ts`; PLAN.md §2.3 V1-P2), because the
 * reflow (`flip-cells.tsx`) and the drag read these synchronously.
 */
import type { PageId } from '@pdf-editor/document-model';

export const CELL = '[role="gridcell"][data-page-id]';

/** Whether `box` shows in the window. */
export function inView(box: DOMRect): boolean {
  return (
    box.width > 0 &&
    box.bottom > 0 &&
    box.right > 0 &&
    box.top < window.innerHeight &&
    box.left < window.innerWidth
  );
}

/** A still copy of a cell's page: its sheet's box on screen and a copy of its bitmap. */
export interface SheetSnapshot {
  readonly id: PageId;
  readonly box: DOMRect;
  readonly canvas: HTMLCanvasElement | null;
}

/** Copies `cell`'s page as it is drawn now. */
export function snapshotSheet(cell: Element): SheetSnapshot | null {
  const id = (cell as HTMLElement).dataset.pageId as PageId | undefined;
  const sheet = cell.querySelector<HTMLElement>('[data-thumb]');
  if (id === undefined || !sheet) return null;
  const box = sheet.getBoundingClientRect();
  if (box.width === 0 || box.height === 0) return null;
  const source = sheet.querySelector('canvas');
  let canvas: HTMLCanvasElement | null = null;
  if (source && source.width > 0 && source.height > 0) {
    canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    canvas.getContext('2d')?.drawImage(source, 0, 0);
  }
  return { id, box, canvas };
}

/** The drawn, on-screen cells of `ids`, copied (for Extract's flight). */
export function snapshotSheets(ids: readonly PageId[]): SheetSnapshot[] {
  const shots: SheetSnapshot[] = [];
  for (const id of ids) {
    const cell = document.querySelector(
      `[data-grid-viewport] ${CELL}[data-page-id="${CSS.escape(id)}"]`,
    );
    const shot = cell ? snapshotSheet(cell) : null;
    if (shot && inView(shot.box)) shots.push(shot);
  }
  return shots;
}

/** Where dropped pages were under the finger (viewport box), until the reflow takes it. */
let dropOrigin: { readonly ids: ReadonlySet<PageId>; readonly box: DOMRect; at: number } | null =
  null;

/** The reflow after a drop starts `ids` from `box`, the preview's place (module header). */
export function noteDropOrigin(ids: Iterable<PageId>, box: DOMRect): void {
  dropOrigin = { ids: new Set(ids), box, at: performance.now() };
}

/** The drop origin for `id`, if a drop just noted one (taken by the next reflow). */
export function dropOriginOf(id: string): DOMRect | undefined {
  if (!dropOrigin || performance.now() - dropOrigin.at > 1000) return undefined;
  return dropOrigin.ids.has(id as PageId) ? dropOrigin.box : undefined;
}

/** Forgets the drop origin once a reflow has used it. */
export function clearDropOrigin(): void {
  dropOrigin = null;
}

/** The cells drawn under `root`, by page id. */
export function cellsById(root: ParentNode): Map<string, HTMLElement> {
  const cells = new Map<string, HTMLElement>();
  for (const cell of root.querySelectorAll<HTMLElement>(CELL)) {
    const id = cell.dataset.pageId;
    if (id !== undefined) cells.set(id, cell);
  }
  return cells;
}
