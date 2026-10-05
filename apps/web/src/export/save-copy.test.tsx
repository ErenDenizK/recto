/**
 * Save a copy in the browser (components/07-sheets.md §4.4, §4.6, §4.9): the sheet keeps each
 * format's choices in its draft, the Text preview shows the conversion and its honesty notes
 * and saves what it previewed, the primary follows the platform, and the empty-file rule
 * removes a picked file whose copy could not be written.
 */
import '../styles/tokens.css';
import '../styles/reset.css';
import '../styles/global.css';

import { render, screen, waitFor, within } from '@testing-library/react';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';

import manifest from '../../../../test/fixtures/manifest.json';
import markdownUrl from '../../../../test/fixtures/markdown-source.pdf?url';
import { fixtureFile } from '../../test/store-harness';
import { getAnalysisWorkers } from '../engine/engine-service';
import { resetWorkspace, useWorkspaceStore } from '../state/workspace-store';
import { useSheetStore } from '../ui/sheet/sheet-store';
import { openSaveCopy } from './export-store';
import { SaveCopyHost } from './SaveCopyHost';
// The host loads the sheet lazily; loading its module graph up front keeps Vite from finding
// new dependencies mid-test, which reloads the test page.
import './SaveCopySheet';
import {
  type CopyHandle,
  type CopyOutput,
  pickTarget,
  removeEmptyFile,
  writeCopy,
} from './save-copy-run';

const golden = (
  manifest.fixtures.find((f) => f.file === 'markdown-source.pdf')?.expect as unknown as {
    markdown: { golden: string };
  }
).markdown.golden;

beforeEach(() => resetWorkspace());
afterEach(() => {
  useSheetStore.setState({ open: null, front: null, drafts: {} });
  resetWorkspace();
});
afterAll(() => getAnalysisWorkers().terminate());

async function open(): Promise<Parameters<typeof openSaveCopy>[0]> {
  const report = await useWorkspaceStore
    .getState()
    .openFiles([await fixtureFile(markdownUrl, 'markdown-source.pdf')]);
  const id = report.opened[0]?.documentId;
  if (!id) throw new Error('did not open');
  return id;
}

