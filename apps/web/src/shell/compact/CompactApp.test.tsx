/**
 * The compact edition in browser mode (ADR-0033 §2.3, §3 "AppShell.test gains an edition
 * switch test"): `?edition=compact` on this desktop runner picks the compact edition, its
 * root renders the Library without the full shell, a file opens into the read-only reader,
 * and the Library comes back with the file first in Recents.
 */
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';

import simpleUrl from '../../../../../test/fixtures/simple-text.pdf?url';
import { resetWorkspace } from '../../state/workspace-store';
import {
  decideEdition,
  launchEdition,
  readEditionEnvironment,
  resetEditionForTests,
} from '../frame/edition';
import { CompactApp } from './CompactApp';
import { openPdf } from './compact-actions';
import { resetCompactStore } from './compact-store';

async function fixture(): Promise<File> {
  const bytes = await (await fetch(simpleUrl)).arrayBuffer();
  return new File([bytes], 'simple-text.pdf', { type: 'application/pdf' });
}

describe('the edition switch', () => {
  afterEach(() => {
    resetEditionForTests();
    sessionStorage.removeItem('pdf-editor:edition:v1');
  });

  it('this desktop runner is full, and ?edition=compact makes it compact', () => {
    const env = readEditionEnvironment(window);
    expect(decideEdition({ ...env, search: '', stored: undefined }).edition).toBe('full');
    expect(decideEdition({ ...env, search: '?edition=compact' }).edition).toBe('compact');
    // This browser, with the parameter in its address.
    const win = {
      matchMedia: (query: string) => window.matchMedia(query),
      screen: window.screen,
      location: { search: '?edition=compact' },
      sessionStorage: window.sessionStorage,
      document,
    } as unknown as Window;
    expect(launchEdition(win)).toBe('compact');
    expect(document.documentElement.dataset.edition).toBe('compact');
    expect(sessionStorage.getItem('pdf-editor:edition:v1')).toBe('compact');
  });
});

describe('CompactApp', () => {
  beforeEach(() => {
    resetWorkspace();
    resetCompactStore();
  });

  it('renders the Library, not the full shell', async () => {
    render(<CompactApp />);
    expect(screen.getByRole('button', { name: 'Open PDF' })).toBeVisible();
    // The Colophon Home (EDN-29): the Margin cover and the sample before the first file; no
    // chips for the tools.
    expect(await screen.findByRole('button', { name: 'Try the sample' })).toBeVisible();
    expect(screen.queryByTestId('compact-tools')).toBeNull();
    expect(screen.queryByTestId('app-shell')).toBeNull();
  });

  it('opens a file read-only, and the Library continues it', async () => {
    render(<CompactApp />);
    expect(await openPdf(await fixture())).toBe(true);
    expect(await screen.findByTestId('compact-reader')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'simple-text' })).toBeVisible();
    // The single capsule is its own chunk (EDN-29): wait for it.
    expect(
      await screen.findByTestId('compact-page-number', {}, { timeout: 10_000 }),
    ).toHaveTextContent('1 / 3');
    // Reading: no tool, Markup, Save or Undo; only Edit, which opens the editing capsule.
    expect(screen.queryByRole('button', { name: /^(Markup|Save|Undo|Pen)\b/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Library' }));
    // The document read last is Continue (EDN-29), the shelf does not list it twice.
    const card = await screen.findByTestId('continue-card');
    expect(card).toHaveTextContent('simple-text');
    expect(screen.queryByRole('button', { name: /Reading now$/ })).toBeNull();
  });
});
