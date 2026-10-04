import '../../styles/tokens.css';

import { act, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import { setLocale } from '../../i18n';
import type { PixelSampler } from '../../viewer/page-pixels';
import { ColourPanel, COLOUR_VIEW_KEY, COMMIT_PAUSE_MS } from './ColourPanel';
import { ColourPicker } from './ColourPicker';
import { colourGrid } from './colour-math';
import {
  RECENT_COLOURS_KEY,
  reloadColourLists,
  SAVED_COLOURS_KEY,
  SAVED_MAX,
} from './saved-colours';

beforeEach(() => {
  reloadColourLists();
});

afterEach(() => {
  setLocale('en');
  vi.useRealTimers();
});

function Host({
  initial = '#1760EE',
  opacity = 0.8,
  onCommit,
  onClose,
  sampler,
}: {
  initial?: string;
  opacity?: number | undefined;
  onCommit?: (v: string, o: number | undefined) => void;
  onClose?: (reason: string) => void;
  sampler?: PixelSampler;
}) {
  const [state, setState] = useState<{ value: string; opacity: number | undefined }>({
    value: initial,
    opacity,
  });
  return (
    <div style={{ width: 296, padding: 12 }}>
      <ColourPanel
        value={state.value}
        opacity={state.opacity}
        onChange={(value, o) => setState({ value, opacity: o })}
        onCommit={onCommit}
        onClose={(reason) => onClose?.(reason)}
        preview={{ width: 2, kind: 'pen' }}
        sampler={sampler}
      />
      <output data-testid="colour">{`${state.value} ${String(state.opacity)}`}</output>
    </div>
  );
}

const shown = () => screen.getByTestId('colour').textContent;

describe('ColourPanel', () => {
  it('opens on the remembered view and remembers a new one', async () => {
    localStorage.setItem(COLOUR_VIEW_KEY, JSON.stringify('sliders'));
    render(<Host />);
    expect(screen.getByRole('radio', { name: 'Sliders' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('slider', { name: 'Hue' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Grid' }));
    expect(screen.getByRole('radiogroup', { name: 'Colour grid' })).toBeInTheDocument();
    expect(localStorage.getItem(COLOUR_VIEW_KEY)).toBe('"grid"');
  });

  it('applies a grid choice live and commits once after a pause', async () => {
    const onCommit = vi.fn();
    render(<Host onCommit={onCommit} />);
    const grid = screen.getByRole('radiogroup', { name: 'Colour grid' });
    const cells = within(grid).getAllByRole('radio');
    expect(cells).toHaveLength(120);
    await userEvent.click(cells[30]!);
    const chosen = colourGrid().rows[1]![6]!;
    expect(shown()).toBe(`${chosen} 0.8`);
    expect(onCommit).not.toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, COMMIT_PAUSE_MS + 150));
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(chosen, 0.8);
    // A committed custom colour is a recent colour.
    expect(JSON.parse(localStorage.getItem(RECENT_COLOURS_KEY) ?? '[]')).toEqual([chosen]);
  });

  it('moves through the grid with 2-D arrows and Home and End per row', async () => {
    render(<Host initial={colourGrid().rows[4]![5]!} />);
    const grid = screen.getByRole('radiogroup', { name: 'Colour grid' });
    const checked = within(grid).getByRole('radio', { checked: true });
    expect(checked).toHaveAttribute('tabindex', '0');
    checked.focus();
    const { greys, rows } = colourGrid();
    await userEvent.keyboard('{ArrowRight}');
    expect(shown()).toBe(`${rows[4]![6]} 0.8`);
    await userEvent.keyboard('{ArrowUp}');
    expect(shown()).toBe(`${rows[3]![6]} 0.8`);
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(shown()).toBe(`${rows[5]![6]} 0.8`);
    await userEvent.keyboard('{End}');
    expect(shown()).toBe(`${rows[5]![11]} 0.8`);
    await userEvent.keyboard('{ArrowRight}');
    expect(shown()).toBe(`${rows[5]![11]} 0.8`);
    await userEvent.keyboard('{Home}');
    expect(shown()).toBe(`${rows[5]![0]} 0.8`);
    for (let i = 0; i < 8; i++) await userEvent.keyboard('{ArrowUp}');
    expect(shown()).toBe(`${greys[0]} 0.8`);
    expect(document.activeElement).toHaveAttribute('aria-checked', 'true');
  });

  it('moves the spectrum loupe in two dimensions, one unit or ten with Shift', async () => {
    localStorage.setItem(COLOUR_VIEW_KEY, JSON.stringify('spectrum'));
    render(<Host initial="#FF0000" />);
    const hue = screen.getByRole('slider', { name: 'Hue' });
    const lightness = screen.getByRole('slider', { name: 'Lightness' });
    expect(hue).toHaveValue('0');
    expect(lightness).toHaveValue('50');
    hue.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(hue).toHaveValue('1');
    await userEvent.keyboard('{Shift>}{ArrowRight}{/Shift}');
    expect(hue).toHaveValue('11');
    await userEvent.keyboard('{ArrowDown}');
    // Focus moves to the axis that changed, so its value is spoken.
    expect(document.activeElement).toBe(lightness);
    expect(lightness).toHaveValue('49');
    await userEvent.keyboard('{Shift>}{ArrowUp}{/Shift}');
    expect(lightness).toHaveValue('59');
    expect(shown()?.startsWith('#')).toBe(true);
    expect(shown()).not.toBe('#FF0000 0.8');
    expect(lightness.getAttribute('aria-valuetext')).toMatch(/^59 percent, /);
  });

  it('takes a hex entry of 3 or 6 digits, with or without #, in any case', async () => {
    localStorage.setItem(COLOUR_VIEW_KEY, JSON.stringify('sliders'));
    render(<Host />);
    const field = screen.getByRole('textbox', { name: 'Hex colour' });
    await userEvent.clear(field);
    await userEvent.type(field, 'abc{Enter}');
    expect(shown()).toBe('#AABBCC 0.8');
    await userEvent.clear(field);
    await userEvent.type(field, '#1a1A1a{Enter}');
    expect(shown()).toBe('#1A1A1A 0.8');
    await userEvent.clear(field);
    await userEvent.type(field, '12{Enter}');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(shown()).toBe('#1A1A1A 0.8');
  });

  it('changes opacity with its slider and says it in percent', async () => {
    render(<Host />);
    const slider = screen.getByRole('slider', { name: 'Opacity' });
    expect(slider).toHaveAttribute('aria-valuetext', '80 percent');
    slider.focus();
    await userEvent.keyboard('{Shift>}{ArrowLeft}{/Shift}');
    expect(shown()).toBe('#1760EE 0.7');
  });

  it('reverts to the opening colour on Esc and closes', async () => {
    const onClose = vi.fn();
    const onCommit = vi.fn();
    render(<Host onClose={onClose} onCommit={onCommit} />);
    const cells = within(screen.getByRole('radiogroup', { name: 'Colour grid' })).getAllByRole(
      'radio',
    );
    await userEvent.click(cells[50]!);
    await new Promise((resolve) => setTimeout(resolve, COMMIT_PAUSE_MS + 150));
    expect(onCommit).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('{Escape}');
    expect(shown()).toBe('#1760EE 0.8');
    expect(onClose).toHaveBeenCalledWith('escape');
    // The commit already made is undone by a commit of the opening colour.
    expect(onCommit).toHaveBeenLastCalledWith('#1760EE', 0.8);
  });

  it('saves up to twelve colours, keeps them per device and removes one with Delete', async () => {
    const colours = Array.from({ length: SAVED_MAX }, (_, i) =>
      `#${(i + 16).toString(16)}2040`.toUpperCase(),
    );
    render(<Host />);
    const add = screen.getByRole('button', { name: 'Add to saved colours' });
    await userEvent.click(add);
    expect(JSON.parse(localStorage.getItem(SAVED_COLOURS_KEY)!)).toEqual(['#1760EE']);
    // Fill to the cap through storage, as another tab would.
    localStorage.setItem(SAVED_COLOURS_KEY, JSON.stringify(colours));
    act(() => reloadColourLists());
    const saved = screen.getByRole('radiogroup', { name: 'Saved colours' });
    expect(within(saved).getAllByRole('radio')).toHaveLength(SAVED_MAX);
    expect(add).toHaveAttribute('aria-disabled', 'true');
    // Still focusable and pressable (it explains itself); Playwright would wait for "enabled".
    act(() => add.click());
    expect(screen.getByText('Saved colours are full. Remove one to add another.')).toBeVisible();
    expect(JSON.parse(localStorage.getItem(SAVED_COLOURS_KEY)!)).toHaveLength(SAVED_MAX);

    const first = within(saved).getAllByRole('radio')[0]!;
    first.focus();
    await userEvent.keyboard('{Delete}');
    expect(JSON.parse(localStorage.getItem(SAVED_COLOURS_KEY)!)).toEqual(colours.slice(1));
    expect(within(saved).getAllByRole('radio')).toHaveLength(SAVED_MAX - 1);
  });

  it('removes a saved colour from its context menu', async () => {
    localStorage.setItem(SAVED_COLOURS_KEY, JSON.stringify(['#123C9A', '#E0201E']));
    act(() => reloadColourLists());
    render(<Host />);
    const saved = screen.getByRole('radiogroup', { name: 'Saved colours' });
    const blue = within(saved).getByRole('radio', { name: 'Dark blue' });
    await userEvent.click(blue, { button: 'right' });
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Remove' }));
    expect(JSON.parse(localStorage.getItem(SAVED_COLOURS_KEY)!)).toEqual(['#E0201E']);
  });

  it('picks a page colour with the eyedropper from the keyboard', async () => {
    const sampler: PixelSampler = (x) => {
      const data = new Uint8ClampedArray(11 * 11 * 4).fill(255);
      return { size: 11, data, centre: x > 10 ? '#336699' : null };
    };
    render(<Host sampler={sampler} />);
    screen.getByRole('button', { name: 'Eyedropper' }).focus();
    await userEvent.keyboard('{Enter}');
    const layer = await screen.findByRole('application', { name: 'Eyedropper' });
    expect(document.activeElement).toBe(layer);
    await userEvent.keyboard('{ArrowLeft}{Shift>}{ArrowUp}{/Shift}{Enter}');
    expect(shown()).toBe('#336699 0.8');
    expect(screen.queryByRole('application')).toBeNull();
  });

  it('cancels the eyedropper with Esc and keeps the colour', async () => {
    const sampler: PixelSampler = () => null;
    const onClose = vi.fn();
    render(<Host sampler={sampler} onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Eyedropper' }));
    await screen.findByRole('application', { name: 'Eyedropper' });
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('application')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(shown()).toBe('#1760EE 0.8');
  });

  it('speaks Turkish', () => {
    setLocale('tr');
    render(<Host />);
    expect(screen.getByRole('heading', { name: 'Renk' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Izgara' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Opaklık' })).toHaveAttribute(
      'aria-valuetext',
      'yüzde 80',
    );
  });
});

describe('ColourPicker', () => {
  function Picker() {
    const [value, setValue] = useState('#1760EE');
    return (
      <>
        <ColourPicker value={value} onChange={(v) => setValue(v)} side="bottom" />
        <output data-testid="picked">{value}</output>
      </>
    );
  }

  it('opens from the well as a dialog, reverts on Esc and returns focus to the well', async () => {
    render(<Picker />);
    const well = screen.getByRole('button', { name: 'Colour: Blue' });
    await userEvent.click(well);
    const dialog = await screen.findByRole('dialog', { name: 'Colour' });
    const cells = within(dialog)
      .getAllByRole('radio')
      .filter((r) => r.closest('[aria-label="Colour grid"]'));
    await userEvent.click(cells[12]!);
    expect(screen.getByTestId('picked').textContent).not.toBe('#1760EE');
    await userEvent.keyboard('{Escape}');
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByTestId('picked').textContent).toBe('#1760EE');
    await vi.waitFor(() => expect(document.activeElement).toBe(well));
  });
});
