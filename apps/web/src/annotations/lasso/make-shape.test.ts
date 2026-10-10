/**
 * Make shape (motion-2026-10/ink-shapes.md §8): the lasso selection's recognisable strokes
 * become shapes in one history entry (an undo brings the strokes back), the rest stay ink,
 * and a selection with nothing to recognise says so in the bar's notice without an edit.
 */
import { getActiveDocument } from '@pdf-editor/document-model';
import type { InkAnnotation } from '@pdf-editor/engine';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import simpleUrl from '../../../../../test/fixtures/simple-text.pdf?url';
import { enterEditMode, fixtureFile } from '../../../test/store-harness';
import { resetWorkspace, useWorkspaceStore } from '../../state/workspace-store';
import { resetToolStore } from '../../viewer/tool-store';
import { createAnnotations } from '../actions';
import { type PageTarget, resetAnnotationStore, useAnnotationStore } from '../annotation-store';
import { readAnnotations, resetEditRunner, whenIdle } from '../edit-runner';
import type { PageFrame } from '../geometry';
import type { Point } from '../ink';
import { mountedLayers } from '../layer-registry';
import { shapeKit } from '../pen/shape-kit';
import { resetLassoEdits, useLassoNotice } from './edits';
import { makeShapes, planShapes } from './make-shape';

/** CSS px = pt, y down from the top of a 792 pt page. */
const FRAME: PageFrame = {
  size: { width: 612, height: 792 },
  originX: 0,
  originY: 0,
  rotation: 0,
  scale: 1,
};

/** A hand-drawn rectangle, user space (y up). */
function rectanglePath(): Point[] {
  const corners = [
    [100, 600],
    [300, 603],
    [302, 500],
    [99, 498],
    [101, 599],
  ] as const;
  const out: Point[] = [];
  for (let i = 1; i < corners.length; i++) {
    const [ax, ay] = corners[i - 1]!;
    const [bx, by] = corners[i]!;
    for (let k = 0; k < 20; k++) {
      const t = k / 20;
      out.push({ x: ax + (bx - ax) * t + Math.sin(i * 20 + k) * 0.6, y: ay + (by - ay) * t });
    }
  }
  out.push({ x: 101, y: 599 });
  return out;
}

/** A handwritten "m", user space. */
function letterPath(): Point[] {
  const out: Point[] = [];
  for (let i = 0; i <= 60; i++) {
    const t = (i / 60) * 3 * Math.PI;
    out.push({ x: 350 + i * 1.5, y: 550 + 20 * Math.abs(Math.sin(t)) });
  }
  return out;
}

const model = () => useWorkspaceStore.getState();

async function openSimple(): Promise<PageTarget> {
  await model().openFiles([await fixtureFile(simpleUrl, 'simple.pdf')]);
  enterEditMode();
  const page = getActiveDocument(model().workspace)?.pages[0];
  if (page?.ref.kind !== 'source') throw new Error('no source page');
  return { source: page.ref.source, pageIndex: page.ref.index, pageId: page.id, position: 1 };
}

async function inkWith(target: PageTarget, paths: Point[][]): Promise<InkAnnotation> {
  const created = await createAnnotations(target, [
    {
      kind: 'ink',
      pageIndex: target.pageIndex,
      color: '#1e88e5',
      opacity: 1,
      strokeWidth: 2,
      paths,
      rect: { x: 90, y: 480, width: 360, height: 140 },
    },
  ]);
  const ink = created?.[0];
  if (ink?.kind !== 'ink') throw new Error('no ink');
  await useAnnotationStore.getState().reloadPage(target.source, target.pageIndex);
  return ink;
}

describe('make shape', () => {
  let element: HTMLDivElement;
  beforeEach(() => {
    resetWorkspace();
    resetEditRunner();
    resetAnnotationStore();
    resetToolStore();
    resetLassoEdits();
    element = document.createElement('div');
    document.body.appendChild(element);
  });
  afterEach(async () => {
    await whenIdle();
    for (const key of [...mountedLayers.keys()]) mountedLayers.delete(key);
    element.remove();
    resetAnnotationStore();
    resetWorkspace();
  });

  it('recognises the rectangle and leaves the letter', async () => {
    const ink = {
      id: 'i',
      kind: 'ink',
      pageIndex: 0,
      rect: { x: 0, y: 0, width: 1, height: 1 },
      strokeWidth: 2,
      paths: [rectanglePath(), letterPath()],
    } as const;
    const plans = planShapes([ink], { i: [0, 1] }, FRAME, await shapeKit.load());
    expect(plans.map((p) => [p.index, p.fit.kind])).toEqual([[0, 'rectangle']]);
  });

  it('turns the strokes into shapes in one entry; one undo brings them back', async () => {
    const target = await openSimple();
    mountedLayers.set(target.pageId, { element, frame: FRAME, target });
    const ink = await inkWith(target, [rectanglePath(), letterPath()]);
    useAnnotationStore.getState().selectPaths(target, { [ink.id]: [0, 1] }, 'lasso-test');
    const before = model().history.past.length;
    expect(await makeShapes()).toBe(1);
    await whenIdle();
    const kinds = async () =>
      (await readAnnotations(target.source, target.pageIndex)).map((a) =>
        a.kind === 'ink' ? `ink:${a.paths.length}` : a.kind,
      );
    expect((await kinds()).sort()).toEqual(['ink:1', 'square']);
    expect(model().history.past.length).toBe(before + 1);
    expect(model().history.present.label).toBe('Make shapes');
    expect(useAnnotationStore.getState().selection).toBeNull();
    model().undo();
    await whenIdle();
    expect(await kinds()).toEqual(['ink:2']);
  });

  it('says so when nothing in the selection is a shape, and changes nothing', async () => {
    const target = await openSimple();
    mountedLayers.set(target.pageId, { element, frame: FRAME, target });
    const ink = await inkWith(target, [letterPath()]);
    useAnnotationStore.getState().selectPaths(target, { [ink.id]: [0] }, 'lasso-none');
    const before = model().history.past.length;
    expect(await makeShapes()).toBe(0);
    expect(useLassoNotice.getState()).toEqual({
      key: 'lasso-none',
      message: 'No shape in the selection',
    });
    expect(model().history.past.length).toBe(before);
  });
});
