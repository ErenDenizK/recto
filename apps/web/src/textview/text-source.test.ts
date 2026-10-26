/**
 * The Text view's reader through the real PDFium and analysis workers (PRD-35, PRD-36):
 * markdown-source.pdf (headings, a list, an image, a two-column page) and the image-only scans,
 * which have no text layer and so come back with `needsOcr`. The style read is timed and logged
 * (the cost of the first text on this machine).
 */
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import demoScanUrl from '../../../../test/fixtures/demo/demo-letter-scan.pdf?url';
import markdownUrl from '../../../../test/fixtures/markdown-source.pdf?url';
import scanUrl from '../../../../test/fixtures/scan-text.pdf?url';
import { fixtureFile } from '../../test/store-harness';
import { getAnalysisWorkers } from '../engine/engine-service';
import { resetWorkspace, useWorkspaceStore } from '../state/workspace-store';
import { createTextViewLoader } from './loader';
import { openTextSource } from './text-source';

beforeEach(() => resetWorkspace());
afterEach(() => resetWorkspace());
afterAll(() => getAnalysisWorkers().terminate());

async function open(url: string, name: string) {
  const report = await useWorkspaceStore.getState().openFiles([await fixtureFile(url, name)]);
  const id = report.opened[0]?.documentId;
  if (!id) throw new Error(`${name} did not open`);
  return id;
}

describe('markdown-source.pdf', () => {
  it('reads headings, a list and an image, then the two columns in order', async () => {
    const source = await openTextSource(await open(markdownUrl, 'markdown-source.pdf'));
    const { signal } = new AbortController();
    try {
      expect(source.pageCount).toBe(2);
      const started = performance.now();
      const style = await source.style(signal);
      console.warn(
        `textStyle on markdown-source.pdf: ${(performance.now() - started).toFixed(0)} ms`,
      );
      expect(style.headingSizes.length).toBeGreaterThanOrEqual(3);

      const [first, second] = await source.blocks([0, 1], style, signal);
      expect(first?.pageAnchor).toBe('page-1');
      expect(first?.needsOcr).toBe(false);
      const headings = first?.blocks.flatMap((b) =>
        b.kind === 'heading' ? [[b.level, b.text] as const] : [],
      );
      expect(headings).toEqual([
        [1, 'Working with PDF Fixtures'],
        [2, 'Why fixtures matter'],
        [3, 'What a good fixture has'],
      ]);
      const list = first?.blocks.find((b) => b.kind === 'list');
      expect(list).toMatchObject({ ordered: false });
      expect(list?.kind === 'list' ? list.items.map((i) => i.text) : []).toEqual([
        'Known text in a known place',
        'A documented reason to exist',
        'A size of a few kilobytes',
      ]);
      expect(first?.blocks.filter((b) => b.kind === 'image')).toHaveLength(1);

      const texts = (second?.blocks ?? []).flatMap((b) => (b.kind === 'paragraph' ? [b.text] : []));
      const left = texts.findIndex((t) => t.startsWith('The left column'));
      const right = texts.findIndex((t) => t.startsWith('The right column'));
      expect(left).toBeGreaterThanOrEqual(0);
      expect(right).toBeGreaterThan(left);

      // A one-page chunk with the document's style keeps the heading level the whole book has.
      const [alone] = await source.blocks([1], style, signal);
      const h2 = alone?.blocks.find((b) => b.kind === 'heading');
      expect(h2).toMatchObject({ level: 2, text: 'Two columns' });

      expect(source.pageRef(0).frame).toMatchObject({
        size: { width: 612, height: 792 },
        rotation: 0,
        scale: 1,
      });
    } finally {
      source.dispose();
    }
  }, 60_000);

  it('feeds the loader: both pages of a 2-page document arrive in one chunk', async () => {
    const loader = createTextViewLoader(
      await openTextSource(await open(markdownUrl, 'markdown-source.pdf')),
    );
    try {
      await loader.ensure(1);
      expect(loader.peek(0)).toMatchObject({ page: 0, pageAnchor: 'page-1' });
      expect(loader.peek(1)).toMatchObject({ page: 1, pageAnchor: 'page-2' });
    } finally {
      loader.dispose();
    }
  }, 60_000);
});

describe('image-only scans', () => {
  it.each([
    ['scan-text.pdf', scanUrl, 2],
    ['demo-letter-scan.pdf (no text layer)', demoScanUrl, 2],
  ])(
    '%s: every page needs OCR and has only image blocks',
    async (name, url, pages) => {
      const source = await openTextSource(await open(url, name));
      const { signal } = new AbortController();
      try {
        expect(source.pageCount).toBe(pages);
        const style = await source.style(signal);
        const result = await source.blocks(
          Array.from({ length: pages }, (_, i) => i),
          style,
          signal,
        );
        expect(result.map((p) => p.needsOcr)).toEqual(Array.from({ length: pages }, () => true));
        expect(result.every((p) => p.blocks.every((b) => b.kind === 'image'))).toBe(true);
      } finally {
        source.dispose();
      }
    },
    60_000,
  );
});