describe('the sheet', () => {
  it('keeps each format’s choices; the primary downloads without a save picker', async () => {
    const id = await open();
    render(<SaveCopyHost />);
    openSaveCopy(id);
    const sheet = await screen.findByTestId('save-copy-sheet', {}, { timeout: 15_000 });
    expect(within(sheet).getByRole('heading', { name: 'Save a copy' })).toBeVisible();
    expect(within(sheet).getByRole('radio', { name: 'PDF' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    // Vitest's Chromium has a save picker; the label follows it.
    const picker = typeof (window as { showSaveFilePicker?: unknown }).showSaveFilePicker;
    expect(within(sheet).getByRole('button', { name: /copy$/ })).toHaveTextContent(
      picker === 'function' ? 'Save copy' : 'Download copy',
    );

    await userEvent.click(within(sheet).getByRole('radio', { name: /^Smallest/ }));
    await userEvent.click(within(sheet).getByRole('radio', { name: 'Images' }));
    await userEvent.click(within(sheet).getByRole('radio', { name: 'JPEG' }));
    await userEvent.click(within(sheet).getByRole('radio', { name: 'PDF' }));
    expect(within(sheet).getByRole('radio', { name: /^Smallest/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(within(sheet).getByRole('textbox', { name: 'Name' })).toHaveValue(
      'markdown-source-small.pdf',
    );
    await userEvent.click(within(sheet).getByRole('radio', { name: 'Images' }));
    expect(within(sheet).getByRole('radio', { name: 'JPEG' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  }, 30_000);

  it('previews the Markdown and its honesty notes, and names the ZIP it will save', async () => {
    const id = await open();
    render(<SaveCopyHost />);
    openSaveCopy(id, 'text');
    const sheet = await screen.findByTestId('save-copy-sheet', {}, { timeout: 15_000 });
    const preview = within(sheet).getByTestId('convert-preview');
    await waitFor(() => expect(preview).toHaveAttribute('data-state', 'ready'), {
      timeout: 30_000,
    });
    expect(preview.textContent).toBe(golden.split('\n').slice(0, 40).join('\n'));
    expect(preview).toHaveAccessibleName('Preview, first 40 lines');
    const notes = within(sheet).getByTestId('convert-notes');
    expect(notes).toHaveTextContent('Reading order and headings are reconstructed');
    expect(notes).toHaveTextContent('Tables are not detected');
    expect(within(sheet).getByRole('textbox', { name: 'Name' })).toHaveValue('markdown-source.zip');
    // Plain text of page 1.
    await userEvent.click(within(sheet).getByRole('radio', { name: 'Plain text' }));
    await userEvent.click(within(sheet).getByRole('radio', { name: 'Page 1' }));
    await waitFor(
      () => {
        expect(preview).toHaveAttribute('data-state', 'ready');
        expect(within(sheet).getByRole('textbox', { name: 'Name' })).toHaveValue(
          'markdown-source.txt',
        );
      },
      { timeout: 30_000 },
    );
    expect(preview.textContent).toContain('Working with PDF Fixtures');
    expect(preview.textContent).not.toContain('Two columns');
  }, 60_000);
});

/** Runs `run` as a browser API would: later, its throw a rejection. */
const later = <T,>(run: () => T): Promise<T> => Promise.resolve().then(run);

/** A picked file whose writes can fail, recording what happened to it. */
function fakeHandle(options: { fail?: boolean; remove?: boolean } = {}) {
  const log: string[] = [];
  const handle: CopyHandle = {
    name: 'report.pdf',
    createWritable: () =>
      later(() => ({
        write: () =>
          later(() => {
            log.push('write');
            if (options.fail) throw new DOMException('Disk full', 'QuotaExceededError');
          }),
        close: () => later(() => void log.push('close')),
        abort: () => later(() => void log.push('abort')),
      })),
    ...(options.remove === false
      ? {}
      : {
          remove: () => later(() => void log.push('remove')),
        }),
  };
  return { handle, log };
}

const output: CopyOutput = {
  blob: new Blob(['%PDF-1.7']),
  name: 'report.pdf',
  type: 'application/pdf',
  summary: { name: 'report.pdf', size: 8, verified: true, seconds: 0.1, items: [] },
};

describe('where the copy goes', () => {
  it('opens the picker with the copy’s name and type, synchronously in the call', async () => {
    const asked: unknown[] = [];
    const { handle } = fakeHandle();
    const win = {
      showSaveFilePicker: (options: unknown) => {
        asked.push(options);
        return Promise.resolve(handle);
      },
    } as unknown as Window;
    const picking = pickTarget({ name: 'report-small.pdf', type: 'application/pdf' }, win);
    // Called before the first await: inside the press's activation.
    expect(asked).toHaveLength(1);
    expect(asked[0]).toMatchObject({
      suggestedName: 'report-small.pdf',
      types: [{ accept: { 'application/pdf': ['.pdf'] } }],
    });
    expect(await picking).toEqual({ kind: 'file', handle });
  });

  it('cancelled is cancelled; no picker, or a refused one, downloads', async () => {
    const reject = (name: string) =>
      ({
        showSaveFilePicker: () => Promise.reject(new DOMException('no', name)),
      }) as unknown as Window;
    expect(await pickTarget({ name: 'a.pdf', type: 'application/pdf' }, reject('AbortError'))).toBe(
      'cancelled',
    );
    expect(
      await pickTarget({ name: 'a.pdf', type: 'application/pdf' }, reject('SecurityError')),
    ).toEqual({ kind: 'download' });
    expect(await pickTarget({ name: 'a.pdf', type: 'application/pdf' }, {} as Window)).toEqual({
      kind: 'download',
    });
  });

  it('writes and closes; a failed write is aborted, and the empty file removed', async () => {
    const ok = fakeHandle();
    await writeCopy({ kind: 'file', handle: ok.handle }, output);
    expect(ok.log).toEqual(['write', 'close']);

    const failing = fakeHandle({ fail: true });
    await expect(writeCopy({ kind: 'file', handle: failing.handle }, output)).rejects.toThrow(
      'Disk full',
    );
    expect(await removeEmptyFile(failing.handle)).toBe(true);
    expect(failing.log).toEqual(['write', 'abort', 'remove']);

    const kept = fakeHandle({ fail: true, remove: false });
    expect(await removeEmptyFile(kept.handle)).toBe(false);
  });
});
