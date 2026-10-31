/**
 * The Save a copy target line and the Size a byte target picks (decision PRD-40; spec niyet
 * §2.12), Vitest browser mode: the line says the target is missed whenever the chosen Size's
 * estimate is above it, and a Size the person picks before the estimates arrive is theirs.
 */
import '../styles/tokens.css';
import '../styles/reset.css';
import '../styles/global.css';

import { render, screen, waitFor, within } from '@testing-library/react';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import markdownUrl from '../../../../test/fixtures/markdown-source.pdf?url';
import { fixtureFile } from '../../test/store-harness';
import { getAnalysisWorkers } from '../engine/engine-service';
import { setLocale } from '../i18n';
import { resetWorkspace, useWorkspaceStore } from '../state/workspace-store';
import { useSheetStore } from '../ui/sheet/sheet-store';
import { openSaveCopy } from './export-store';
import { DEFAULT_DRAFT, type SaveCopyDraft, type SizeEstimates } from './save-copy-model';
import { SaveCopyHost } from './SaveCopyHost';
import { SizeSection } from './SaveCopySections';

import './SaveCopySheet';

// The size analysis waits on this until the test releases it, so the estimates always arrive
// after the person's pick.
const gate = vi.hoisted(() => ({
  held: Promise.resolve(),
  release: (): void => undefined,
}));
vi.mock(import('../tools/compress-client'), async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    getCompressor: async () => {
      await gate.held;
      return original.getCompressor();
    },
  };
});

const MB = 1024 * 1024;
const estimate = (after: number) => ({
  before: 4 * MB,
  after,
  ratio: 0.5,
  losslessSaved: 0,
  imagesSaved: 0,
  candidates: 0,
  skipped: 0,
  worthwhile: true,
});
const ESTIMATES: SizeEstimates = {
  same: 4 * MB,
  smaller: estimate(3 * MB),
  smallest: estimate(2.5 * MB),
  custom: estimate(3 * MB),
};

beforeEach(() => {
  setLocale('en');
  resetWorkspace();
});
afterEach(() => {
  useSheetStore.setState({ open: null, front: null, drafts: {} });
  resetWorkspace();
});
afterAll(() => getAnalysisWorkers().terminate());

function line(size: SaveCopyDraft['size'], target: number): string {
  const { unmount } = render(
    <SizeSection
      draft={{ ...DEFAULT_DRAFT, size }}
      patch={() => undefined}
      analysis={null}
      estimates={ESTIMATES}
      quick={null}
      target={target}
      groupRef={{ current: null }}
      onWhatSmaller={() => undefined}
    />,
  );
  const text = screen.getByTestId('save-copy-target').textContent ?? '';
  unmount();
  return text;
}

describe('the target line', () => {
  it('says the target is missed for any Size whose estimate is above it', () => {
    expect(line('same', 2 * MB)).toMatch(/Same.*above the target/);
    expect(line('smaller', 2 * MB)).toMatch(/Smaller.*above the target/);
    expect(line('smallest', 2 * MB)).toMatch(/target can’t be reached/);
  });

  it('shows a plain line when the chosen Size meets the target', () => {
    expect(line('smaller', 3 * MB)).not.toMatch(/above the target/);
    expect(line('smallest', 3 * MB)).toMatch(/^Target: under 3.0 MB · Smallest/);
  });
});

describe('a size picked before the estimates arrive', () => {
  it('is not overwritten by the target when they do', async () => {
    const report = await useWorkspaceStore
      .getState()
      .openFiles([await fixtureFile(markdownUrl, 'markdown-source.pdf')]);
    const id = report.opened[0]?.documentId;
    if (!id) throw new Error('did not open');
    gate.held = new Promise<void>((resolve) => {
      gate.release = resolve;
    });
    render(<SaveCopyHost />);
    // One byte is out of reach, so the target would pick Smallest once the estimates arrive.
    openSaveCopy(id, { kind: 'size', targetBytes: 1 });
    const sheet = await screen.findByTestId('save-copy-sheet', {}, { timeout: 15_000 });
    await userEvent.click(within(sheet).getByRole('radio', { name: /^Same/ }));
    expect(within(sheet).queryByTestId('save-copy-target')).toBeNull();
    gate.release();
    await waitFor(() => expect(within(sheet).getByTestId('save-copy-target')).toBeVisible(), {
      timeout: 20_000,
    });
    expect(within(sheet).getByRole('radio', { name: /^Same/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(within(sheet).getByTestId('save-copy-target').textContent).toMatch(/above the target/);
  }, 40_000);
});
