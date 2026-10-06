/**
 * The canvas zoom in the Read view (Vitest browser mode, Chromium, real PDFium, real touches
 * through the DevTools protocol; 05-canvas §4; spec D2-10):
 *
 * - a two-finger pinch moves only the zoom layer's `transform`: Chromium's own layout counter
 *   (`Performance.getMetrics`, `LayoutCount`) does not move during the pinch's frames;
 * - the commit at rest keeps the page under the fingers within 1 px of where the last
 *   transformed frame showed it, and leaves no transform behind (Q-2);
 * - Mod+wheel notches zoom by ×1.26 a step and commit once.
 */
import '../styles/tokens.css';
import '../styles/reset.css';
import '../styles/global.css';

import type { VirtualDocument } from '@pdf-editor/document-model';
import { render, waitFor } from '@testing-library/react';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cdp, page } from 'vitest/browser';

import mixedUrl from '../../../../test/fixtures/mixed-sizes.pdf?url';
import { openDocuments } from '../commands/app-commands';
import { useSelectionStore } from '../state/selection-store';
import { useUiStore } from '../state/ui-store';
import { useViewStore } from '../state/view-store';
import { resetWorkspace, useWorkspaceStore } from '../state/workspace-store';
import { NOTCH_FACTOR } from '../viewer/zoom-controller';
import { ReadView } from './ReadView';

/** Chrome DevTools Protocol, typed loosely (the provider's session type is not exported). */
function devtools<T = unknown>(method: string, params: object = {}): Promise<T> {
  return (cdp() as unknown as { send(m: string, p: object): Promise<T> }).send(method, params);
}

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

/** Real touches at client points of this frame (the test iframe may be scaled in the page). */
async function touch(type: 'touchStart' | 'touchMove' | 'touchEnd', points: [number, number][]) {
  const frame = window.frameElement?.getBoundingClientRect();
  const scale = frame && window.innerWidth ? frame.width / window.innerWidth : 1;
  await devtools('Input.dispatchTouchEvent', {
    type,
    touchPoints: points.map(([x, y], id) => ({
      x: (frame?.left ?? 0) + x * scale,
      y: (frame?.top ?? 0) + y * scale,
      id,
    })),
  });
}

async function layoutCount(): Promise<number> {
  const { metrics } = await devtools<{ metrics: { name: string; value: number }[] }>(
    'Performance.getMetrics',
  );
  return metrics.find((metric) => metric.name === 'LayoutCount')?.value ?? Number.NaN;
}

/** Waits until no layout has happened for ten frames in a row. */
async function settledLayouts(): Promise<void> {
  let count = await layoutCount();
  for (let still = 0; still < 10; ) {
    await nextFrame();
    const now = await layoutCount();
    still = now === count ? still + 1 : 0;
    count = now;
  }
}

function activeDocument(): VirtualDocument {
  const { workspace } = useWorkspaceStore.getState();
  const doc = workspace.documents[workspace.documentOrder[0] ?? ('' as never)];
  if (!doc) throw new Error('not opened');
  return doc;
}

function parts(container: HTMLElement) {
  const viewport = container.querySelector<HTMLElement>('[data-read-viewport]');
  const frame = viewport?.firstElementChild as HTMLElement | null;
  const layer = frame?.firstElementChild as HTMLElement | null;
  if (!viewport || !frame || !layer) throw new Error('no zoom layer');
  return { viewport, frame, layer };
}

const pageAt = (container: HTMLElement, index: number) => {
  const el = container.querySelector<HTMLElement>(`[data-page-index="${index}"]`);
  if (!el) throw new Error(`no page ${index}`);
  return el;
};

async function mount() {
  const view = render(
    <div style={{ display: 'flex', flexDirection: 'column', height: 860 }}>
      <ReadView doc={activeDocument()} />
    </div>,
  );
  await waitFor(
    () =>
      expect(
        view.container.querySelector('[data-page-index="0"] canvas[data-state="rendered"]'),
      ).not.toBeNull(),
    { timeout: 20_000 },
  );
  return view;
}

