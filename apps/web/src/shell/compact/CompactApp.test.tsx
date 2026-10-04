/**
 * The compact edition in browser mode (ADR-0033 §2.3, §3 "AppShell.test gains an edition
 * switch test"): `?edition=compact` on this desktop runner picks the compact edition, its
 * root renders the Library without the full shell, a file opens into the read-only reader,
 * and the Library comes back with the file first in Recents.
 */
import { render, screen, waitFor } from '@testing-library/react';
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

  it('renders the Library, not the full shell', () => {
    render(<CompactApp />);
    expect(screen.getByRole('button', { name: 'Open PDF' })).toBeVisible();
    expect(
      screen.getByText(
        'Reading only on phones for now. Open this file on a computer or tablet to mark it up.',
      ),
    ).toBeVisible();
    expect(screen.queryByTestId('app-shell')).toBeNull();
  });

  it('opens a file read-only, and the Library lists it first', async () => {
    render(<CompactApp />);
    expect(await openPdf(await fixture())).toBe(true);
    expect(await screen.findByTestId('compact-reader')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'simple-text' })).toBeVisible();
    expect(screen.getByTestId('compact-page-number')).toHaveTextContent('1 / 3');
    // Reading only: no tool, Markup, Edit or Save anywhere.
    expect(screen.queryByRole('button', { name: /^(Markup|Edit|Save|Undo)\b/ })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Library' }));
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /^simple-text\.pdf, .*Reading now$/ }),
      ).toBeVisible();
    });
  });
});
