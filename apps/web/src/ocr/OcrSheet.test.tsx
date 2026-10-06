/**
 * The OCR dialog (spec recognize-and-compare §1.5) on scan-text.pdf with the real PDFium
 * worker for the page facts: pages without text by default, languages with size and state,
 * quality, the replace option and the signed-source warning, the honesty text; a run's
 * progress, hiding the dialog while it continues, and cancelling it; a finished run shown on
 * its own document only; the recheck progress in the dialog and the status bar. The recognizer itself
 * (tesseract.js) is replaced here; the e2e test runs it (e2e/ocr.spec.ts).
 */
import type { SourceId } from '@pdf-editor/document-model';
import type { OcrLanguagePack, OcrPageFacts } from '@pdf-editor/engine';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import scanUrl from '../../../../test/fixtures/scan-text.pdf?url';
import simpleUrl from '../../../../test/fixtures/simple-text.pdf?url';
import { fixtureFile } from '../../test/store-harness';
import { resetJobs } from '../jobs/job-store';
import { resetWorkspace, useWorkspaceStore } from '../state/workspace-store';
import { resetToasts } from '../ui/Toast/toast-store';
import { ToastRegion } from '../ui/Toast/ToastRegion';
import OcrSheet from './OcrSheet';
import { watchOcrJob } from './ocr-job';
import { type OcrDependencies, ocrDependencies, setOcrDependencies } from './ocr-deps';
import type { OcrRunCallbacks } from './ocr-run';
import { openOcrDialog, type OcrRunRequest, resetOcrStore, useOcrStore } from './ocr-store';

/** The run, replaced: it reports progress and waits for the test (or the cancel). */
const runs: { request: OcrRunRequest; callbacks: OcrRunCallbacks; finish: () => void }[] = [];
vi.mock('./ocr-run', () => ({
  recognizeAndApply: (request: OcrRunRequest, callbacks: OcrRunCallbacks) =>
    new Promise((resolve) => {
      callbacks.onProgress({ phase: 'recognize', done: 1, total: request.targets.length });
      callbacks.signal.addEventListener('abort', () => {
        resolve(undefined);
      });
      runs.push({
        request,
        callbacks,
        finish: () => {
          resolve({
            label: 'Recognize text: 2 pages, eng',
            pages: 2,
            languages: ['eng'],
            byQuality: { good: 1, review: 1, poor: 0, 'no-text': 0 },
            words: 90,
            lowConfidence: 4,
            timedOut: 0,
            reducedDpi: 0,
          });
        },
      });
    }),
}));

const PACKS: OcrLanguagePack[] = [
  { code: 'eng', source: 'origin', bytes: 4_110_000, downloadBytes: 1_980_000, onDevice: false },
  { code: 'tur', source: 'origin', bytes: 4_550_000, downloadBytes: 0, onDevice: true },
  { code: 'deu', source: 'origin', bytes: 1_530_000, downloadBytes: 850_000, onDevice: false },
];

function packs(): OcrDependencies['packs'] {
  return () =>
    Promise.resolve({
      list: () => Promise.resolve(PACKS),
      keepOffline: () => Promise.resolve(),
      remove: () => Promise.resolve(),
      importFile: () => Promise.reject(new Error('not here')),
    });
}

let realFacts: OcrDependencies['facts'] | undefined;

/**
 * S10's primary once the pages and packs have loaded. Queried afresh: while dimmed it carries
 * its reason (and a tooltip around it), so the enabled one may be a new element.
 */
async function enabledRun(name = 'Recognize 2 pages'): Promise<HTMLElement> {
  await waitFor(() =>
    expect(screen.getByRole('button', { name })).not.toHaveAttribute('aria-disabled', 'true'),
  );
  return screen.getByRole('button', { name });
}

