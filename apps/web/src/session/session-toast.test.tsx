/**
 * The session notice as a toast (D0-5 over D0-7) and the privacy popover's "Kept on this
 * device" (Vitest browser mode): copy per notice, said once, Start fresh and Undo replacing
 * the toast in place, Dismiss clearing the notice, Download a copy in the compact edition;
 * the list, the honesty lines and Clear behind one confirmation.
 */
import type { DocumentId } from '@pdf-editor/document-model';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resetAnnouncer, useAnnouncer } from '../shell/announcer';
import { resetToasts } from '../ui/Toast/toast-store';
import { ToastRegion } from '../ui/Toast/ToastRegion';
import { KeptOnDevice } from './KeptOnDevice';
import { resetSessionStore, setSessionNotice, useSessionStore } from './session-store';
import { watchSessionNotice } from './session-toast';

const docs = ['doc_a', 'doc_b', 'doc_c'] as DocumentId[];

describe('the session notice toast', () => {
  let stop: () => void = () => undefined;
  beforeEach(() => {
    resetSessionStore();
    resetToasts();
    resetAnnouncer();
  });
  afterEach(() => {
    stop();
    resetSessionStore();
    resetToasts();
  });

  const notice = () => screen.queryByTestId('session-notice');

  it('shows nothing without a notice', () => {
    stop = watchSessionNotice();
    render(<ToastRegion />);
    expect(notice()).toBeNull();
  });

  it('says how many documents came back, once, with Start fresh; Dismiss clears it', async () => {
    stop = watchSessionNotice();
    render(<ToastRegion />);
    act(() => setSessionNotice({ kind: 'restored', documents: docs }));
    const toast = await screen.findByTestId('session-notice');
    expect(toast).toHaveAccessibleName('Restored 3 documents');
    expect(useAnnouncer.getState().message).toMatch(/^Restored 3 documents/);
    // Visible once the entrance fade has run.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start fresh' })).toBeVisible());
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(useSessionStore.getState().notice).toBeNull();
    await waitFor(() => expect(notice()).toBeNull());
  });

  it('names a single document', async () => {
    stop = watchSessionNotice();
    render(<ToastRegion />);
    act(() =>
      setSessionNotice({ kind: 'restored', documents: [docs[0] as DocumentId], title: 'report' }),
    );
    expect(await screen.findByTestId('session-notice')).toHaveTextContent('Restored report');
  });

  it('offers Download a copy in the compact edition for a document with changes', async () => {
    let copied = 0;
    stop = watchSessionNotice({ onDownloadCopy: () => (copied += 1) });
    render(<ToastRegion edition="compact" />);
    act(() =>
      setSessionNotice({
        kind: 'restored',
        documents: [docs[0] as DocumentId],
        title: 'report',
        offerCopy: true,
      }),
    );
    await screen.findByTestId('session-notice');
    expect(screen.queryByRole('button', { name: 'Start fresh' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Download a copy' }));
    expect(copied).toBe(1);
    expect(useSessionStore.getState().notice).toBeNull();
  });

  it('replaces the toast in place for Started fresh, a failure and the private-window line', async () => {
    stop = watchSessionNotice();
    render(<ToastRegion />);
    act(() => setSessionNotice({ kind: 'started-fresh', count: 2 }));
    const toast = await screen.findByTestId('session-notice');
    expect(toast).toHaveTextContent('Started fresh · 2 documents kept in Recent');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Undo' })).toBeVisible());
    act(() => setSessionNotice({ kind: 'failed', names: ['agreement'] }));
    // One toast, the same element, new words.
    expect(screen.getAllByTestId('session-notice')).toHaveLength(1);
    expect(screen.getByTestId('session-notice')).toBe(toast);
    expect(toast).toHaveTextContent(
      'Could not restore agreement: its kept copy is damaged. The original file is unchanged.',
    );
    // A document that did not load waits in Recents (a skipped password, an engine failure).
    act(() => setSessionNotice({ kind: 'failed', names: ['agreement'], kept: true }));
    expect(toast).toHaveTextContent(
      'Could not restore agreement now. Its changes are kept in Recent: open it there to try again.',
    );
    act(() => setSessionNotice({ kind: 'not-kept' }));
    expect(toast).toHaveTextContent('Changes are not kept in this window');
    act(() => setSessionNotice(null));
    await waitFor(() => expect(notice()).toBeNull());
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
    // ui/Button stays focusable while disabled (aria-disabled), so its reason can be read.
    expect(screen.getByTestId('privacy-kept-clear')).toHaveAttribute('aria-disabled', 'true');
  });

  it('says a private window keeps nothing', () => {
    useSessionStore.setState({ keeping: 'unavailable' });
    render(<KeptOnDevice />);
    expect(screen.getByRole('note')).toHaveTextContent('Changes are not kept in this window');
    expect(screen.queryByTestId('privacy-kept-clear')).toBeNull();
  });
});
