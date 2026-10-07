import '../styles/tokens.css';
import '../styles/global.css';

import { act, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cdp, userEvent } from 'vitest/browser';

import { setLocale } from '../i18n';
import { NumberField, parseLocaleNumber } from './NumberField';
import { SearchField } from './SearchField';
import { TextArea, TextField } from './TextField';

/** Chrome DevTools Protocol, typed loosely (the provider's session type is not exported). */
function devtools(method: string, params: object): Promise<unknown> {
  return (cdp() as unknown as { send(m: string, p: object): Promise<unknown> }).send(
    method,
    params,
  );
}

async function coarse(run: () => void): Promise<void> {
  await devtools('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  try {
    run();
  } finally {
    await devtools('Emulation.setTouchEmulationEnabled', { enabled: false });
  }
}

function wellOf(input: HTMLElement): HTMLElement {
  return input.parentElement as HTMLElement;
}

describe('TextField', () => {
  function Host({ error, onEscape }: { error?: string; onEscape?: () => void }) {
    const [v, setV] = useState('report.pdf');
    return (
      // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- the test's surface listens for Esc
      <div
        onKeyDown={(event) => {
          if (event.key === 'Escape') onEscape?.();
        }}
      >
        <TextField
          label="Name"
          value={v}
          onValueChange={setV}
          description="Saves next to the original."
          error={error}
        />
        <output data-testid="value">{v}</output>
      </div>
    );
  }

  it('is labelled and described, in a 32 px well with a 13 px text', () => {
    render(<Host />);
    const input = screen.getByRole('textbox', { name: 'Name' });
    expect(input).toHaveAccessibleDescription('Saves next to the original.');
    expect(wellOf(input).getBoundingClientRect().height).toBe(32);
    expect(getComputedStyle(input).fontSize).toBe('13px');
    expect(getComputedStyle(wellOf(input)).borderTopLeftRadius).toBe('10px');
  });

  it('shows an error in place of the description and marks the field invalid', () => {
    render(<Host error="Enter a name." />);
    const input = screen.getByRole('textbox', { name: 'Name' });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Enter a name.');
    expect(wellOf(input)).toHaveAttribute('data-invalid');
  });

  it('draws the inset ring on the well while the input has focus', async () => {
    render(<Host />);
    const input = screen.getByRole('textbox', { name: 'Name' });
    await userEvent.click(input);
    const well = getComputedStyle(wellOf(input));
    expect(well.outlineStyle).toBe('solid');
    expect(well.outlineOffset).toBe('-2px');
  });

  it('Esc restores the value once and keeps the key; the next Esc passes on', async () => {
    const onEscape = vi.fn();
    render(<Host onEscape={onEscape} />);
    const input = screen.getByRole('textbox', { name: 'Name' });
    await userEvent.click(input);
    await userEvent.keyboard('{End}-copy');
    expect(screen.getByTestId('value').textContent).toBe('report.pdf-copy');
    await userEvent.keyboard('{Escape}');
    expect(screen.getByTestId('value').textContent).toBe('report.pdf');
    expect(onEscape).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('shows and hides a password', async () => {
    function Password() {
      const [v, setV] = useState('secret');
      return <TextField label="Password" type="password" value={v} onValueChange={setV} />;
    }
    render(<Password />);
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('uses 16 px text in a 44 px well on a coarse pointer', async () => {
    await coarse(() => {
      render(<Host />);
      const input = screen.getByRole('textbox', { name: 'Name' });
      expect(getComputedStyle(input).fontSize).toBe('16px');
      expect(wellOf(input).getBoundingClientRect().height).toBe(44);
    });
  });

  it('grows a text area from three lines to eight', async () => {
    function Notes() {
      const [v, setV] = useState('');
      return <TextArea label="Note" value={v} onValueChange={setV} />;
    }
    render(<Notes />);
    const area = screen.getByRole('textbox', { name: 'Note' });
    const three = area.getBoundingClientRect().height;
    await userEvent.click(area);
    await userEvent.keyboard('1{Enter}2{Enter}3{Enter}4{Enter}5');
    expect(area.getBoundingClientRect().height).toBeGreaterThan(three);
    await userEvent.keyboard('{Enter}6{Enter}7{Enter}8{Enter}9{Enter}10{Enter}11');
    const eight = 8 * 18 + 12;
    expect(area.getBoundingClientRect().height).toBeLessThanOrEqual(eight + 0.5);
  });
});

describe('SearchField', () => {
  function Host({ onSearch, onEscape }: { onSearch?: (v: string) => void; onEscape?: () => void }) {
    const [v, setV] = useState('');
    return (
      // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- the test's surface listens for Esc
      <div
        onKeyDown={(event) => {
          if (event.key === 'Escape') onEscape?.();
        }}
      >
        <SearchField
          label="Find in document"
          placeholder="Find in document"
          value={v}
          onValueChange={setV}
          onSearch={onSearch}
          count={v ? '3 / 12' : undefined}
        />
      </div>
    );
  }

  it('is a search box with a count, a clear button that returns focus, and the Esc ladder', async () => {
    const onEscape = vi.fn();
    render(<Host onEscape={onEscape} />);
    const box = screen.getByRole('searchbox', { name: 'Find in document' });
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();
    await userEvent.click(box);
    await userEvent.keyboard('total');
    expect(screen.getByText('3 / 12')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(box).toHaveValue('');
    expect(document.activeElement).toBe(box);
    await userEvent.keyboard('x');
    await userEvent.keyboard('{Escape}');
    expect(box).toHaveValue('');
    expect(onEscape).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('searches 150 ms after typing pauses', async () => {
    // Each search's time and each key's, as the page saw them: a loaded runner can hand the
    // typing back after the pause has run, or deliver the second key a pause after the first.
    const searched: number[] = [];
    const onSearch = vi.fn(() => searched.push(performance.now()));
    render(<Host onSearch={onSearch} />);
    const box = screen.getByRole('searchbox');
    const typed: number[] = [];
    box.addEventListener('input', (event) => typed.push(event.timeStamp));
    await userEvent.click(box);
    await userEvent.keyboard('ab');
    await act(() => new Promise((resolve) => setTimeout(resolve, 200)));
    await waitFor(() => expect(onSearch).toHaveBeenLastCalledWith('ab'));
    // One search per pause: after the last key, and after any gap between keys that reached it.
    const gaps = typed.slice(1).filter((t, k) => t - (typed[k] ?? t) >= 150).length;
    expect(onSearch).toHaveBeenCalledTimes(1 + gaps);
    // Never while typing: the search for "ab" came a full pause after its key.
    expect((searched.at(-1) ?? 0) - (typed.at(-1) ?? 0)).toBeGreaterThanOrEqual(149);
  });

  it('says "No results" without marking the field as an error', () => {
    render(
      <SearchField label="Find" value="zz" onValueChange={() => undefined} noResults count="0" />,
    );
    expect(screen.getByText('No results')).toBeVisible();
    expect(screen.getByRole('searchbox')).not.toHaveAttribute('aria-invalid');
  });
});

describe('NumberField', () => {
  afterEach(() => {
    setLocale('en');
  });

  function Host({ unit }: { unit?: string }) {
    const [v, setV] = useState<number | null>(3);
    return (
      <>
        <NumberField
          label="From page"
          value={v}
          onValueChange={setV}
          min={1}
          max={12}
          unit={unit}
        />
        <button type="button">after</button>
        <output data-testid="value">{String(v)}</output>
      </>
    );
  }

  it('parses both separators in Turkish and English', () => {
    expect(parseLocaleNumber('1,5', 'tr')).toBe(1.5);
    expect(parseLocaleNumber('1.5', 'tr')).toBe(1.5);
    expect(parseLocaleNumber('1.500,25', 'tr')).toBe(1500.25);
    expect(parseLocaleNumber('1.5', 'en')).toBe(1.5);
    expect(parseLocaleNumber('1,500', 'en')).toBe(1500);
    expect(parseLocaleNumber('', 'en')).toBeNull();
  });

  it('steps with the keys and the steppers, which disable at a bound', async () => {
    render(<Host unit="pt" />);
    const input = screen.getByRole('textbox', { name: 'From page' });
    expect(input.parentElement?.getBoundingClientRect().height).toBe(32);
    await userEvent.click(input);
    await userEvent.keyboard('{ArrowUp}');
    expect(screen.getByTestId('value').textContent).toBe('4');
    await userEvent.keyboard('{End}');
    expect(screen.getByTestId('value').textContent).toBe('12');
    expect(screen.getByRole('button', { name: 'Increase' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Decrease' }));
    expect(screen.getByTestId('value').textContent).toBe('11');
    await userEvent.keyboard('{Home}');
    expect(screen.getByTestId('value').textContent).toBe('1');
    expect(screen.getByRole('button', { name: 'Decrease' })).toBeDisabled();
  });

  it('clamps an out-of-range entry on blur and says so', async () => {
    render(<Host />);
    const input = screen.getByRole('textbox', { name: 'From page' });
    await userEvent.tripleClick(input);
    await userEvent.keyboard('40');
    await userEvent.click(screen.getByRole('button', { name: 'after' }));
    expect(screen.getByTestId('value').textContent).toBe('12');
    expect(screen.getByText('Enter a number from 1 to 12.')).toBeVisible();
    expect(screen.getByText('Set to 12.')).toHaveAttribute('role', 'status');
    expect(input).toHaveAccessibleDescription('Enter a number from 1 to 12.');
  });

  it('Esc restores the value it had at focus', async () => {
    render(<Host />);
    const input = screen.getByRole('textbox', { name: 'From page' });
    await userEvent.click(input);
    await userEvent.keyboard('{ArrowUp}{ArrowUp}');
    expect(screen.getByTestId('value').textContent).toBe('5');
    await userEvent.keyboard('{Escape}');
    expect(screen.getByTestId('value').textContent).toBe('3');
  });

  it('writes Turkish numerals', () => {
    setLocale('tr');
    render(
      <NumberField
        label="Kalınlık"
        value={1.5}
        onValueChange={() => undefined}
        step={0.5}
        format={{ maximumFractionDigits: 2 }}
      />,
    );
    expect(screen.getByRole('textbox', { name: 'Kalınlık' })).toHaveValue('1,5');
  });

  it('puts 44 px − and + beside the well on a coarse pointer', async () => {
    await coarse(() => {
      render(<Host />);
      const minus = screen.getByRole('button', { name: 'Decrease' });
      const plus = screen.getByRole('button', { name: 'Increase' });
      const input = screen.getByRole('textbox', { name: 'From page' });
      expect(minus.getBoundingClientRect().height).toBe(44);
      expect(minus.getBoundingClientRect().right).toBeLessThanOrEqual(
        input.getBoundingClientRect().left,
      );
      expect(plus.getBoundingClientRect().left).toBeGreaterThanOrEqual(
        input.getBoundingClientRect().right,
      );
    });
  });
});
