/**
 * PDF → Markdown / text in the app (spec recognize-and-compare §4): the choices, the output
 * file, and markdown-source.pdf converted through the real PDFium and analysis workers to the
 * manifest's golden. Save a copy's Text preview is `export/save-copy.test.tsx`'s.
 */
import { parsePageRange } from '@pdf-editor/engine';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import manifest from '../../../../test/fixtures/manifest.json';
import markdownUrl from '../../../../test/fixtures/markdown-source.pdf?url';
import { fixtureFile } from '../../test/store-harness';
import { getAnalysisWorkers } from '../engine/engine-service';
import { resetWorkspace, useWorkspaceStore } from '../state/workspace-store';
import {
  choicePages,
  convertDocumentPages,
  convertOptions,
  DEFAULT_CHOICE,
  outputFile,
  previewLines,
} from './convert-run';

const golden = (
  manifest.fixtures.find((f) => f.file === 'markdown-source.pdf')?.expect as unknown as {
    markdown: { golden: string };
  }
).markdown.golden;

beforeEach(() => resetWorkspace());
afterEach(() => {
  resetWorkspace();
});
afterAll(() => getAnalysisWorkers().terminate());

describe('choices', () => {
  it('maps the scope to pages', () => {
    const pages = (scope: 'document' | 'page' | 'range', range = '') =>
      choicePages({ scope, range }, 5, 2, parsePageRange);
    expect(pages('document')).toEqual([0, 1, 2, 3, 4]);
    expect(pages('page')).toEqual([2]);
    expect(pages('range', '2-3, 5')).toEqual([1, 2, 4]);
    expect(pages('range', '9')).toBeNull();
    expect(choicePages({ scope: 'page', range: '' }, 3, 7, parsePageRange)).toEqual([2]);
    expect(choicePages({ scope: 'document', range: '' }, 0, 0, parsePageRange)).toBeNull();
  });

  it('maps the choices to engine options; text never carries images', () => {
    expect(convertOptions(DEFAULT_CHOICE)).toEqual({
      format: 'markdown',
      scope: 'document',
      pageBreak: 'none',
      keepHeadersFooters: false,
      joinHyphens: true,
      images: true,
    });
    expect(convertOptions({ ...DEFAULT_CHOICE, format: 'text', pageBreak: 'rule' })).toMatchObject({
      format: 'text',
      pageBreak: 'rule',
      images: false,
    });
  });

  it('names the download and cuts the preview', () => {
    const report = {
      pages: 1,
      pagesWithoutText: [],
      headings: 0,
      paragraphs: 1,
      listItems: 0,
      images: 0,
      links: 0,
      suspectedTables: 0,
      dropped: [],
      notes: [],
    };
    const md = new TextEncoder().encode('# A\n');
    expect(
      outputFile(
        {
          format: 'markdown',
          text: '# A\n',
          pageTexts: [],
          files: [{ path: 'document.md', mime: 'text/markdown', bytes: md }],
          report,
        },
        'Report: Q3.pdf',
      ),
    ).toMatchObject({ name: 'Report- Q3.md', type: 'text/markdown' });
    expect(
      outputFile({ format: 'text', text: 'a', pageTexts: [], files: [], report }, 'notes'),
    ).toMatchObject({ name: 'notes.txt', type: 'text/plain' });
    expect(
      outputFile(
        {
          format: 'markdown',
          text: '',
          pageTexts: [],
          files: [],
          zip: new Uint8Array([1]),
          report,
        },
        'x',
      ),
    ).toMatchObject({ name: 'x.zip', type: 'application/zip' });
    const lines = Array.from({ length: 50 }, (_, i) => `line ${i}`).join('\n');
    expect(previewLines(lines).text.split('\n')).toHaveLength(40);
    expect(previewLines(lines).more).toBe(true);
    expect(previewLines('a\nb').more).toBe(false);
  });
});

describe('markdown-source.pdf through the workers', () => {
  async function open() {
    const report = await useWorkspaceStore
      .getState()
      .openFiles([await fixtureFile(markdownUrl, 'markdown-source.pdf')]);
    const id = report.opened[0]?.documentId;
    if (!id) throw new Error('did not open');
    return id;
  }

  it('converts to the golden Markdown, images in a ZIP', async () => {
    const id = await open();
    const result = await convertDocumentPages(id, [0, 1], DEFAULT_CHOICE);
    expect(result.text).toBe(golden);
    const file = outputFile(result, 'markdown-source');
    expect(file.name).toBe('markdown-source.zip');
    // The ZIP holds these files (engine tests unzip it).
    expect(result.files.map((f) => f.path)).toEqual(['document.md', 'images/p1-1.png']);
    expect(new TextDecoder().decode(result.files[0]?.bytes)).toBe(golden);
    expect(String.fromCharCode(file.bytes[0] ?? 0, file.bytes[1] ?? 0)).toBe('PK');
    // Without images: one .md file, the image line left out.
    const plain = await convertDocumentPages(id, [0, 1], { ...DEFAULT_CHOICE, images: false });
    expect(outputFile(plain, 'markdown-source').name).toBe('markdown-source.md');
    expect(plain.text).not.toContain('![');
  }, 60_000);
});