describe('canvas zoom (05-canvas §4)', () => {
  beforeAll(async () => {
    await page.viewport(1440, 900);
    resetWorkspace();
    useSelectionStore.getState().apply({ selected: new Set(), anchor: null, focused: null });
    const bytes = await (await fetch(mixedUrl)).arrayBuffer();
    await openDocuments([new File([bytes], 'mixed-sizes.pdf', { type: 'application/pdf' })]);
    await devtools('Performance.enable');
  });
  beforeEach(() => {
    useUiStore.getState().zoomFit();
    useViewStore.getState().setCurrentPage(0);
  });
  afterAll(async () => {
    await devtools('Performance.disable');
    resetWorkspace();
  });

  it('pinches with zero layouts and commits with the anchor within 1 px', async () => {
    const { container } = await mount();
    const { viewport, frame, layer } = parts(container);
    const box = viewport.getBoundingClientRect();
    const sheet = pageAt(container, 0).getBoundingClientRect();
    const centre: [number, number] = [
      Math.round(sheet.left + sheet.width * 0.3),
      Math.round(Math.min(sheet.bottom, box.bottom) - 200),
    ];
    const fingers = (gap: number): [number, number][] => [
      [centre[0] - gap / 2, centre[1]],
      [centre[0] + gap / 2, centre[1]],
    ];
    const zoom = useUiStore.getState().zoom;

    // Every write to the layer's style: the page's box just after it (the commit's scroll is
    // set in the same task as the transform's removal, before this observer runs).
    const samples: { transformed: boolean; rect: DOMRect }[] = [];
    const observer = new MutationObserver(() => {
      samples.push({
        transformed: layer.style.transform !== '',
        rect: pageAt(container, 0).getBoundingClientRect(),
      });
    });
    observer.observe(layer, { attributes: true, attributeFilter: ['style'] });

    await touch('touchStart', fingers(120));
    // The second finger prepared the layer (its one layout) before any pinch frame.
    await waitFor(() => expect(frame).toHaveAttribute('data-zooming'));
    // …and the rows it added have their bitmaps (a bitmap that arrives resizes its canvas, a
    // layout the pinch does not cause): the layout counter rests.
    await waitFor(
      () => {
        const canvases = [...container.querySelectorAll('[data-read-viewport] canvas')];
        expect(canvases.length).toBeGreaterThan(1);
        for (const canvas of canvases) {
          expect(canvas.getAttribute('data-state')).toMatch(/^(rendered|error)$/);
        }
      },
      { timeout: 20_000 },
    );
    await settledLayouts();
    const before = await layoutCount();
    for (let i = 1; i <= 12; i++) {
      await touch('touchMove', fingers(120 + i * 12));
      await nextFrame();
    }
    const during = (await layoutCount()) - before;
    expect(layer.style.transform).toMatch(/scale\(/);
    expect(during).toBe(0);

    await touch('touchEnd', []);
    await waitFor(() => expect(frame).not.toHaveAttribute('data-zooming'), { timeout: 5000 });
    observer.disconnect();
    expect(useUiStore.getState().zoom).toBeGreaterThan(zoom * 1.5);
    expect(layer.style.transform).toBe('');
    expect(getComputedStyle(layer).transform).toBe('none');

    const last = samples.findLastIndex((s) => s.transformed);
    const shown = samples[last]?.rect;
    const committed = samples[last + 1]?.rect;
    expect(shown && committed).toBeTruthy();
    if (!shown || !committed) return;
    expect(samples[last + 1]?.transformed).toBe(false);
    expect(Math.abs(committed.left - shown.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(committed.top - shown.top)).toBeLessThanOrEqual(1);
    expect(Math.abs(committed.width - shown.width)).toBeLessThanOrEqual(1);
  }, 60_000);

  it('steps ×1.26 per Mod+wheel notch about the pointer, and commits once', async () => {
    useUiStore.getState().setZoom(1);
    const { container } = await mount();
    const { viewport, frame } = parts(container);
    const box = viewport.getBoundingClientRect();
    const at = { clientX: box.left + box.width / 2, clientY: box.top + 300 };
    const notch = () =>
      viewport.dispatchEvent(
        new WheelEvent('wheel', { ...at, deltaY: -100, ctrlKey: true, cancelable: true }),
      );
    const commits: number[] = [];
    const unsubscribe = useUiStore.subscribe((s, p) => {
      if (s.zoom !== p.zoom) commits.push(s.zoom);
    });
    notch();
    notch();
    await waitFor(() => expect(frame).not.toHaveAttribute('data-zooming'), { timeout: 5000 });
    unsubscribe();
    expect(commits).toHaveLength(1);
    // Two steps, unless the second landed within reach of a fit detent and snapped to it.
    expect(commits[0]).toBeGreaterThan(NOTCH_FACTOR ** 2 / 1.07);
    expect(commits[0]).toBeLessThan(NOTCH_FACTOR ** 2 * 1.07);
  }, 60_000);
});
