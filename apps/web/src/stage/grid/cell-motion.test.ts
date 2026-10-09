/**
 * The Pages grid's physical motion (cell-motion.ts, lift.ts, make-way.ts, rotate-motion.ts;
 * docs/design/motion-2026-10/pages.md): the cascade's 150 ms, the ripple's order, the lean's
 * 3° cap, the gap's neighbours, the rotation's turn, and nothing left behind at rest (Q-2).
 */
import type { DocumentId, PageId } from '@pdf-editor/document-model';
import { afterEach, describe, expect, it } from 'vitest';

import { CASCADE_MS, cascadeIn, cascadeOut, rippleSelection, shrinkOut } from './cell-motion';
import { playCells } from './flip-cells';
import { MAX_TILT_DEG, tiltFor } from './lift';
import { MAKE_WAY_PX, neighbours } from './make-way';
import { spinSheet, turnBetween } from './rotate-motion';

const id = (n: number) => `p${n}` as PageId;
const DOC = 'd1' as DocumentId;

/** A grid of `count` cells, 4 to a row, in a `[data-grid-viewport]`, as PageCell draws them. */
function grid(count: number): HTMLElement {
  const viewport = document.createElement('div');
  viewport.dataset.gridViewport = '';
  viewport.style.cssText = 'position: relative; width: 800px;';
  for (let i = 0; i < count; i++) {
    const cell = document.createElement('div');
    cell.setAttribute('role', 'gridcell');
    cell.dataset.pageId = id(i);
    cell.style.cssText = `position: absolute; left: ${(i % 4) * 120}px; top: ${Math.floor(i / 4) * 160}px; width: 100px; height: 150px;`;
    cell.innerHTML =
      '<div class="box"><div data-thumb style="width: 90px; height: 120px; background: white"><span data-select-toggle></span></div></div><div class="meta">1</div>';
    viewport.append(cell);
  }
  document.body.append(viewport);
  return viewport;
}

afterEach(() => {
  delete document.documentElement.dataset.motion;
  document.body.replaceChildren();
});

describe('cascade', () => {
  it('brings the other cells in from the current page outward within 150 ms', () => {
    const root = grid(8);
    cascadeIn(id(0));
    const current = root.querySelector('[data-page-id="p0"] .box') as HTMLElement;
    expect(current.getAnimations()).toHaveLength(0);
    const near = (root.querySelector('[data-page-id="p1"] .box') as HTMLElement).getAnimations();
    const far = (root.querySelector('[data-page-id="p7"] .box') as HTMLElement).getAnimations();
    const timing = (a: Animation | undefined) => a?.effect?.getComputedTiming();
    const nearEnd = Number(timing(near[0])?.endTime);
    const farEnd = Number(timing(far[0])?.endTime);
    expect(Number(timing(near[0])?.delay)).toBeLessThan(Number(timing(far[0])?.delay));
    expect(farEnd).toBeLessThanOrEqual(CASCADE_MS + 0.001);
    expect(nearEnd).toBeLessThan(farEnd);
  });

  it('takes the cells out farthest first, and gives them back when the way out stops', () => {
    const root = grid(8);
    const undo = cascadeOut(id(0));
    const delay = (n: number) =>
      Number(
        (root.querySelector(`[data-page-id="p${n}"] .box`) as HTMLElement)
          .getAnimations()[0]
          ?.effect?.getComputedTiming().delay,
      );
    expect(delay(7)).toBeLessThan(delay(1));
    undo();
    expect(root.querySelectorAll('.box')[3]?.getAnimations()).toHaveLength(0);
  });

  it('only fades under reduced motion', () => {
    document.documentElement.dataset.motion = 'reduced';
    const root = grid(4);
    cascadeIn(id(0));
    const anim = (root.querySelector('[data-page-id="p2"] .box') as HTMLElement).getAnimations()[0];
    const frames = (anim?.effect as KeyframeEffect).getKeyframes();
    expect(frames.every((f) => f.transform === undefined)).toBe(true);
    expect(Number(anim?.effect?.getComputedTiming().endTime)).toBeLessThanOrEqual(150);
  });
});

