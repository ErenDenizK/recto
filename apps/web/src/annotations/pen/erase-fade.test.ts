/**
 * Erased strokes fade (motion-2026-10/ink-shapes.md §5): the ghost of what an erase removed
 * waits unseen on the layer, shows in the task the page draws its bitmap without the strokes,
 * fades out and goes.
 */
import type { Annotation } from '@pdf-editor/engine';
import { afterEach, describe, expect, it } from 'vitest';

import { getEngineService } from '../../engine/engine-service';
import { notePageBitmap } from '../../viewer/read-controller';
import type { PageTarget } from '../annotation-store';
import type { PageFrame } from '../geometry';
import { mountedLayers } from '../layer-registry';
import { fadeErased, ghostOf } from './erase-fade';

const FRAME: PageFrame = {
  size: { width: 612, height: 792 },
  originX: 0,
  originY: 0,
  rotation: 0,
  scale: 1,
};

const TARGET: PageTarget = {
  source: 'fade-src' as never,
  pageIndex: 0,
  pageId: 'fade-page' as never,
  position: 1,
};

const INK: Annotation = {
  id: 'i1',
  kind: 'ink',
  pageIndex: 0,
  rect: { x: 10, y: 10, width: 100, height: 20 },
  color: '#1e88e5',
  opacity: 0.8,
  strokeWidth: 2,
  paths: [
    [
      { x: 10, y: 700 },
      { x: 110, y: 710 },
    ],
    [
      { x: 10, y: 690 },
      { x: 60, y: 690 },
    ],
  ],
  widths: [
    [2, 4],
    [3, 3],
  ],
};

afterEach(() => {
  mountedLayers.delete(TARGET.pageId);
  for (const el of document.querySelectorAll('[data-test-layer]')) el.remove();
});

describe('the erase fade', () => {
  it('draws each erased path at its mean width in its colour and opacity', () => {
    const ghost = ghostOf([INK], FRAME);
    const lines = ghost?.querySelectorAll('polyline') ?? [];
    expect(lines).toHaveLength(2);
    expect(lines[0]?.getAttribute('stroke-width')).toBe('3');
    expect(lines[0]?.getAttribute('stroke')).toBe('#1e88e5');
    expect(lines[0]?.getAttribute('points')).toBe('10,92 110,82');
    expect(ghost?.querySelector('g')?.getAttribute('opacity')).toBe('0.8');
    expect(ghost?.style.opacity).toBe('0');
  });

  it('shows the ghost with the bitmap that lacks the strokes, then fades it out', async () => {
    const element = document.createElement('div');
    element.setAttribute('data-test-layer', '');
    document.body.appendChild(element);
    mountedLayers.set(TARGET.pageId, { element, frame: FRAME, target: TARGET });
    fadeErased(TARGET, [INK]);
    const ghost = element.querySelector<SVGSVGElement>('[data-erase-ghost]');
    expect(ghost?.style.opacity).toBe('0');
    const revision = getEngineService().pageRevision(TARGET.source, TARGET.pageIndex);
    notePageBitmap(TARGET.source, TARGET.pageIndex, revision);
    expect(ghost?.style.opacity).toBe('1');
    expect(ghost?.getAnimations().length).toBe(1);
    await ghost?.getAnimations()[0]?.finished;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(element.querySelector('[data-erase-ghost]')).toBeNull();
  });
});
