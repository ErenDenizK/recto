/**
 * The desk on real documents (Vitest browser mode, Chromium; DSN-87, `masa.md` §2.2, §2.4, §2.6,
 * §2.8): the first visit (sample hero, identity, one primary on Open files…), a returning desk
 * (Continue from a stored place and cover, the shelf of covers with badges and labels), nothing
 * to continue, the shelf's keys (one tab stop, 2D arrows, Delete) and the flag's default (off).
 */
import '../styles/tokens.css';
import '../styles/reset.css';
import '../styles/global.css';

import { act, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { App } from '../app';
import {
  loadRecents,
  memoryRecentsBackend,
  setRecentsBackend,
  storedHandlesReadable,
} from '../files/recents';
import { setLocale } from '../i18n';
import { useUiStore } from '../state/ui-store';
import { resetWorkspace } from '../state/workspace-store';
import { coverKey, memoryCoversBackend, setCoversBackend } from './covers';
import { resetLibraryStore } from './library-store';

const DAY = 86_400_000;

/** A small JPEG, as the cover store keeps them. */
async function jpeg(width: number, height: number): Promise<ArrayBuffer> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (context) {
    context.fillStyle = '#888888';
    context.fillRect(0, 0, width, height);
  }
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg'));
  return (await blob?.arrayBuffer()) ?? new ArrayBuffer(0);
}

interface Seed {
  readonly id: string;
  readonly name: string;
  readonly size: number;
  readonly pages?: number;
  readonly place?: { page: number; total: number; at: number };
  readonly kept?: { snapshotId: string; keptAt: number; bytes: number; changed: boolean };
  readonly handle?: object;
}

/** Recents (newest first) and the covers they own, then the app on the desk. */
async function seed(entries: readonly Seed[], withCovers: boolean): Promise<void> {
  const now = Date.now();
  setRecentsBackend(
    memoryRecentsBackend(entries.map((e, i) => ({ openedAt: now - i * DAY, ...e }))),
  );
  const covers = memoryCoversBackend();
  if (withCovers) {
    for (const e of entries) {
      for (const kind of ['first', 'left'] as const) {
        await covers.put({
          key: coverKey(kind, e),
          kind,
          page: kind === 'first' ? 0 : (e.place?.page ?? 0),
          width: 66,
          height: 88,
          type: 'image/jpeg',
          bytes: await jpeg(66, 88),
          at: now,
        });
      }
    }
  }
  setCoversBackend(covers);
}

const SHELF_NAME = { name: 'Recent files' };

