/** The Labs section: the toggle, the choice, the reload note and Reset all (DSN-82). */
import '../styles/tokens.css';
import '../styles/reset.css';
import '../styles/global.css';

import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';

import { resetEditionForTests } from '../shell/frame/edition';
import { LabsSection } from './LabsSection';
import { RevealTap } from './RevealTap';
import { labsState, resetLabsStoreForTests } from './store';
import { readLabs } from './stored';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  resetLabsStoreForTests();
  resetEditionForTests();
  history.replaceState(null, '', location.pathname);
});

/** Launches the page as this edition (the address override, DSN-82 filters rows by it). */
function launchAs(edition: 'full' | 'compact'): void {
  history.replaceState(null, '', `${location.pathname}?edition=${edition}`);
  resetEditionForTests();
}

describe('LabsSection', () => {
  it('toggles a switch, asks for a reload, and Reset all puts it back', async () => {
    render(<LabsSection />);
    const margin = screen.getByRole('switch', { name: 'Margin map' });
    expect(margin).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(screen.getByText('Margin map'));
    expect(margin).toHaveAttribute('aria-checked', 'true');
    expect(readLabs().flags).toEqual({ margin: '1' });
    const row = margin.closest('[data-row]') as HTMLElement;
    expect(row).toHaveTextContent('Reload to apply.');
    await userEvent.click(screen.getByRole('button', { name: 'Reset all' }));
    expect(margin).toHaveAttribute('aria-checked', 'false');
    expect(labsState().flags).toEqual({});
    expect(row).not.toHaveTextContent('Reload to apply.');
  });

  it('shows Reload now after a change and hides it again on a revert', async () => {
    render(<LabsSection />);
    expect(screen.queryByRole('button', { name: 'Reload now' })).toBeNull();
    await userEvent.click(screen.getByText('Margin map'));
    expect(screen.getByRole('button', { name: 'Reload now' })).toBeVisible();
    await userEvent.click(screen.getByText('Margin map'));
    expect(screen.queryByRole('button', { name: 'Reload now' })).toBeNull();
  });

  it('lists only the rows of this edition', () => {
    launchAs('compact');
    const { unmount } = render(<LabsSection />);
    expect(screen.getByRole('switch', { name: 'One capsule on the phone' })).toBeVisible();
    expect(screen.queryByRole('switch', { name: 'Margin map' })).toBeNull();
    unmount();
    launchAs('full');
    render(<LabsSection />);
    expect(screen.getByRole('switch', { name: 'Margin map' })).toBeVisible();
    expect(screen.queryByRole('switch', { name: 'One capsule on the phone' })).toBeNull();
  });

  it('picks a value of a multi-value flag', async () => {
    render(<LabsSection />);
    const palette = screen.getByRole('radiogroup', { name: 'Markup palette' });
    await userEvent.click(within(palette).getByRole('radio', { name: 'Groups' }));
    expect(labsState().flags).toEqual({ palette: 'groups' });
  });

  it('lists the text view for the phone, with its hint, and keeps its toggle', async () => {
    launchAs('compact');
    render(<LabsSection />);
    const view = screen.getByRole('switch', { name: 'Text view' });
    const row = view.closest('[data-row]') as HTMLElement;
    expect(row).toHaveTextContent('Nothing leaves this device.');
    await userEvent.click(view);
    expect(readLabs().flags).toEqual({ 'text-view': '1' });
  });

  it('is reachable by keyboard', async () => {
    render(<LabsSection />);
    const first = screen.getAllByRole('switch')[0] as HTMLElement;
    first.focus();
    await userEvent.keyboard(' ');
    expect(first).toHaveAttribute('aria-checked', 'true');
  });
});

describe('RevealTap', () => {
  it('reveals Labs after five taps on the version', async () => {
    render(<RevealTap>1.0.0-beta.0</RevealTap>);
    const version = screen.getByText('1.0.0-beta.0');
    for (let i = 0; i < 4; i++) await userEvent.click(version);
    expect(labsState().shown).toBe(false);
    await userEvent.click(version);
    expect(labsState().shown).toBe(true);
    expect(readLabs().shown).toBe(true);
  });
});
