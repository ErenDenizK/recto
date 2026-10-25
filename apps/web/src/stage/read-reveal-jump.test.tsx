/**
 * A reveal asked for while an eased jump is still moving (Vitest browser mode, Chromium, real
 * PDFium): Find's next hit pressed during the previous step's jump. The reveal is measured from
 * where the running jump is heading (motion-2026-10 viewer.md §1: a second reveal composes), so
 * the reader lands on the new hit's page.
 *
 * Regression: the reveal was measured from the mid-flight scroll position. A hit still inside
 * the margins there counted as shown, so the jump was retargeted to where it happened to be and
 * stopped between two pages, on the previous one; the next search then started from that page
 * (e2e/viewer.spec.ts "finds text…" read "2 of 6" for "3 of 6" on CI).
 */
import '../styles/tokens.css';
import '../styles/reset.css';
import '../styles/global.css';

import type { VirtualDocument } from '@pdf-editor/document-model';
import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';

import outlineUrl from '../../../../test/fixtures/outline-named-dests.pdf?url';
import { openDocuments } from '../commands/app-commands';
import { useSelectionStore } from '../state/selection-store';
import { useUiStore } from '../state/ui-store';
import { useViewStore } from '../state/view-store';
import { resetWorkspace, useWorkspaceStore } from '../state/workspace-store';
import { isJumping, whenJumpsLanded } from '../viewer/jump';
import { revealHit, runSearch, selectHit, setSearchQuery, useSearchStore } from '../viewer/search';
import { ReadView } from './ReadView';

function activeDocument(): VirtualDocument {
  const { workspace } = useWorkspaceStore.getState();
  const doc = workspace.documents[workspace.documentOrder[0] ?? ('' as never)];
  if (!doc) throw new Error('not opened');
  return doc;
}

const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

describe('Read mode: a reveal during a jump', () => {
  beforeAll(async () => {
    await page.viewport(1280, 900);
    resetWorkspace();
    useSelectionStore.getState().apply({ selected: new Set(), anchor: null, focused: null });
    const bytes = await (await fetch(outlineUrl)).arrayBuffer();
    await openDocuments([
      new File([bytes], 'outline-named-dests.pdf', { type: 'application/pdf' }),
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lands on the page of the hit asked for, not where the running jump was', async () => {
    // A fixed zoom: a page is taller than the 600 px view, as in the app at its fit.
    useUiStore.getState().setZoom(1);
    useViewStore.getState().setCurrentPage(0);
    const doc = activeDocument();
    const { container } = render(
      <div style={{ display: 'flex', flexDirection: 'column', height: 600 }}>
        <ReadView doc={doc} />
      </div>,
    );
    const viewport = () => container.querySelector<HTMLElement>('[data-read-viewport]');
    await waitFor(() => expect(container.querySelector('[data-page-index]')).not.toBeNull());

    // One hit at the top of each page.
    setSearchQuery('outline-named-dests');
    await runSearch(doc, 0);
    expect(useSearchStore.getState().hits.map((hit) => hit.pageIndex)).toEqual([0, 1, 2, 3, 4, 5]);
    // Past the column's first moments, where a request lands at once (ReadView MOUNT_INSTANT_MS).
    await new Promise((resolve) => setTimeout(resolve, 400));

    // At rest on the third hit (page 3).
    revealHit(selectHit(2));
    await waitFor(() => expect(useViewStore.getState().currentPage).toBe(2));
    await whenJumpsLanded();

    // Back a hit, with the clock held so the jump stays where it is: advance it until page 2
    // is the reader's page while the third hit is still inside the view's margins.
    let now = performance.now();
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    revealHit(selectHit(1));
    for (let i = 0; i < 400 && useViewStore.getState().currentPage !== 1; i++) {
      now += 1;
      await frame();
      await frame();
    }
    expect(useViewStore.getState().currentPage).toBe(1);
    const el = viewport();
    expect(el && isJumping(el)).toBe(true);

    // The next hit is asked for mid-flight, then the clock runs again.
    revealHit(selectHit(2));
    vi.restoreAllMocks();
    await waitFor(() => expect(el && isJumping(el)).toBe(false));
    await frame();
    await frame();
    expect(useViewStore.getState().currentPage).toBe(2);
  });
});
