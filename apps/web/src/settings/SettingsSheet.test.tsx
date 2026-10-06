/**
 * S3 in the browser (components/07-sheets.md §5.4, §5.6, §5.8, §5.9; spec redesign D0-10): the
 * side sheet of 480 px with its sections; search filters and says when nothing matches; an
 * opener's row is revealed and its control focused; a system override disables Reduce
 * transparency with its reason; Show tips again is dimmed with a reason until a tip is used
 * up; About Recto shows the About dialog's facts in order, for a pre-release and a release, in
 * the UI language.
 */
import '../styles/tokens.css';
import '../styles/reset.css';
import '../styles/global.css';

import { act, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { useAnnotationStore } from '../annotations/annotation-store';
import { setLocale } from '../i18n';
import { usePwaStore } from '../pwa/register';
import { makeBuildInfo } from '../shell/about/build-info';
import { DEFAULT_APPEARANCE, useAppearanceStore } from '../state/appearance-store';
import { resetInputPolicyStore, useInputPolicyStore } from '../state/input-policy-store';
import { closeSheet, useSheetStore } from '../ui/sheet';
import { openSettings } from './open-settings';
import { AboutPage } from './pages';
import SettingsSheet from './SettingsSheet';

const BETA = makeBuildInfo('1.0.0-beta.0', 'abc1234', '2026-10-01T12:00:00.000Z');
const RELEASE = makeBuildInfo('1.0.0', 'def5678', '2026-10-01T12:00:00.000Z');

let estimate: MockInstance<StorageManager['estimate']>;

beforeEach(async () => {
  useSheetStore.setState({ open: null, front: null, confirm: null, drafts: {} });
  useAppearanceStore.setState(DEFAULT_APPEARANCE);
  resetInputPolicyStore();
  usePwaStore.setState({ status: 'ready', updateAvailable: false });
  estimate = vi.spyOn(navigator.storage, 'estimate').mockResolvedValue({
    usage: 5 * 1024 * 1024,
    quota: 1024 ** 3,
  });
  await page.viewport(1440, 900);
});

afterEach(() => {
  act(() => closeSheet());
  vi.restoreAllMocks();
  setLocale('en');
});

async function settled(dialog: HTMLElement): Promise<void> {
  await waitFor(() => expect(dialog.getAnimations({ subtree: true }).length).toBe(0), {
    timeout: 5000,
  });
}

describe('the Settings sheet', () => {
  it('is a 480 px side sheet with its sections, the search field focused', async () => {
    act(() => openSettings());
    render(<SettingsSheet />);
    const dialog = await screen.findByRole('dialog', { name: 'Settings' });
    await settled(dialog);
    expect(dialog.dataset.presentation).toBe('side');
    expect(dialog.getBoundingClientRect().width).toBe(480);
    expect(
      within(dialog)
        .getAllByRole('heading', { level: 3 })
        .map((h) => h.textContent),
    ).toEqual(['Appearance', 'Language', 'Pen and touch', 'Documents and storage']);
    const search = within(dialog).getByRole('searchbox', { name: 'Search settings' });
    await waitFor(() => expect(search).toHaveFocus());
    expect(within(dialog).getByRole('search')).toContainElement(search);

    await userEvent.type(search, 'gorunum');
    expect(within(dialog).getByRole('switch', { name: 'Glass panels' })).toBeVisible();
    expect(within(dialog).queryByRole('switch', { name: /Pen draws/ })).toBeNull();
    await waitFor(() =>
      expect(within(dialog).getByRole('status')).toHaveTextContent('3 settings found'),
    );
    await userEvent.clear(search);
    await userEvent.type(search, 'xyzzy');
    expect(within(dialog).getByText('No setting matches “xyzzy”')).toBeVisible();
    await waitFor(() =>
      expect(within(dialog).getByRole('status')).toHaveTextContent('No setting matches “xyzzy”'),
    );
  });

  it('opens at a row: revealed, its control focused, and it applies at once', async () => {
    useAnnotationStore.getState().setAuthor('');
    act(() => openSettings({ row: 'commentName' }));
    render(<SettingsSheet />);
    const dialog = await screen.findByRole('dialog', { name: 'Settings' });
    // Tinted once as it opens (the tint fades within 1.2 s).
    expect(dialog.querySelector('[data-row="commentName"]')?.hasAttribute('data-revealed')).toBe(
      true,
    );
    const field = within(dialog).getByRole('textbox', { name: 'Name on comments' });
    await waitFor(() => expect(field).toHaveFocus());
    await userEvent.type(field, 'Ada');
    expect(useAnnotationStore.getState().author).toBe('Ada');
    useAnnotationStore.getState().setAuthor('');
  });

  it('a system setting forces Reduce transparency on, disabled, with its reason', async () => {
    const real = window.matchMedia.bind(window);
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) =>
      query.includes('prefers-reduced-transparency')
        ? ({
            matches: true,
            media: query,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
          } as unknown as MediaQueryList)
        : real(query),
    );
    act(() => openSettings({ section: 'appearance' }));
    render(<SettingsSheet />);
    const dialog = await screen.findByRole('dialog', { name: 'Settings' });
    const control = within(dialog).getByRole('switch', { name: 'Reduce transparency' });
    expect(control).toHaveAttribute('aria-checked', 'true');
    expect(control).toHaveAttribute('aria-disabled', 'true');
    expect(control).toHaveAccessibleDescription('On, set by your system');
    expect(useAppearanceStore.getState().reduceTransparency).toBe(false);
  });

  it('sets Reduce motion: System · On (language.md §7.6, spec D3-4)', async () => {
    act(() => openSettings({ row: 'reduceMotion' }));
    render(<SettingsSheet />);
    const dialog = await screen.findByRole('dialog', { name: 'Settings' });
    await settled(dialog);
    const group = within(dialog).getByRole('radiogroup', { name: 'Reduce motion' });
    const system = within(group).getByRole('radio', { name: 'System' });
    const on = within(group).getByRole('radio', { name: 'On' });
    expect(system).toBeChecked();
    expect(within(dialog).getByText('System follows your device’s setting.')).toBeVisible();
    await userEvent.click(on);
    expect(useAppearanceStore.getState().motion).toBe('reduced');
    expect(on).toBeChecked();
    await userEvent.click(system);
    expect(useAppearanceStore.getState().motion).toBe('system');
  });

  it('a system setting shows Reduce motion On, disabled, with its reason', async () => {
    const real = window.matchMedia.bind(window);
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) =>
      query.includes('prefers-reduced-motion')
        ? ({
            matches: true,
            media: query,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
          } as unknown as MediaQueryList)
        : real(query),
    );
    act(() => openSettings({ row: 'reduceMotion' }));
    render(<SettingsSheet />);
    const dialog = await screen.findByRole('dialog', { name: 'Settings' });
    await settled(dialog);
    const group = within(dialog).getByRole('radiogroup', { name: 'Reduce motion' });
    const on = within(group).getByRole('radio', { name: 'On' });
    expect(on).toBeChecked();
    for (const radio of within(group).getAllByRole('radio')) {
      expect(radio).toHaveAttribute('aria-disabled', 'true');
    }
    // The row's second line, and each disabled segment's reason.
    expect(within(dialog).getAllByText('On, set by your system')[0]).toBeVisible();
    expect(useAppearanceStore.getState().motion).toBe('system');
  });

  it('Show tips again waits, with its reason, until a tip has been used up', async () => {
    act(() => openSettings({ row: 'showTips' }));
    render(<SettingsSheet />);
    const dialog = await screen.findByRole('dialog', { name: 'Settings' });
    const button = () => within(dialog).getByRole('button', { name: 'Show again' });
    expect(button()).toHaveAttribute('aria-disabled', 'true');
    expect(button()).toHaveAccessibleDescription('Every tip shows already');
    act(() => useInputPolicyStore.getState().markEditTextHintShown());
    expect(button()).not.toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(button());
    expect(useInputPolicyStore.getState().editTextHintShown).toBe(false);
  });

  it('pushes About Recto and comes back to the row that pushed it', async () => {
    act(() => openSettings());
    render(<SettingsSheet />);
    const dialog = await screen.findByRole('dialog', { name: 'Settings' });
    await settled(dialog);
    await userEvent.click(within(dialog).getByRole('button', { name: /About Recto/ }));
    await screen.findByRole('dialog', { name: 'About Recto' });
    await settled(dialog);
    expect(within(dialog).getByTestId('settings-about')).toBeVisible();
    const back = within(dialog).getByRole('button', { name: 'Back' });
    await waitFor(() => expect(back).toHaveFocus());
    await userEvent.click(back);
    await screen.findByRole('dialog', { name: 'Settings' });
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: /About Recto/ })).toHaveFocus(),
    );
  });
});

