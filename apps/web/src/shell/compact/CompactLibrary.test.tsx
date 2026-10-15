/**
 * The compact Library's composition (DSN-31; ADR-0033 §2.3, §3): identity, the tools as chips
 * with the sentence for screen readers, Try the sample as a card, Recents' first-run card, and
 * Open PDF in the floating dock; every target at least 44 px (A-15).
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useRecentsStore } from '../../files/recents';
import { CompactLibrary } from './CompactLibrary';
import { resetCompactStore } from './compact-store';

function height(element: HTMLElement): number {
  return element.getBoundingClientRect().height;
}

describe('CompactLibrary', () => {
  beforeEach(() => {
    resetCompactStore();
  });

  it('heads itself with the mark, the wordmark and the promise', () => {
    render(<CompactLibrary />);
    expect(screen.getByRole('heading', { level: 1, name: 'Recto' })).toBeVisible();
    expect(
      screen.getByText('Read, mark up and sign PDFs. Nothing leaves this phone.'),
    ).toBeVisible();
  });

  it('shows the phone’s tools as chips and reads them as one sentence', () => {
    render(<CompactLibrary />);
    const tools = screen.getByTestId('compact-tools');
    for (const name of ['Pen', 'Highlight', 'Text', 'Sign']) {
      expect(within(tools).getByText(name)).toBeVisible();
    }
    expect(within(tools).getByText('Every tool on a computer or tablet.')).toBeVisible();
    // The chips and the line are for the eye; a screen reader hears the sentence once.
    expect(
      within(tools).getByText(
        'Pen, highlight, text and signature on your phone. Every tool on a computer or tablet.',
      ),
    ).toHaveClass('visually-hidden');
    expect(within(tools).getByRole('list', { hidden: true })).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });

  it('offers the sample as a card named Try the sample', () => {
    render(<CompactLibrary />);
    const sample = screen.getByRole('button', { name: 'Try the sample' });
    expect(sample).toHaveAccessibleDescription('A small magazine to try your phone’s tools on.');
    expect(sample).toHaveAttribute('data-testid', 'compact-sample');
    expect(height(sample)).toBeGreaterThanOrEqual(44);
  });

  it('puts Open PDF in the dock, and keeps every target at 44 px or more', () => {
    render(<CompactLibrary />);
    const dock = screen.getByTestId('compact-library-dock');
    const open = within(dock).getByRole('button', { name: 'Open PDF' });
    expect(open).toBeVisible();
    expect(height(open)).toBeGreaterThanOrEqual(44);
    expect(getComputedStyle(dock.parentElement as HTMLElement).position).toBe('fixed');
    for (const name of ['English', 'Türkçe']) {
      expect(height(screen.getByRole('button', { name }))).toBeGreaterThanOrEqual(44);
    }
  });

  it('holds Recents’ place with a quiet card before the first file', async () => {
    useRecentsStore.setState({ loaded: true, entries: [] });
    render(<CompactLibrary />);
    const empty = await screen.findByTestId('compact-recents-empty');
    expect(within(empty).getByRole('heading', { name: 'Recent' })).toBeVisible();
    expect(empty).toHaveTextContent('No files yet');
    await waitFor(() => {
      expect(screen.getByTestId('compact-library')).toHaveAttribute('data-first-run');
    });
  });
});
