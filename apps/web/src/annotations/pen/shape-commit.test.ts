/**
 * Committing held shapes (motion-2026-10/ink-shapes.md §4): which PDF annotation each shape
 * becomes (a /Line, an arrow's /Line with /OpenArrow, a /Square on the axes, a /Polygon when
 * turned, a /Circle, a turned ellipse as clean ink), and on the engine: the raw stroke and
 * then the shape as two history entries, so one undo brings back the stroke as drawn and a
 * second removes it; a chip tap replaces the shape inside the second entry.
 */
import { getActiveDocument } from '@pdf-editor/document-model';
import type { ShapeAnnotation } from '@pdf-editor/engine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import simpleUrl from '../../../../../test/fixtures/simple-text.pdf?url';
import { enterEditMode, fixtureFile } from '../../../test/store-harness';
import { resetWorkspace, useWorkspaceStore } from '../../state/workspace-store';
import { resetToolStore, useToolStore } from '../../viewer/tool-store';
import {
  type PageTarget,
  resetAnnotationStore,
  TOOL_STYLES_STORAGE_KEY,
  useAnnotationStore,
} from '../annotation-store';
import { readAnnotations, resetEditRunner, whenIdle } from '../edit-runner';
import type { PageFrame } from '../geometry';
import { resetBursts } from './bursts';
import type { InkShape } from './ink-input';
import { commitShapeStroke, shapeDraft } from './shape-commit';
import type { ShapeGeometry, ShapeKind } from './shapes';

vi.mock(import('./dry-ink'), async (original) => ({
  ...(await original()),
  // No page canvas paints in this test: the commit does not wait for one.
  inkCommitted: () => Promise.resolve(),
}));

/** CSS px = pt, y down from the top of a 792 pt page. */
const FRAME: PageFrame = {
  size: { width: 612, height: 792 },
  originX: 0,
  originY: 0,
  rotation: 0,
  scale: 1,
};

const STYLE = { color: '#1e88e5', opacity: 1, strokeWidth: 2 } as const;

function rectangle(cx: number, cy: number, w: number, h: number, deg = 0) {
  const a = (deg * Math.PI) / 180;
  return [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ].map(([x = 0, y = 0]) => ({
    x: cx + x * Math.cos(a) - y * Math.sin(a),
    y: cy + x * Math.sin(a) + y * Math.cos(a),
  }));
}

const draft = (kind: ShapeKind, g: ShapeGeometry) =>
  shapeDraft(kind, g, FRAME, 0, { ...useAnnotationStore.getState().styles.ink, ...STYLE });

describe('what a shape commits as', () => {
  it('a line is a /Line; an arrow a /Line with an open arrow at its end', () => {
    const line = draft('line', {
      type: 'line',
      a: { x: 10, y: 10 },
      b: { x: 110, y: 10 },
      arrow: false,
    });
    expect(line.draft.kind).toBe('line');
    expect((line.draft as ShapeAnnotation).vertices).toEqual([
      { x: 10, y: 782 },
      { x: 110, y: 782 },
    ]);
    const arrow = draft('arrow', {
      type: 'line',
      a: { x: 10, y: 10 },
      b: { x: 110, y: 10 },
      arrow: true,
    });
    expect(arrow.label).toBe('arrow');
    expect((arrow.draft as ShapeAnnotation).lineEndings).toEqual({
      start: 'none',
      end: 'open-arrow',
    });
  });

  it('a rectangle on the axes is a /Square whose border is centred on the drawn line', () => {
    const square = draft('rectangle', { type: 'polygon', vertices: rectangle(200, 200, 100, 60) });
    expect(square.draft.kind).toBe('square');
    // The border (2 pt) is drawn inside /Rect: the box grows by half of it.
    expect(square.draft.rect).toEqual({ x: 149, y: 561, width: 102, height: 62 });
  });

  it('a turned rectangle, a triangle and a hexagon are /Polygons', () => {
    const turned = draft('rectangle', {
      type: 'polygon',
      vertices: rectangle(200, 200, 100, 60, 20),
    });
    expect(turned.draft.kind).toBe('polygon');
    expect((turned.draft as ShapeAnnotation).vertices).toHaveLength(4);
    const triangle = draft('triangle', {
      type: 'polygon',
      vertices: [
        { x: 0, y: 0 },
        { x: 50, y: 80 },
        { x: -50, y: 80 },
      ],
    });
    expect(triangle.draft.kind).toBe('polygon');
  });

  it('a circle and an ellipse on the axes are /Circles; a turned ellipse is clean ink', () => {
    const circle = draft('circle', { type: 'ellipse', cx: 100, cy: 100, rx: 40, ry: 40, angle: 0 });
    expect(circle.draft.kind).toBe('circle');
    expect(circle.draft.rect.width).toBeCloseTo(82, 0);
    const level = draft('ellipse', {
      type: 'ellipse',
      cx: 100,
      cy: 100,
      rx: 60,
      ry: 30,
      angle: Math.PI / 2,
    });
    expect(level.draft.kind).toBe('circle');
    expect(level.draft.rect.height).toBeCloseTo(122, 0);
    const turned = draft('ellipse', {
      type: 'ellipse',
      cx: 100,
      cy: 100,
      rx: 60,
      ry: 30,
      angle: 0.5,
    });
    expect(turned.draft.kind).toBe('ink');
  });
});