describe('About Recto (the About dialog’s facts, ADR-0017 §6)', () => {
  it('shows every fact, in order, for a pre-release', async () => {
    render(<AboutPage info={BETA} />);
    const about = screen.getByTestId('settings-about');
    expect(within(about).getByTestId('about-prerelease')).toHaveTextContent('Public beta');
    expect(within(about).getByTestId('about-version')).toHaveTextContent('1.0.0-beta.0');
    expect(within(about).getByTestId('about-commit')).toHaveTextContent('abc1234');
    expect(within(about).getByTestId('about-build-date')).toHaveTextContent('October 1, 2026');
    expect(within(about).getByTestId('about-license')).toHaveTextContent('Apache-2.0');
    const notes = within(about).getByRole('link', { name: /Release notes/ });
    expect(notes).toHaveAttribute(
      'href',
      'https://github.com/ErenDenizK/recto/releases/tag/v1.0.0-beta.0',
    );
    const source = within(about).getByRole('link', { name: /Source/ });
    expect(source).toHaveAttribute('href', 'https://github.com/ErenDenizK/recto');
    const aboutPage = within(about).getByRole('link', { name: /How Recto works/ });
    expect(new URL(aboutPage.getAttribute('href') ?? '').pathname).toMatch(/\/about\/$/);
    for (const link of [notes, source, aboutPage]) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noreferrer');
      expect(link).toHaveAccessibleName(/opens in a new tab/);
    }
    await waitFor(() =>
      expect(within(about).getByTestId('about-storage')).toHaveTextContent('5.0 MB'),
    );
    expect(estimate).toHaveBeenCalled();
    expect(within(about).getByTestId('about-offline')).toHaveTextContent(
      'Installed · works offline',
    );
    const text = about.textContent ?? '';
    const order = [
      'Recto',
      'Public beta',
      'Files never leave your device.',
      '1.0.0-beta.0',
      'abc1234',
      'October 1, 2026',
      'Apache-2.0',
      '5.0 MB',
      'Installed · works offline',
      'Release notes',
      'Source',
    ].map((part) => text.indexOf(part));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('has no "Public beta" for a release, and says when storage cannot be estimated', async () => {
    estimate.mockRejectedValue(new Error('blocked'));
    render(<AboutPage info={RELEASE} />);
    expect(screen.queryByTestId('about-prerelease')).toBeNull();
    await waitFor(() =>
      expect(screen.getByTestId('about-storage')).toHaveTextContent(
        'Not available in this browser.',
      ),
    );
  });

  it('formats the build date in the UI language', () => {
    setLocale('tr');
    render(<AboutPage info={BETA} />);
    expect(screen.getByTestId('about-build-date')).toHaveTextContent('1 Ekim 2026');
    expect(screen.getByTestId('about-prerelease')).toHaveTextContent('Açık beta');
    expect(screen.getByText('Dosyalar cihazınızdan asla çıkmaz.')).toBeVisible();
  });
});
