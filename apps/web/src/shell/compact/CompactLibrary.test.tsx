/**
 * The compact Library's composition (DSN-31, DSN-50; ADR-0033 §2.3, §3): identity, the tools as
 * chips with the sentence for screen readers, Recents before Try the sample (the sample first
 * before the first file, over Recents' first-run card), and Open PDF in the floating dock; every
 * target at least 44 px (A-15); no language switch (DSN-46).
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { type RecentEntry, useRecentsStore } from '../../files/recents';
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
    // No language switch on the page: it is a setting (DSN-46, About's rows on a phone).
    for (const name of ['English', 'Türkçe']) {
      expect(screen.queryByRole('button', { name })).toBeNull();
    }
  });

  it('holds Recents’ place with a quiet card before the first file, under the sample', async () => {
    useRecentsStore.setState({ loaded: true, entries: [] });
    render(<CompactLibrary />);
    const empty = await screen.findByTestId('compact-recents-empty');
    expect(within(empty).getByRole('heading', { name: 'Recent' })).toBeVisible();
    expect(empty).toHaveTextContent('No files yet');
    expect(within(empty).queryByRole('button', { name: 'Clear recents' })).toBeNull();
    await waitFor(() => {
      expect(screen.getByTestId('compact-library')).toHaveAttribute('data-first-run');
    });
    const sample = screen.getByRole('button', { name: 'Try the sample' });
    expect(sample.getBoundingClientRect().bottom).toBeLessThan(empty.getBoundingClientRect().top);
  });

  it('lists Recents before the sample once there are files (DSN-50)', async () => {
    const entry: RecentEntry = {
      id: 'r1',
      name: 'report.pdf',
      size: 2048,
      openedAt: Date.now(),
      pages: 3,
    };
    useRecentsStore.setState({ loaded: true, entries: [entry] });
    render(<CompactLibrary />);
    const list = await screen.findByTestId('compact-recents');
    expect(within(list).getByRole('button', { name: /^report\.pdf, / })).toBeVisible();
    const sample = screen.getByRole('button', { name: 'Try the sample' });
    expect(sample.getBoundingClientRect().top).toBeGreaterThan(list.getBoundingClientRect().bottom);
    // The order is the stylesheet's: the DOM keeps the intro together.
    expect(screen.getByTestId('compact-library')).not.toHaveAttribute('data-first-run');
  });
});