async function openScan(): Promise<{ documentId: string; source: SourceId }> {
  const report = await useWorkspaceStore
    .getState()
    .openFiles([await fixtureFile(scanUrl, 'scan-text.pdf')]);
  const opened = report.opened[0];
  if (!opened) throw new Error('scan-text.pdf did not open');
  const ws = useWorkspaceStore.getState().workspace;
  const page = ws.documents[opened.documentId]?.pages[0];
  if (page?.ref.kind !== 'source') throw new Error('no source page');
  return { documentId: opened.documentId, source: page.ref.source };
}

function useDeps(facts?: OcrDependencies['facts']) {
  setOcrDependencies({
    facts: facts ?? ((source) => (realFacts as OcrDependencies['facts'])(source)),
    packs: packs(),
    engineFiles: () => Promise.resolve([]),
  });
}

beforeEach(() => {
  resetWorkspace();
  resetOcrStore();
  runs.length = 0;
  setOcrDependencies(undefined);
  realFacts = ocrDependencies().facts;
});

afterEach(() => {
  resetOcrStore();
  setOcrDependencies(undefined);
  resetWorkspace();
});

describe('the OCR dialog', () => {
  it('proposes the pages without text, English and Standard quality', async () => {
    useDeps();
    const { documentId } = await openScan();
    openOcrDialog(documentId as never);
    render(<OcrSheet />);
    const dialog = await screen.findByTestId('ocr-dialog');
    // Facts from the PDFium worker: both scanned pages lack text.
    const withoutText = await within(dialog).findByRole('radio', {
      name: 'Pages without text (2 pages)',
    });
    await waitFor(() => expect(withoutText).toBeChecked());
    expect(within(dialog).getByRole('radio', { name: 'All pages (2 pages)' })).not.toBeChecked();
    expect(within(dialog).getByRole('radio', { name: 'Current page (1)' })).toBeInTheDocument();

    // Languages with size and state; the UI language (English) is chosen.
    const english = await within(dialog).findByRole('checkbox', { name: /English/ });
    expect(english).toBeChecked();
    expect(within(dialog).getByRole('checkbox', { name: /Turkish/ })).not.toBeChecked();
    expect(english.closest('label')).toHaveTextContent('Downloads 2.0 MB');
    expect(
      within(dialog)
        .getByRole('checkbox', { name: /Turkish/ })
        .closest('label'),
    ).toHaveTextContent('On this device · 4.6 MB');
    expect(within(dialog).getByTestId('ocr-languages-key')).toHaveTextContent('eng');
    expect(dialog).toHaveTextContent('The first run downloads 2.0 MB from this site.');

    expect(within(dialog).getByRole('radio', { name: /Standard/ })).toBeChecked();
    expect(within(dialog).getByTestId('ocr-honesty')).toHaveTextContent(
      'Recognized text may contain errors. The page image is unchanged',
    );
    // No invisible text and no signature on this file.
    expect(within(dialog).queryByTestId('ocr-replace-hint')).toBeNull();
    expect(within(dialog).queryByTestId('ocr-signed-warning')).toBeNull();

    const run = within(dialog).getByRole('button', { name: 'Recognize 2 pages' });
    expect(run).not.toHaveAttribute('aria-disabled', 'true');
    act(() => {
      within(dialog).getByRole('radio', { name: 'Current page (1)' }).click();
    });
    expect(within(dialog).getByRole('button', { name: 'Recognize 1 page' })).not.toHaveAttribute(
      'aria-disabled',
      'true',
    );
    // Adding Turkish puts it after English (the first language leads).
    act(() => {
      within(dialog)
        .getByRole('checkbox', { name: /Turkish/ })
        .click();
    });
    expect(within(dialog).getByTestId('ocr-languages-key')).toHaveTextContent('eng+tur');
    act(() => {
      english.click();
      within(dialog)
        .getByRole('checkbox', { name: /Turkish/ })
        .click();
    });
    expect(within(dialog).getByTestId('ocr-languages-key')).toHaveTextContent(
      'Choose at least one language.',
    );
    expect(within(dialog).getByRole('button', { name: 'Recognize 1 page' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('offers to replace earlier text and warns about signatures', async () => {
    const facts = (pageIndex: number, invisibleText: OcrPageFacts['invisibleText']) => ({
      pageIndex,
      visibleText: false,
      invisibleText,
      ourLayer: invisibleText === 'ours',
      images: 1,
      imageOnly: true,
    });
    let foreign = false;
    useDeps(() => Promise.resolve([facts(0, 'ours'), facts(1, foreign ? 'foreign' : 'none')]));
    const { documentId, source } = await openScan();
    useWorkspaceStore.setState((s) => {
      const info = s.workspace.sources[source];
      if (!info) return s;
      return {
        workspace: {
          ...s.workspace,
          sources: {
            ...s.workspace.sources,
            [source]: { ...info, flags: { ...info.flags, hasSignatures: true } },
          },
        },
      };
    });
    openOcrDialog(documentId as never);
    const { unmount } = render(<OcrSheet />);
    const dialog = await screen.findByTestId('ocr-dialog');
    // Our own earlier layer: replacing is proposed (a re-run).
    const replace = await within(dialog).findByRole('checkbox', {
      name: 'Replace existing invisible text',
    });
    expect(replace).toBeChecked();
    expect(within(dialog).getByTestId('ocr-replace-hint')).toHaveTextContent(
      '1 page already has text this app recognized earlier',
    );
    expect(within(dialog).getByTestId('ocr-signed-warning')).toHaveTextContent(
      'the export will remove its signatures',
    );
    unmount();

    // Another tool's text is kept unless the user chooses to replace it.
    foreign = true;
    render(<OcrSheet />);
    const again = await screen.findByTestId('ocr-dialog');
    await waitFor(() =>
      expect(within(again).getByTestId('ocr-replace-hint')).toHaveTextContent(
        '1 page has invisible text from another program',
      ),
    );
    expect(
      within(again).getByRole('checkbox', { name: 'Replace existing invisible text' }),
    ).not.toBeChecked();
  });

  it('shows the run, keeps it going when hidden, and cancels without changes', async () => {
    useDeps();
    const { documentId } = await openScan();
    openOcrDialog(documentId as never);
    render(<OcrSheet />);
    await screen.findByTestId('ocr-dialog');
    const run = await enabledRun();
    const edits = useWorkspaceStore.getState().workspace.engineEdits;
    act(() => run.click());

    const progress = await screen.findByTestId('ocr-progress');
    await waitFor(() => expect(progress).toHaveTextContent('Recognized 1 of 2 pages…'));
    expect(runs).toHaveLength(1);
    expect(runs[0]?.request.languages).toEqual(['eng']);
    expect(runs[0]?.request.targets.map((t) => t.index)).toEqual([0, 1]);
    expect(runs[0]?.request.quality).toBe('standard');
    expect(runs[0]?.request.replace).toBe(false);

    // Hidden: the run continues (the status bar shows it).
    act(() =>
      within(screen.getByTestId('ocr-dialog'))
        .getByRole('button', { name: 'Continue in background' })
        .click(),
    );
    await waitFor(() => expect(useOcrStore.getState().dialog).toBeNull());
    expect(useOcrStore.getState().run.kind).toBe('running');

    // Opened again: the progress, and Cancel.
    act(() => openOcrDialog(documentId as never));
    await screen.findByTestId('ocr-progress');
    act(() =>
      within(screen.getByTestId('ocr-dialog'))
        .getByRole('button', { name: 'Cancel recognition' })
        .click(),
    );
    await waitFor(() => expect(useOcrStore.getState().run.kind).toBe('cancelled'));
    expect(await screen.findByTestId('ocr-outcome')).toHaveTextContent(
      'Recognition cancelled. The document is unchanged.',
    );
    expect(useWorkspaceStore.getState().workspace.engineEdits).toBe(edits);
  });

  it('shows the result of a finished run', async () => {
    useDeps();
    const { documentId } = await openScan();
    openOcrDialog(documentId as never);
    render(<OcrSheet />);
    const run = await enabledRun();
    act(() => run.click());
    await waitFor(() => expect(runs).toHaveLength(1));
    act(() => runs[0]?.finish());
    const result = await screen.findByTestId('ocr-result');
    expect(result).toHaveTextContent('Recognize text: 2 pages, eng');
    expect(result).toHaveTextContent('Good: 1 · Review: 1');
    expect(result).toHaveTextContent('Words: 90 · low confidence: 4');
  });

  it('shows a finished run on its own document only', async () => {
    useDeps();
    const { documentId } = await openScan();
    openOcrDialog(documentId as never);
    render(<OcrSheet />);
    const run = await enabledRun();
    act(() => run.click());
    await waitFor(() => expect(runs).toHaveLength(1));
    await screen.findByTestId('ocr-progress');
    act(() =>
      within(screen.getByTestId('ocr-dialog'))
        .getByRole('button', { name: 'Continue in background' })
        .click(),
    );
    await waitFor(() => expect(useOcrStore.getState().dialog).toBeNull());
    act(() => runs[0]?.finish());
    await waitFor(() => expect(useOcrStore.getState().run.kind).toBe('done'));

    // Another document: its own form, not the other run's result.
    const report = await useWorkspaceStore
      .getState()
      .openFiles([await fixtureFile(simpleUrl, 'simple.pdf')]);
    const other = report.opened[0]?.documentId;
    if (!other) throw new Error('simple.pdf did not open');
    act(() => openOcrDialog(other));
    expect(
      await screen.findByRole('button', { name: /^Recognize \d+ pages?$/ }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('ocr-result')).toBeNull();

    // Back on the document it ran on, the result is still there.
    act(() => openOcrDialog(documentId as never));
    expect(await screen.findByTestId('ocr-result')).toHaveTextContent(
      'Recognize text: 2 pages, eng',
    );
  });

  it('says when changed pages are recognised again, in the dialog and in the progress capsule', async () => {
    const { documentId } = await openScan();
    const running = (
      phase: 'recognize' | 'recheck',
      done: number,
      total: number,
      dialog: boolean,
    ) =>
      useOcrStore.setState({
        dialog: dialog ? { view: 'run', documentId: documentId as never } : null,
        run: { kind: 'running', documentId: documentId as never, phase, done, total, languages: 1 },
      });
    act(() => running('recheck', 0, 1, true));
    const stop = watchOcrJob();
    try {
      render(
        <>
          <OcrSheet />
          <ToastRegion />
        </>,
      );
      expect(await screen.findByTestId('ocr-progress')).toHaveTextContent(
        'The document changed: recognizing the changed page again, 0 of 1…',
      );
      // In place while the dialog shows it: no capsule.
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(screen.queryByTestId('progress-capsule')).toBeNull();
      // The dialog closes; the run goes on in the capsule (FB5).
      act(() => running('recheck', 0, 1, false));
      const capsule = await screen.findByTestId('progress-capsule');
      expect(capsule).toHaveTextContent('Recognizing a changed page again: 0 of 1');
      act(() => running('recognize', 1, 2, false));
      expect(capsule).toHaveTextContent('Recognizing text: 1 of 2 pages');
      expect(within(capsule).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
      expect(within(capsule).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    } finally {
      stop();
      resetJobs();
      resetToasts();
    }
  });

  it('opens the language manager and comes back', async () => {
    useDeps();
    const { documentId } = await openScan();
    openOcrDialog(documentId as never);
    render(<OcrSheet />);
    const dialog = await screen.findByTestId('ocr-dialog');
    act(() => within(dialog).getByRole('button', { name: 'Manage languages…' }).click());
    const manager = await screen.findByTestId('ocr-languages');
    const rows = await within(manager).findAllByTestId('ocr-pack');
    expect(rows).toHaveLength(3);
    expect(
      within(manager).getByRole('switch', { name: 'Keep Turkish available offline' }),
    ).toBeChecked();
    expect(
      within(manager).getByRole('switch', { name: 'Keep English available offline' }),
    ).not.toBeChecked();
    act(() => screen.getByRole('button', { name: 'Back' }).click());
    expect(await screen.findByRole('button', { name: 'Recognize 2 pages' })).toBeInTheDocument();
  });
});
