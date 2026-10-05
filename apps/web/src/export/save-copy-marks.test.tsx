/**
 * Save a copy and unapplied redaction marks (07-sheets §4.4; spec 07.10): the marks are read
 * asynchronously, so a press before they are known must not save a PDF copy that keeps the text
 * under them. The primary waits (busy) until they are known; then the press asks first, and the
 * save picker opens only from the answer's press.
 */
import '../styles/tokens.css';
import '../styles/reset.css';
import '../styles/global.css';

import type { SourceId } from '@pdf-editor/document-model';
import { render, screen, waitFor } from '@testing-library/react';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import markdownUrl from '../../../../test/fixtures/markdown-source.pdf?url';
import { fixtureFile } from '../../test/store-harness';
import { getAnalysisWorkers } from '../engine/engine-service';
import { pendingMarksOf } from '../files/save';
import type { RedactMark } from '../redaction/marks';
import { resetWorkspace, useWorkspaceStore } from '../state/workspace-store';
import { useSheetStore } from '../ui/sheet/sheet-store';
import { closeSaveCopy, openSaveCopy } from './export-store';
import { SaveCopyHost } from './SaveCopyHost';
// The host loads the sheet lazily; loading its module graph up front keeps Vite from finding
// new dependencies mid-test, which reloads the test page.
import './SaveCopySheet';

vi.mock(import('../files/save'), async (importOriginal) => ({
  ...(await importOriginal()),
  pendingMarksOf: vi.fn(),
}));

beforeEach(() => resetWorkspace());
afterEach(() => {
  closeSaveCopy();
  useSheetStore.setState({ open: null, front: null, drafts: {} });
  resetWorkspace();
  vi.mocked(pendingMarksOf).mockReset();
});
afterAll(() => getAnalysisWorkers().terminate());

function mark(id: string): RedactMark {
  const rect = { x: 72, y: 700, width: 120, height: 14 };
  return { kind: 'redact', id, pageIndex: 0, quads: [rect], rect, color: '#ff0000' } as never;
}

describe('Save a copy with unapplied marks', () => {
  it('a press before the marks are known neither saves nor skips the question', async () => {
    const report = await useWorkspaceStore
      .getState()
      .openFiles([await fixtureFile(markdownUrl, 'markdown-source.pdf')]);
    const id = report.opened[0]?.documentId;
    if (!id) throw new Error('did not open');
    const source = Object.keys(useWorkspaceStore.getState().workspace.sources)[0] as SourceId;

    // The marks resolve only when the test says so (the edit runner busy, pages unread).
    let release: () => void = () => undefined;
    vi.mocked(pendingMarksOf).mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve(new Map([[source, [mark('m1'), mark('m2')]]]));
        }),
    );
    const picker = vi.fn(() => Promise.reject(new DOMException('cancelled', 'AbortError')));
    const before = Object.getOwnPropertyDescriptor(window, 'showSaveFilePicker');
    Object.defineProperty(window, 'showSaveFilePicker', { value: picker, configurable: true });
    try {
      render(<SaveCopyHost />);
      openSaveCopy(id);
      const sheet = await screen.findByTestId('save-copy-sheet', {}, { timeout: 15_000 });
      const primary = sheet.querySelector<HTMLButtonElement>('[data-sheet-primary]');
      if (!primary) throw new Error('no primary');
      await waitFor(() => expect(pendingMarksOf).toHaveBeenCalled());

      // Mod+Shift+S, Enter at once: the marks are not known yet. (A busy button is not
      // actionable for the test driver, so the press is dispatched on the element.)
      await userEvent.click(screen.getByRole('textbox', { name: 'Name' }));
      await userEvent.keyboard('{Enter}');
      primary.click();
      expect(picker).not.toHaveBeenCalled();
      expect(screen.queryByTestId('save-copy-marks')).toBeNull();
      expect(primary).toHaveAttribute('aria-busy', 'true');

      release();
      await waitFor(() => expect(primary).not.toHaveAttribute('aria-busy'));
      await userEvent.click(primary);
      const question = await screen.findByTestId('save-copy-marks');
      expect(question).toHaveTextContent('2 marks not applied');
      expect(picker).not.toHaveBeenCalled();
      // The answer's press opens the picker.
      await userEvent.click(screen.getByRole('button', { name: 'Save without applying' }));
      expect(picker).toHaveBeenCalledTimes(1);
    } finally {
      if (before) Object.defineProperty(window, 'showSaveFilePicker', before);
      else delete (window as { showSaveFilePicker?: unknown }).showSaveFilePicker;
    }
  }, 30_000);
});
