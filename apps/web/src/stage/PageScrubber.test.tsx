/**
 * The trailing page scrubber (Vitest browser mode, Chromium, real PDFium; 05-canvas §5; spec
 * D2-10): only with a coarse pointer and more than 20 pages; shown by a scroll and hidden
 * 1.5 s later; a real touch drag jumps to the page under the thumb and names it; the keys step.
 */
import '../styles/tokens.css';
import '../styles/reset.css';
import '../styles/global.css';

import type { VirtualDocument } from '@pdf-editor/document-model';
import { render, waitFor } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cdp, page, userEvent } from 'vitest/browser';

import manyUrl from '../../../../test/fixtures/many-pages.pdf?url';
import simpleUrl from '../../../../test/fixtures/simple-text.pdf?url';
import { openDocuments } from '../commands/app-commands';
import { useSelectionStore } from '../state/selection-store';
import { useUiStore } from '../state/ui-store';
import { useViewStore } from '../state/view-store';
import { resetWorkspace, useWorkspaceStore } from '../state/workspace-store';
import { pageAtFraction, SCRUBBER_LINGER_MS } from './PageScrubber';
import { ReadView } from './ReadView';

function devtools<T = unknown>(method: string, params: object = {}): Promise<T> {
  return (cdp() as unknown as { send(m: string, p: object): Promise<T> }).send(method, params);
}

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

/** Emulates a touch screen, which makes `(pointer: coarse)` match. */
const coarse = (enabled: boolean) =>
  devtools('Emulation.setTouchEmulationEnabled', { enabled, maxTouchPoints: enabled ? 5 : 1 });

function documentNamed(name: string): VirtualDocument {
  const { workspace } = useWorkspaceStore.getState();
  const doc = workspace.documentOrder
    .map((id) => workspace.documents[id])
    .find((d) => d?.title === name);
  if (!doc) throw new Error(`${name} not opened`);
  return doc;
}

function mount(doc: VirtualDocument) {
  return render(
    <div style={{ display: 'flex', flexDirection: 'column', height: 860 }}>
      <ReadView doc={doc} />
    </div>,
  );
}

/** The thumb's page once two frames in a row agree on it. */
async function settledValue(thumb: HTMLElement): Promise<number> {
  const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  let previous = Number.NaN;
  for (let i = 0; i < 120; i++) {
    const value = Number(thumb.getAttribute('aria-valuenow'));
    if (value === previous) return value;
    previous = value;
    await frame();
    await frame();
  }
  return previous;
}

describe('pageAtFraction', () => {
  it('maps the thumb travel onto pages, ends included', () => {
    expect(pageAtFraction(0, 400)).toBe(0);
    expect(pageAtFraction(1, 400)).toBe(399);
    expect(pageAtFraction(0.5, 401)).toBe(200);
    expect(pageAtFraction(-1, 30)).toBe(0);
    expect(pageAtFraction(2, 30)).toBe(29);
  });
});

describe('PageScrubber (05-canvas §5)', () => {
  beforeAll(async () => {
    await page.viewport(820, 900);
    resetWorkspace();
    useSelectionStore.getState().apply({ selected: new Set(), anchor: null, focused: null });
    const files = await Promise.all(
      [
        ['many-pages.pdf', manyUrl],
        ['simple-text.pdf', simpleUrl],
      ].map(async ([name = '', url = '']) => {
        const bytes = await (await fetch(url)).arrayBuffer();
        return new File([bytes], name, { type: 'application/pdf' });
      }),
    );
    await openDocuments(files);
  });
  afterAll(async () => {
    await coarse(false);
    resetWorkspace();
  });

  it('is absent on a fine pointer, and comes with a touch screen', async () => {
    useUiStore.getState().zoomFit();
    const { container } = mount(documentNamed('many-pages'));
    const scrubber = () => container.querySelector('[data-testid="page-scrubber"]');
    expect(scrubber()).toBeNull();
    await coarse(true);
    await waitFor(() => expect(scrubber()).not.toBeNull());
  });

  it('is absent on a coarse pointer for 20 pages or fewer', async () => {
    await coarse(true);
    expect(matchMedia('(pointer: coarse)').matches).toBe(true);
    const { container } = mount(documentNamed('simple-text'));
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(container.querySelector('[data-testid="page-scrubber"]')).toBeNull();
  });

  it('shows on scroll, drags to a page in one move, steps by keys, hides after 1.5 s', async () => {
    await coarse(true);
    useUiStore.getState().zoomFit();
    useViewStore.getState().setCurrentPage(0);
    const { container } = mount(documentNamed('many-pages'));
    const track = await waitFor(() => {
      const el = container.querySelector<HTMLElement>('[data-testid="page-scrubber"]');
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    const thumb = track.querySelector<HTMLElement>('[role="slider"]');
    if (!thumb) throw new Error('no thumb');
    // Hidden at rest: not seen, not pressed, not focused.
    expect(getComputedStyle(track).visibility).toBe('hidden');

    const viewport = container.querySelector<HTMLElement>('[data-read-viewport]');
    if (!viewport) throw new Error('no viewport');
    viewport.scrollTop += 600;
    await waitFor(() => expect(track).toHaveAttribute('data-shown'));
    await waitFor(() => expect(getComputedStyle(track).opacity).toBe('1'));
    expect(thumb).toHaveAccessibleName('Scrub pages');
    expect(thumb).toHaveAttribute('aria-valuemax', '400');

    // One drag from the top of the track to its middle: the page under the thumb shows.
    const t = thumb.getBoundingClientRect();
    const trackBox = track.getBoundingClientRect();
    const x = t.left + t.width / 2;
    const middle = trackBox.top + trackBox.height / 2;
    await touch('touchStart', [[x, t.top + t.height / 2]]);
    for (let i = 1; i <= 8; i++) {
      await touch('touchMove', [[x, t.top + t.height / 2 + ((middle - t.top) * i) / 8]]);
    }
    await waitFor(() => expect(thumb).toHaveAttribute('data-dragging'));
    // Read the page once the last move has landed: on a slow runner the moves are still being
    // applied when the drag starts, and a value read early is overtaken by the next one.
    const dragged = await settledValue(thumb);
    expect(dragged).toBeGreaterThan(150);
    expect(dragged).toBeLessThan(250);
    expect(thumb).toHaveAttribute('aria-valuetext', `Page ${dragged} of 400`);
    expect(thumb.textContent).toBe(String(dragged));
    await touch('touchEnd', []);
    await waitFor(() => expect(useViewStore.getState().currentPage).toBe(dragged - 1));
    expect(thumb).not.toHaveAttribute('data-dragging');

    // The keys step one page, and End goes to the last.
    thumb.focus();
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(useViewStore.getState().currentPage).toBe(dragged));
    await userEvent.keyboard('{End}');
    await waitFor(() => expect(useViewStore.getState().currentPage).toBe(399));
    thumb.blur();

    // Hidden again 1.5 s after the last scroll.
    await new Promise((resolve) => setTimeout(resolve, SCRUBBER_LINGER_MS + 400));
    expect(track).not.toHaveAttribute('data-shown');
  }, 60_000);
});