// ---------------------------------------------------------------------------
// On the engine
// ---------------------------------------------------------------------------

const model = () => useWorkspaceStore.getState();

async function openSimple(): Promise<PageTarget> {
  await model().openFiles([await fixtureFile(simpleUrl, 'simple.pdf')]);
  enterEditMode();
  const page = getActiveDocument(model().workspace)?.pages[0];
  if (page?.ref.kind !== 'source') throw new Error('no source page');
  return { source: page.ref.source, pageIndex: page.ref.index, pageId: page.id, position: 1 };
}

function held(
  kind: ShapeKind,
  geometry: ShapeGeometry,
): InkShape & { next?: ((k: ShapeKind, g: ShapeGeometry) => void) | undefined } {
  const raw = [
    { x: 100, y: 100 },
    { x: 190, y: 104 },
    { x: 201, y: 160 },
    { x: 104, y: 158 },
    { x: 101, y: 103 },
  ];
  const shape: InkShape & { next?: ((k: ShapeKind, g: ShapeGeometry) => void) | undefined } = {
    kind,
    geometry,
    raw: { points: raw, widths: raw.map(() => 2) },
    onNext: (handler) => {
      shape.next = handler ?? undefined;
    },
  };
  return shape;
}

describe('held shapes on the engine', () => {
  beforeEach(() => {
    localStorage.removeItem(TOOL_STYLES_STORAGE_KEY);
    resetWorkspace();
    resetEditRunner();
    resetAnnotationStore();
    resetToolStore();
    resetBursts();
    useToolStore.getState().setMode('ink');
  });
  afterEach(async () => {
    await whenIdle();
    resetBursts();
    resetToolStore();
    localStorage.removeItem(TOOL_STYLES_STORAGE_KEY);
    resetAnnotationStore();
    resetWorkspace();
  });

  it('a rectangle: the raw stroke, then the /Square; undo back to the stroke, then nothing', async () => {
    const page = await openSimple();
    const before = model().history.past.length;
    const shape = held('rectangle', { type: 'polygon', vertices: rectangle(150, 130, 100, 60) });
    const style = { ...useAnnotationStore.getState().styles.ink, ...STYLE };
    await commitShapeStroke(shape, () => () => undefined, FRAME, page, style);
    await whenIdle();
    const kinds = async () =>
      (await readAnnotations(page.source, page.pageIndex)).map((a) => a.kind);
    expect(await kinds()).toEqual(['square']);
    expect(model().history.past.length).toBe(before + 2);
    expect(model().history.present.label).toBe('Rectangle on page 1');

    // A chip tap: the next fit replaces the shape inside the same entry.
    shape.next?.('ellipse', { type: 'ellipse', cx: 150, cy: 130, rx: 50, ry: 30, angle: 0 });
    await whenIdle();
    expect(await kinds()).toEqual(['circle']);
    expect(model().history.past.length).toBe(before + 2);

    model().undo();
    await whenIdle();
    expect(await kinds()).toEqual(['ink']);
    model().undo();
    await whenIdle();
    expect(await kinds()).toEqual([]);
  });
});