describe('rippleSelection', () => {
  it('pops each badge in the order given, one step apart', () => {
    const root = grid(6);
    rippleSelection([id(2), id(3), id(4)], root);
    const delay = (n: number) =>
      Number(
        root
          .querySelector(`[data-page-id="p${n}"] [data-select-toggle]`)
          ?.getAnimations()[0]
          ?.effect?.getComputedTiming().delay,
      );
    expect(delay(2)).toBe(0);
    expect(delay(3)).toBeGreaterThan(0);
    expect(delay(4)).toBeGreaterThan(delay(3));
  });
});

describe('leaving and landing', () => {
  it('leaves a shrinking copy that removes itself', async () => {
    const root = grid(2);
    shrinkOut({ id: id(0), box: new DOMRect(0, 0, 90, 120), canvas: null }, root);
    const ghost = root.querySelector<HTMLElement>('[data-page-ghost]');
    expect(ghost).not.toBeNull();
    await ghost?.getAnimations()[0]?.finished;
    expect(root.querySelector('[data-page-ghost]')).toBeNull();
  });

  it('grows in a page the workspace did not know, and leaves the others still', () => {
    const root = grid(3);
    playCells(root, new Map(), new Set([id(0), id(1)]));
    const grown = root.querySelector('[data-page-id="p2"] .box')?.getAnimations() ?? [];
    expect(grown.length).toBeGreaterThan(0);
    expect(root.querySelector('[data-page-id="p1"] .box')?.getAnimations()).toHaveLength(0);
  });
});

describe('lift', () => {
  it('leans toward the drag, at most 3°', () => {
    expect(tiltFor(0)).toBe(0);
    expect(tiltFor(400)).toBeGreaterThan(0);
    expect(tiltFor(-400)).toBeLessThan(0);
    expect(tiltFor(10_000)).toBe(MAX_TILT_DEG);
    expect(tiltFor(-10_000)).toBe(-MAX_TILT_DEG);
  });
});

describe('make way', () => {
  const sections = {
    columns: 4,
    pages: (doc: DocumentId) => (doc === DOC ? [0, 1, 2, 3, 4, 5].map(id) : undefined),
  };
  const gap = (row: number, column: number) => ({
    kind: 'gap' as const,
    section: DOC,
    gap: { index: row * 4 + column, row, column },
    duplicate: false,
    files: false,
  });

  it('parts the two cells beside a gap', () => {
    expect(neighbours(gap(0, 2), sections)).toEqual([
      [id(1), -1],
      [id(2), 1],
    ]);
    expect(MAKE_WAY_PX).toBeGreaterThan(0);
  });

  it('moves only one cell at a row end, and none for files or no gap', () => {
    expect(neighbours(gap(0, 0), sections)).toEqual([[id(0), 1]]);
    expect(neighbours(gap(0, 4), sections)).toEqual([[id(3), -1]]);
    expect(neighbours({ ...gap(0, 2), files: true }, sections)).toEqual([]);
    expect(neighbours(null, sections)).toEqual([]);
  });
});

describe('rotate', () => {
  it('turns the short way, a half turn clockwise', () => {
    expect(turnBetween(0, 90)).toBe(90);
    expect(turnBetween(0, 270)).toBe(-90);
    expect(turnBetween(270, 0)).toBe(90);
    expect(turnBetween(90, 270)).toBe(180);
  });

  it('starts turned back in the old box and ends with no transform', async () => {
    const sheet = document.createElement('div');
    sheet.style.cssText = 'width: 120px; height: 90px;';
    document.body.append(sheet);
    spinSheet(sheet, 90, { width: 90, height: 120 });
    const [spin] = sheet.getAnimations();
    const first = (spin?.effect as KeyframeEffect).getKeyframes()[0];
    expect(String(first?.transform)).toContain('rotate(-90deg)');
    await spin?.finished;
    expect(sheet.style.transform).toBe('');
    expect(sheet.getAnimations()).toHaveLength(0);
  });
});
