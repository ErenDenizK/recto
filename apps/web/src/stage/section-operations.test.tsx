/**
 * The page-structure sheets on real PDFs (Vitest browser mode, Chromium; 07-sheets S13–S18):
 * split every N pages and by ranges in the Split sheet, Combine with open documents in a chosen
 * order (one outcome: a new document, the sources kept, INV-12), Interleave in duplex order
 * keeping its sources (07.13), rename in place in a grid section, and images as pages followed
 * by an export whose page count includes the image pages.
 */
import '../styles/tokens.css';
import '../styles/reset.css';
import '../styles/global.css';

import { PDFDocument } from '@cantoo/pdf-lib';
import type { DocumentId, Workspace } from '@pdf-editor/document-model';
import { render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { EXIT_TIMEOUT } from '../../test/settled';
import outlineUrl from '../../../../test/fixtures/outline-named-dests.pdf?url';
import rotatedUrl from '../../../../test/fixtures/rotated-pages.pdf?url';
import simpleUrl from '../../../../test/fixtures/simple-text.pdf?url';
import { App } from '../app';
import { openDocuments } from '../commands/app-commands';
import { commandRegistry } from '../commands/registry';
import { prepareExport } from '../export/export-service';
import { useSelectionStore } from '../state/selection-store';
import { useUiStore } from '../state/ui-store';
import { resetWorkspace, useWorkspaceStore } from '../state/workspace-store';
import { closeOperationDialog } from './operation-dialogs-store';
import { runSectionCommand } from './section-menu';
import { insertImagesInto } from './section-operations';

async function fixture(url: string, name: string): Promise<File> {
  const bytes = await (await fetch(url)).arrayBuffer();
  return new File([bytes], name, { type: 'application/pdf' });
}

async function generatedImage(type: string, width: number, height: number, name: string) {
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('no 2d context');
  context.fillStyle = '#2a6';
  context.fillRect(0, 0, width, height);
  context.fillStyle = '#fff';
  context.fillRect(width / 4, height / 4, width / 2, height / 2);
  return new File([await canvas.convertToBlob({ type })], name, { type });
}

const model = () => useWorkspaceStore.getState();
const ws = (): Workspace => model().workspace;
const titles = () => ws().documentOrder.map((id) => ws().documents[id]?.title);
const lastLabel = () => model().history.present.label;

/** Source page (file stem + 1-based index) of every page of a document. */
function pageNames(id: DocumentId | undefined): string[] {
  const doc = id === undefined ? undefined : ws().documents[id];
  return (doc?.pages ?? []).map((p) => {
    if (p.ref.kind !== 'source') return p.ref.kind;
    const name = ws().sources[p.ref.source]?.name.replace(/\.pdf$/, '') ?? '?';
    return `${name[0] ?? '?'}${p.ref.index + 1}`;
  });
}

async function open(...files: [string, string][]) {
  render(<App />);
  await openDocuments(await Promise.all(files.map(([url, name]) => fixture(url, name))));
  const order = ws().documentOrder;
  useUiStore.getState().setGridScope('all');
  useUiStore.getState().showSurface('grid');
  expect(await screen.findAllByRole('grid')).toHaveLength(order.length);
  return order;
}

describe('section operations', () => {
  beforeEach(async () => {
    await page.viewport(1440, 900);
    resetWorkspace();
    closeOperationDialog();
    useSelectionStore.getState().apply({ selected: new Set(), anchor: null, focused: null });
    useUiStore.setState({
      docUi: {},
      gridScope: 'all',
      arrangeCollapsed: [],
      paletteOpen: false,
      arrangeSize: 1,
      renaming: null,
    });
  });
  afterEach(() => {
    closeOperationDialog();
    resetWorkspace();
  });

  it('splits every N pages from the section menu, with a live preview', async () => {
    const [outline] = await open([outlineUrl, 'outline-named-dests.pdf']);
    if (outline === undefined) throw new Error('not opened');
    await runSectionCommand('section.split', outline);
    const dialog = await screen.findByTestId('split-dialog');
    await waitFor(() => {
      expect(
        within(dialog).getByRole('heading', { name: 'Split outline-named-dests' }),
      ).toBeVisible();
    });
    // Default: two parts. The outline option is available (the file has bookmarks); the
    // selection option is not (nothing selected).
    expect(within(dialog).getByTestId('split-preview')).toHaveTextContent(
      'Creates 2 documents: 3, 3 pages',
    );
    expect(within(dialog).getByRole('radio', { name: /At top-level bookmarks/ })).toBeEnabled();
    expect(
      within(dialog).getByRole('radio', { name: /Before each selected page/ }),
    ).toHaveAttribute('aria-disabled', 'true');

    // Ranges: inline errors, then a valid list with pages left behind.
    await userEvent.click(within(dialog).getByRole('radio', { name: /Page ranges/ }));
    const ranges = within(dialog).getByTestId('split-ranges');
    await userEvent.type(ranges, '1-3, 9, 4-2');
    expect(dialog).toHaveTextContent('“9”: the document has 6 pages.');
    expect(within(dialog).getByTestId('split-range-errors')).toHaveTextContent(
      '“4-2”: the range runs backwards.',
    );
    expect(within(dialog).getByRole('button', { name: 'Split' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await userEvent.clear(ranges);
    await userEvent.type(ranges, '1-3, 5');
    expect(within(dialog).getByTestId('split-preview')).toHaveTextContent(
      'Creates 2 documents: 3, 1 pages 2 pages stay in outline-named-dests.',
    );

    // Every 4 pages.
    await userEvent.click(within(dialog).getByRole('radio', { name: /Every n pages/ }));
    const every = within(dialog).getByRole('spinbutton', { name: 'Pages per document' });
    await userEvent.clear(every);
    await userEvent.type(every, '4');
    expect(within(dialog).getByTestId('split-preview')).toHaveTextContent(
      'Creates 2 documents: 4, 2 pages',
    );
    // The grid draws where the parts start while the sheet is open (S13).
    await waitFor(() => {
      expect(screen.getByText('2 of 2')).toBeInTheDocument();
    });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Split into 2' }));

    await waitFor(() => {
      expect(titles()).toEqual(['outline-named-dests (1 of 2)', 'outline-named-dests (2 of 2)']);
    });
    expect(ws().documentOrder.map((id) => ws().documents[id]?.pages.length)).toEqual([4, 2]);
    expect(lastLabel()).toBe('Split outline-named-dests into 2');
    await waitFor(() => expect(screen.queryByTestId('split-dialog')).toBeNull(), {
      timeout: EXIT_TIMEOUT,
    });
    // Both parts show in the grid's All open.
    expect(await screen.findAllByRole('grid')).toHaveLength(2);

    await userEvent.keyboard('{Control>}z{/Control}');
    await waitFor(() => {
      expect(titles()).toEqual(['outline-named-dests']);
    });
  }, 40_000);

  it('combines open documents into a new one in the order chosen, keeping them (S15)', async () => {
    const [simple, rotated] = await open(
      [simpleUrl, 'simple-text.pdf'],
      [rotatedUrl, 'rotated-pages.pdf'],
    );
    await commandRegistry.execute('documents.mergeAll');
    const sheet = await screen.findByTestId('combine-sheet');
    const rows = () =>
      within(sheet)
        .getAllByTestId('combine-row')
        .map((r) => r.textContent);
    expect(rows()).toHaveLength(2);
    await userEvent.click(within(sheet).getByRole('button', { name: 'Move rotated-pages up' }));
    expect(rows()[0]).toContain('rotated-pages');
    expect(within(sheet).getByRole('status')).toHaveTextContent('Creates 1 document with 7 pages');
    const name = within(sheet).getByRole('textbox', { name: 'Name' });
    await userEvent.clear(name);
    expect(within(sheet).getAllByText('The title cannot be empty.')[0]).toBeInTheDocument();
    await userEvent.type(name, 'Combined');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Combine' }));

    // One outcome (INV-12): a new document after the sources, which stay open and untouched.
    await waitFor(() => {
      expect(titles()).toEqual(['simple-text', 'rotated-pages', 'Combined']);
    });
    const combined = ws().documentOrder[2];
    expect(pageNames(combined)).toEqual(['r1', 'r2', 'r3', 'r4', 's1', 's2', 's3']);
    expect(pageNames(simple)).toEqual(['s1', 's2', 's3']);
    expect(pageNames(rotated)).toEqual(['r1', 'r2', 'r3', 'r4']);
    expect(lastLabel()).toBe('Combine 2 files');
    // It opens straight in its Pages grid, This document, with its sources named (PG6).
    expect(ws().activeDocument).toBe(combined);
    await waitFor(() => {
      expect(screen.getByTestId('grid-sources')).toHaveTextContent(
        'Sources: rotated-pages, simple-text',
      );
    });
    expect(screen.getAllByRole('grid')).toHaveLength(1);
    if (combined === undefined) throw new Error('no combined document');
    const result = await prepareExport(combined);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.verification.ok).toBe(true);
    expect(result.value.pageCount).toBe(7);
  }, 40_000);

  it('interleaves two documents in duplex order (second document reversed)', async () => {
    const [simple] = await open([simpleUrl, 'simple-text.pdf'], [rotatedUrl, 'rotated-pages.pdf']);
    if (simple === undefined) throw new Error('not opened');
    await runSectionCommand('section.interleave', simple);
    const dialog = await screen.findByTestId('interleave-dialog');
    expect(within(dialog).getByRole('radio', { name: /rotated-pages/ })).toBeChecked();
    await userEvent.click(within(dialog).getByRole('radio', { name: /Duplex scan/ }));
    const preview = within(dialog).getByTestId('interleave-preview');
    expect(
      within(preview)
        .getAllByRole('listitem')
        .map((item) => item.getAttribute('aria-label') ?? item.textContent),
    ).toEqual([
      'simple-text, page 1',
      'rotated-pages, page 4',
      'simple-text, page 2',
      'rotated-pages, page 3',
      'simple-text, page 3',
      'rotated-pages, page 2',
      'rotated-pages, page 1',
    ]);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Interleave' }));

    // Interleave keeps its sources (07.13): the result follows them.
    await waitFor(() => {
      expect(titles()).toEqual(['simple-text', 'rotated-pages', 'simple-text + rotated-pages']);
    });
    expect(pageNames(ws().documentOrder[2])).toEqual(['s1', 'r4', 's2', 'r3', 's3', 'r2', 'r1']);
    expect(pageNames(simple)).toEqual(['s1', 's2', 's3']);
    expect(lastLabel()).toBe('Interleave simple-text with rotated-pages');
  }, 40_000);

  it('renames in place from a section header in All open, validating the title', async () => {
    await open([simpleUrl, 'simple-text.pdf'], [rotatedUrl, 'rotated-pages.pdf']);
    await userEvent.dblClick(screen.getByRole('heading', { name: 'simple-text' }));
    const input = await screen.findByRole('textbox', { name: 'Document title' });
    expect(input).toHaveFocus();
    await userEvent.clear(input);
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('The title cannot be empty.');
    await userEvent.type(input, 'Contract');
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByRole('tab', { name: 'Contract' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Contract' })).toBeVisible();
    expect(lastLabel()).toBe('Rename to Contract');
  }, 40_000);

  it('copies selected pages to a new document, leaving the originals in place', async () => {
    const [simple] = await open([simpleUrl, 'simple-text.pdf']);
    if (simple === undefined) throw new Error('not opened');
    const cells = within(screen.getByRole('grid', { name: 'simple-text' })).getAllByRole(
      'gridcell',
    );
    await userEvent.click(cells[0]!, { modifiers: ['ControlOrMeta'] });
    await userEvent.click(cells[2]!, { modifiers: ['Shift'] });
    const past = model().history.past.length;
    await commandRegistry.execute('pages.copyToNew');
    await waitFor(() => {
      expect(titles()).toEqual(['simple-text', 'simple-text (copy)']);
    });
    expect(pageNames(simple)).toEqual(['s1', 's2', 's3']);
    expect(pageNames(ws().documentOrder[1])).toEqual(['s1', 's2', 's3']);
    expect(model().history.past.length).toBe(past + 1);
    expect(lastLabel()).toBe('Copy 3 pages to new document');
    expect(commandRegistry.get('pages.extract')?.title).toBe('Extract pages…');
  }, 40_000);

  it('inserts images as pages (WebP re-encoded) and exports them', async () => {
    const [simple] = await open([simpleUrl, 'simple-text.pdf']);
    if (simple === undefined) throw new Error('not opened');
    const past = model().history.past.length;

    // One image within A4: no question, page size = pixels at 72 dpi.
    const png = await generatedImage('image/png', 200, 100, 'generated.png');
    const placed = await insertImagesInto(simple, [png], 1);
    expect(placed).toHaveLength(1);
    expect(model().history.past.length).toBe(past + 1);
    expect(lastLabel()).toBe('Insert 1 page from generated.png');
    const imagePage = ws().documents[simple]?.pages[1];
    expect(imagePage?.ref).toMatchObject({ kind: 'image', size: { width: 200, height: 100 } });
    expect(
      within(screen.getByRole('grid', { name: 'simple-text' })).getAllByRole('gridcell')[1],
    ).toHaveAccessibleName('Page 2 of 4, from generated.png');

    // Two images: the size question; a wide WebP is stored as PNG.
    const pending = insertImagesInto(simple, [
      await generatedImage('image/webp', 1200, 600, 'wide.webp'),
      await generatedImage('image/jpeg', 300, 400, 'photo.jpg'),
    ]);
    // The question (S18's InsertImagesSheet) comes after both images are decoded and the WebP
    // re-encoded as PNG: about 150 ms here, past findBy's 1 s default on a loaded CI runner.
    const question = await screen.findByTestId('image-size-dialog', {}, { timeout: 10_000 });
    await waitFor(() => {
      expect(within(question).getByRole('heading', { name: 'Insert 2 images' })).toBeVisible();
    });
    expect(within(question).getByRole('radio', { name: /Fit to A4 width/ })).toBeChecked();
    await userEvent.click(within(question).getByRole('button', { name: 'Insert 2 pages' }));
    expect(await pending).toHaveLength(2);
    const doc = ws().documents[simple];
    expect(doc?.pages).toHaveLength(6);
    const wide = doc?.pages[4]?.ref;
    if (wide?.kind !== 'image') throw new Error('expected an image page');
    expect(wide.size.width).toBeCloseTo(595.28, 1);
    expect(model().blobs[wide.blob]?.type).toBe('image/png');
    expect(lastLabel()).toBe('Insert 2 pages from 2 files');

    // The export path gets the blobs; the verified output has every page.
    const result = await prepareExport(simple);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.verification.ok).toBe(true);
    expect(result.value.pageCount).toBe(6);
    const pdf = await PDFDocument.load(result.value.bytes, { updateMetadata: false });
    expect(pdf.getPageCount()).toBe(6);
    const size = pdf.getPage(1).getSize();
    expect([Math.round(size.width), Math.round(size.height)]).toEqual([200, 100]);
  }, 60_000);
});
