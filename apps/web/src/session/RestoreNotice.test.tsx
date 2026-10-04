/**
 * The session notice and the privacy popover's "Kept on this device" (Vitest browser mode):
 * copy per notice, a polite status, Start fresh and Dismiss; the list, the honesty lines and
 * Clear behind one confirmation.
 */
import type { DocumentId } from '@pdf-editor/document-model';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { KeptOnDevice } from './KeptOnDevice';
import { RestoreNotice } from './RestoreNotice';
import { resetSessionStore, setSessionNotice, useSessionStore } from './session-store';

const docs = ['doc_a', 'doc_b', 'doc_c'] as DocumentId[];

describe('RestoreNotice', () => {
  beforeEach(() => resetSessionStore());
  afterEach(() => resetSessionStore());

  it('renders nothing without a notice', () => {
    render(<RestoreNotice />);
    expect(screen.queryByTestId('session-notice')).toBeNull();
  });

  it('says how many documents came back, as a status, with Start fresh', () => {
    setSessionNotice({ kind: 'restored', documents: docs });
    render(<RestoreNotice />);
    expect(screen.getByRole('status')).toHaveTextContent('Restored 3 documents');
    expect(screen.getByRole('button', { name: 'Start fresh' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(useSessionStore.getState().notice).toBeNull();
  });

  it('names a single document', () => {
    setSessionNotice({ kind: 'restored', documents: [docs[0] as DocumentId], title: 'report' });
    render(<RestoreNotice />);
    expect(screen.getByRole('status')).toHaveTextContent('Restored report');
  });

  it('offers Download a copy in the compact edition for a document with changes', () => {
    let copied = 0;
    setSessionNotice({
      kind: 'restored',
      documents: [docs[0] as DocumentId],
      title: 'report',
      offerCopy: true,
    });
    render(<RestoreNotice edition="compact" onDownloadCopy={() => (copied += 1)} />);
    expect(screen.queryByRole('button', { name: 'Start fresh' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Download a copy' }));
    expect(copied).toBe(1);
  });

  it('shows Started fresh with Undo, a failure, and the private-window line', () => {
    setSessionNotice({ kind: 'started-fresh', count: 2 });
    const { rerender } = render(<RestoreNotice />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Started fresh · 2 documents kept in Recent',
    );
    expect(screen.getByRole('button', { name: 'Undo' })).toBeVisible();
    setSessionNotice({ kind: 'failed', names: ['agreement'] });
    rerender(<RestoreNotice />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Could not restore agreement: its kept copy is damaged. The original file is unchanged.',
    );
    setSessionNotice({ kind: 'not-kept' });
    rerender(<RestoreNotice />);
    expect(screen.getByRole('status')).toHaveTextContent('Changes are not kept in this window');
  });
});

describe('KeptOnDevice', () => {
  beforeEach(() => resetSessionStore());
  afterEach(() => resetSessionStore());

  it('lists what is kept with sizes and clears after one confirmation', async () => {
    useSessionStore.setState({
      keeping: 'available',
      persisted: true,
      totalBytes: 3 * 1024 * 1024,
      items: [
        {
          id: 'doc_a',
          title: 'report',
          bytes: 2 * 1024 * 1024,
          state: 'open',
          at: 1,
          changed: true,
        },
        {
          id: 'kept-b',
          title: 'lease',
          bytes: 1024 * 1024,
          state: 'closed',
          at: 1,
          changed: false,
        },
      ],
    });
    render(<KeptOnDevice />);
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toMatch(/report.*Open · 2(\.0)? MB/);
    expect(rows[1]?.textContent).toMatch(/lease.*Closed · 1(\.0)? MB/);
    expect(screen.queryByRole('note')).toBeNull();
    fireEvent.click(screen.getByTestId('privacy-kept-clear'));
    expect(
      screen.getByText('Delete everything kept on this device? Saved files are not touched.'),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByTestId('privacy-kept-clear')).toBeVisible();
    fireEvent.click(screen.getByTestId('privacy-kept-clear'));
    fireEvent.click(screen.getByTestId('privacy-kept-delete'));
    // Without a running session there is nothing to delete; the confirmation closes.
    expect(await screen.findByTestId('privacy-kept-clear')).toBeVisible();
  });

  it('says when nothing is kept, and when the browser may clear it', () => {
    useSessionStore.setState({ keeping: 'available', persisted: false, items: [], totalBytes: 0 });
    render(<KeptOnDevice />);
    expect(screen.getByTestId('privacy-kept-empty')).toHaveTextContent(
      'Nothing is kept on this device.',
    );
    expect(screen.getByRole('note')).toHaveTextContent('The browser may clear kept changes.');
    expect(screen.getByTestId('privacy-kept-clear')).toBeDisabled();
  });

  it('says a private window keeps nothing', () => {
    useSessionStore.setState({ keeping: 'unavailable' });
    render(<KeptOnDevice />);
    expect(screen.getByRole('note')).toHaveTextContent('Changes are not kept in this window');
    expect(screen.queryByTestId('privacy-kept-clear')).toBeNull();
  });
});
