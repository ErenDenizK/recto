/**
 * Settings › Theme colour (DSN-88): a row with a button naming the colour in force that opens a
 * picker of three swatches with their names, one radiogroup (one Tab stop, the arrows move and
 * choose); a choice applies at once, is announced and is kept per device.
 */
import '../styles/tokens.css';
import '../styles/reset.css';
import '../styles/global.css';
import '../styles/fener.css';

import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';

import { setLocale } from '../i18n';
import { DEFAULT_FENER_PRESET, FENER_STORAGE_KEY, useFenerStore } from '../state/fener';
import { settled } from '../../test/settled';
import { AccentRow } from './AccentRow';

beforeEach(() => {
  localStorage.clear();
  useFenerStore.setState({ accent: DEFAULT_FENER_PRESET });
});

afterEach(() => {
  setLocale('en');
});

async function openPicker() {
  const trigger = screen.getByRole('button', { name: /^Theme colour: / });
  await userEvent.click(trigger);
  const group = await screen.findByRole('radiogroup', { name: 'Theme colour' });
  await settled(group);
  return { trigger, group };
}

describe('AccentRow', () => {
  it('names the colour in force on its button, Çivit (Indigo) to start', () => {
    render(<AccentRow />);
    const trigger = screen.getByRole('button', { name: 'Theme colour: Indigo' });
    expect(trigger).toHaveTextContent('Indigo');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Theme colour')).toBeVisible();
  });

  it('opens a radiogroup of three named swatches with the colour in force checked', async () => {
    render(<AccentRow />);
    const { trigger, group } = await openPicker();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const radios = within(group).getAllByRole('radio');
    expect(radios.map((radio) => radio.getAttribute('aria-label'))).toEqual([
      'Indigo',
      'Violet',
      'Blue',
    ]);
    expect(radios.map((radio) => radio.getAttribute('aria-checked'))).toEqual([
      'true',
      'false',
      'false',
    ]);
    // The names are visible beside the swatches, not only announced.
    for (const name of ['Indigo', 'Violet', 'Blue'])
      expect(within(group).getByText(name)).toBeVisible();
  });

  it('applies a choice at once, keeps it per device and shows it on the button', async () => {
    render(<AccentRow />);
    const { group } = await openPicker();
    await userEvent.click(within(group).getByRole('radio', { name: 'Violet' }));
    expect(useFenerStore.getState().accent).toBe('violet');
    expect(JSON.parse(localStorage.getItem(FENER_STORAGE_KEY) ?? 'null')).toEqual({
      accent: 'violet',
    });
    expect(within(group).getByRole('radio', { name: 'Violet' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Theme colour: Violet' })).toBeVisible();
  });

  it('moves and chooses with the arrow keys, one Tab stop for the group', async () => {
    render(<AccentRow />);
    const { group } = await openPicker();
    const radios = within(group).getAllByRole('radio');
    const stops = radios.filter((radio) => radio.tabIndex === 0);
    expect(stops).toHaveLength(1);
    (stops[0] as HTMLElement).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(useFenerStore.getState().accent).toBe('violet');
    await userEvent.keyboard('{ArrowRight}');
    expect(useFenerStore.getState().accent).toBe('blue');
    expect(document.activeElement).toBe(within(group).getByRole('radio', { name: 'Blue' }));
  });

  it('names the colours in Turkish: Çivit, Mor, Mavi', async () => {
    setLocale('tr');
    render(<AccentRow />);
    expect(screen.getByRole('button', { name: 'Tema rengi: Çivit' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Tema rengi: Çivit' }));
    const group = await screen.findByRole('radiogroup', { name: 'Tema rengi' });
    expect(
      within(group)
        .getAllByRole('radio')
        .map((radio) => radio.getAttribute('aria-label')),
    ).toEqual(['Çivit', 'Mor', 'Mavi']);
  });
});