describe('Desk', () => {
  beforeEach(async () => {
    await page.viewport(1440, 900);
    history.replaceState(null, '', '/?desk=1');
    resetWorkspace();
    resetLibraryStore();
    useUiStore.setState({
      destination: 'document',
      docUi: {},
      homeSelection: [],
      homeAnchor: null,
      paletteOpen: false,
    });
    setLocale('en');
  });
  afterEach(() => {
    setLocale('en');
    history.replaceState(null, '', '/');
    resetWorkspace();
    resetLibraryStore();
    setRecentsBackend(undefined);
    setCoversBackend(undefined);
  });

  it('is today’s Library with the flag off', async () => {
    history.replaceState(null, '', '/');
    setRecentsBackend(memoryRecentsBackend());
    render(<App />);
    const home = await screen.findByTestId('home');
    expect(home).not.toHaveAttribute('data-desk');
    expect(screen.queryByTestId('desk-sample')).toBeNull();
  });

  it('opens a first visit on the sample hero with Open files… as the one primary and first focus', async () => {
    setRecentsBackend(memoryRecentsBackend());
    setCoversBackend(memoryCoversBackend());
    render(<App />);
    // The desk is a lazy chunk: the first load in a cold run takes longer than the default wait.
    const home = await screen.findByTestId('home', undefined, { timeout: 8000 });
    expect(home).toHaveAttribute('data-desk');
    // The identity is the first visit's alone: the headline is the one h1.
    expect(
      await within(home).findByRole('heading', {
        level: 1,
        name: 'Read, mark up, sign and arrange PDFs.',
      }),
    ).toBeVisible();
    const sample = await within(home).findByTestId('desk-sample');
    expect(sample.querySelector('[data-library-sheet]')).not.toBeNull();
    expect(within(sample).getByRole('button', { name: 'Open the sample' })).toHaveAttribute(
      'class',
      expect.stringContaining('btn-standard'),
    );
    const group = within(home).getByRole('group', { name: 'Ways to start' });
    const names = within(group)
      .getAllByRole('button')
      .map((b) => b.querySelector('span')?.textContent);
    expect(names).toEqual(['Open files…', 'Sign a PDF…', 'Combine files…']);
    const open = within(group).getByRole('button', { name: /^Open files…/ });
    expect(open).toHaveAttribute('data-prominent');
    expect(home.querySelectorAll('[data-prominent]')).toHaveLength(1);
    await waitFor(() => expect(open).toHaveFocus());
    // No Recent section, no Scan without its flag.
    expect(within(home).queryByRole('heading', { name: 'Recent' })).toBeNull();
    expect(within(home).queryByTestId('library-scan')).toBeNull();
  });

  it('opens a returning desk on Continue, from the stored place and cover, with no engine', async () => {
    await seed(
      [
        {
          id: 'r1',
          name: 'report-v2.pdf',
          size: 1000,
          pages: 10,
          place: { page: 3, total: 10, at: Date.now() - DAY },
        },
        { id: 'r2', name: 'lease.pdf', size: 2000, pages: 4 },
      ],
      true,
    );
    render(<App />);
    const home = await screen.findByTestId('home');
    const card = await within(home).findByTestId('continue-card');
    expect(within(card).getByRole('heading', { name: 'Where you left off' })).toBeVisible();
    expect(within(card).getByTestId('continue-name')).toHaveTextContent('report-v2.pdf');
    expect(within(card).getByTestId('continue-page')).toHaveTextContent('Page 4 of 10 · yesterday');
    await waitFor(() => {
      const image = card.querySelector<HTMLImageElement>('[data-library-sheet] img[data-cover]');
      expect(image?.src.startsWith('blob:')).toBe(true);
    });
    // One primary: Continue; Open files… drops to the standard fill. Continue has first focus.
    expect(home.querySelectorAll('[data-prominent]')).toHaveLength(0);
    const resume = within(card).getByTestId('continue-resume');
    await waitFor(() => expect(resume).toHaveFocus());
    // A returning desk draws no identity: the heading is the hidden "Library".
    expect(within(home).getByRole('heading', { level: 1, name: 'Library' })).toBeInTheDocument();
    expect(within(home).queryByTestId('desk-sample')).toBeNull();
  });

  it('shows Recent as covers with one-sentence labels and the badge a press needs', async () => {
    await seed(
      [
        {
          id: 'r1',
          name: 'report-v2.pdf',
          size: 1000,
          pages: 10,
          place: { page: 3, total: 10, at: Date.now() - DAY },
          kept: { snapshotId: 's1', keptAt: Date.now(), bytes: 10, changed: true },
        },
        {
          id: 'r2',
          name: 'lease.pdf',
          size: 2000,
          pages: 4,
          handle: {
            kind: 'file',
            name: 'lease.pdf',
            getFile: () => Promise.reject(new Error('not read in this test')),
            queryPermission: () => Promise.resolve('prompt'),
          },
        },
        { id: 'r3', name: 'notes.pdf', size: 3000, pages: 8 },
        { id: 'r4', name: 'plan.pdf', size: 4000 },
      ],
      true,
    );
    render(<App />);
    const home = await screen.findByTestId('home');
    const shelf = await within(home).findByRole('list', SHELF_NAME);
    const tiles = await waitFor(() => {
      const found = Array.from(shelf.querySelectorAll<HTMLElement>('button[data-desk-tile]'));
      expect(found.length).toBeGreaterThanOrEqual(4);
      return found;
    });
    const labels = tiles.map((t) => t.getAttribute('aria-label'));
    expect(labels[0]).toBe(
      'report-v2.pdf, page 4 of 10, 40 percent read, yesterday, Edited, changes kept',
    );
    // A stored handle asks for permission on the press, except where the browser cannot read it.
    const handleHint = storedHandlesReadable() ? 'Needs permission' : 'Open again…';
    expect(labels[1]).toBe(`lease.pdf, 4 pages, yesterday, ${handleHint}`);
    expect(labels[2]).toMatch(/^notes\.pdf, 8 pages, 2 days ago, Open again…$/);
    expect(labels[3]).toMatch(/^plan\.pdf, /);
    // The tile contract: the cover is a sheet holding a blob image.
    for (const tile of tiles.slice(0, 4)) {
      expect(tile).toHaveAttribute('data-recent-id');
      expect(tile.querySelector('[data-library-sheet] img[data-cover]')).not.toBeNull();
    }
    // The sample is the shelf's last tile while it is off screen.
    expect(within(home).getByTestId('desk-sample-tile')).toBeVisible();
  });

  it('draws a paper sheet with the glyph where a cover is missing', async () => {
    await seed([{ id: 'r1', name: 'report-v2.pdf', size: 1000, pages: 10 }], false);
    render(<App />);
    const shelf = await screen.findByRole('list', SHELF_NAME);
    const sheet = await waitFor(() => {
      const found = shelf.querySelector<HTMLElement>('button[data-desk-tile] [data-library-sheet]');
      expect(found).not.toBeNull();
      return found as HTMLElement;
    });
    expect(sheet).toHaveAttribute('data-empty');
    expect(sheet.querySelector('img')).toBeNull();
    expect(sheet.querySelector('svg')).not.toBeNull();
  });

  it('holds the sample hero when nothing was read past page 1', async () => {
    await seed([{ id: 'r1', name: 'lease.pdf', size: 2000, pages: 4 }], true);
    render(<App />);
    const home = await screen.findByTestId('home');
    await within(home).findByRole('list', SHELF_NAME);
    expect(await within(home).findByTestId('desk-sample')).toBeVisible();
    expect(within(home).queryByTestId('continue-card')).toBeNull();
    // Returning: no identity, and the sample is the hero, not also a tile.
    expect(within(home).queryByRole('heading', { name: /Read, mark up/ })).toBeNull();
    expect(within(home).queryByTestId('desk-sample-tile')).toBeNull();
  });

  it('keeps the shelf one tab stop and moves in two dimensions, Delete removes', async () => {
    await seed(
      [
        { id: 'r1', name: 'a.pdf', size: 1, pages: 1 },
        { id: 'r2', name: 'b.pdf', size: 2, pages: 1 },
        { id: 'r3', name: 'c.pdf', size: 3, pages: 1 },
      ],
      true,
    );
    render(<App />);
    const shelf = await screen.findByRole('list', SHELF_NAME);
    const tiles = () => Array.from(shelf.querySelectorAll<HTMLElement>('button[data-desk-tile]'));
    await waitFor(() => expect(tiles().length).toBeGreaterThanOrEqual(3));
    expect(tiles().filter((t) => t.tabIndex === 0)).toHaveLength(1);
    // The ⋯ buttons are reached by pointer and touch; keys use Shift+F10.
    for (const more of shelf.querySelectorAll<HTMLElement>('[data-recent-more]')) {
      expect(more.tabIndex).toBe(-1);
    }
    tiles()[0]?.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(tiles()[1]).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(tiles().at(-1)).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(tiles()[0]).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    // One column or many, ArrowDown stays inside the list and never leaves it.
    expect(shelf.contains(document.activeElement)).toBe(true);
    tiles()[0]?.focus();
    await userEvent.keyboard('{Delete}');
    await waitFor(() => expect(shelf.querySelector('[data-recent-id="r1"]')).toBeNull());
    expect(shelf.contains(document.activeElement)).toBe(true);
  });

  it('moves inside the intents with the arrows and keeps them one tab stop', async () => {
    setRecentsBackend(memoryRecentsBackend());
    setCoversBackend(memoryCoversBackend());
    render(<App />);
    const group = await screen.findByRole('group', { name: 'Ways to start' });
    await act(async () => {
      await loadRecents();
    });
    const tiles = () => Array.from(group.querySelectorAll<HTMLElement>('[data-intent]'));
    expect(tiles().filter((t) => t.tabIndex === 0)).toHaveLength(1);
    tiles()[0]?.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(tiles()[1]).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(tiles()[0]).toHaveFocus();
  });

  it('lists the More ways… menu by the names ⌘K finds', async () => {
    setRecentsBackend(memoryRecentsBackend());
    setCoversBackend(memoryCoversBackend());
    render(<App />);
    const more = await screen.findByTestId('desk-more');
    await userEvent.click(more);
    const menu = await screen.findByTestId('desk-more-menu');
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((i) => i.querySelector('span')?.textContent),
    ).toEqual(['Batch…', 'Images to PDF…', 'PDF to images…', 'Text to PDF…', 'Markdown to PDF…']);
  });

  it('speaks Turkish, siz form', async () => {
    setLocale('tr');
    await seed(
      [
        {
          id: 'r1',
          name: 'rapor.pdf',
          size: 1000,
          pages: 10,
          place: { page: 3, total: 10, at: Date.now() - DAY },
        },
      ],
      false,
    );
    render(<App />);
    const card = await screen.findByTestId('continue-card');
    expect(within(card).getByRole('heading', { name: 'Kaldığınız yer' })).toBeVisible();
    expect(screen.getByRole('group', { name: 'Başlama yolları' })).toBeVisible();
  });
});
