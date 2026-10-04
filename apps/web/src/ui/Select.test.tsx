import '../styles/tokens.css';
import '../styles/global.css';

import { Menu } from '@base-ui/react/menu';
import { render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { cdp, userEvent } from 'vitest/browser';

import menuStyles from './Menu.module.css';
import { MenuButton } from './MenuButton';
import { Select, type SelectOption } from './Select';

/** Chrome DevTools Protocol, typed loosely (the provider's session type is not exported). */
function devtools(method: string, params: object): Promise<unknown> {
  return (cdp() as unknown as { send(m: string, p: object): Promise<unknown> }).send(
    method,
    params,
  );
}

/** Past the popup's scale-in (120 ms). */
const settle = () => new Promise((resolve) => setTimeout(resolve, 250));

const SIZES: readonly SelectOption<string>[] = [
  { value: 'a4', label: 'A4' },
  { value: 'a5', label: 'A5' },
  { value: 'letter', label: 'Letter' },
  { value: 'legal', label: 'Legal' },
];

function Host({
  initial = 'a4',
  options = SIZES,
}: {
  initial?: string | null;
  options?: readonly SelectOption<string>[];
}) {
  const [value, setValue] = useState<string | null>(initial);
  return (
    <>
      <button type="button">before</button>
      <Select label="Page size" value={value} onValueChange={setValue} options={options} />
      <output data-testid="value">{String(value)}</output>
    </>
  );
}

describe('Select', () => {
  it('is a 32 px combobox that shows the chosen label', () => {
    render(<Host />);
    const trigger = screen.getByRole('combobox', { name: 'Page size' });
    expect(trigger).toHaveTextContent('A4');
    expect(trigger.getBoundingClientRect().height).toBe(32);
    expect(getComputedStyle(trigger).borderTopLeftRadius).toBe('10px');
  });

  it('shows the placeholder while nothing is chosen', () => {
    render(<Host initial={null} />);
    expect(screen.getByRole('combobox', { name: 'Page size' })).toHaveTextContent('Choose…');
  });

  it('opens the menu recipe, chooses with a press and returns focus to the trigger', async () => {
    render(<Host />);
    const trigger = screen.getByRole('combobox', { name: 'Page size' });
    await userEvent.click(trigger);
    const listbox = await screen.findByRole('listbox');
    const popup = listbox.closest(`.${menuStyles.popup?.split(' ')[0]}`) as HTMLElement;
    expect(popup).not.toBeNull();
    await settle();
    expect(getComputedStyle(popup).borderTopLeftRadius).toBe('16px');
    const letter = screen.getByRole('option', { name: 'Letter' });
    expect(letter.getBoundingClientRect().height).toBe(32);
    await userEvent.click(letter);
    expect(screen.getByTestId('value').textContent).toBe('letter');
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it('opens with the keyboard, finds by typing and closes with Esc', async () => {
    render(<Host />);
    const trigger = screen.getByRole('combobox', { name: 'Page size' });
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    await screen.findByRole('listbox');
    await userEvent.keyboard('le');
    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'Letter' })).toHaveAttribute('data-highlighted'),
    );
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    expect(screen.getByTestId('value').textContent).toBe('a4');
    expect(document.activeElement).toBe(trigger);
  });

  it('is disabled with the reason "No options" when the list is empty', () => {
    render(<Host options={[]} />);
    const trigger = screen.getByRole('combobox', { name: 'Page size' });
    expect(trigger).toHaveAttribute('data-disabled');
    expect(trigger).toHaveAccessibleDescription('No options');
  });

  it('is 44 px with 44 px rows on a coarse pointer', async () => {
    await devtools('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    try {
      render(<Host />);
      const trigger = screen.getByRole('combobox', { name: 'Page size' });
      expect(trigger.getBoundingClientRect().height).toBe(44);
      await userEvent.click(trigger);
      const a5 = await screen.findByRole('option', { name: 'A5' });
      await settle();
      expect(a5.getBoundingClientRect().height).toBe(44);
    } finally {
      await devtools('Emulation.setTouchEmulationEnabled', { enabled: false });
    }
  });
});

describe('MenuButton', () => {
  it('opens its menu and says so (aria-haspopup, aria-expanded)', async () => {
    render(
      <Menu.Root>
        <MenuButton>Shapes</MenuButton>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup className={menuStyles.popup}>
              <Menu.Item className={menuStyles.item}>
                <span className={menuStyles.label}>Rectangle</span>
              </Menu.Item>
              <Menu.Item className={menuStyles.item}>
                <span className={menuStyles.label}>Ellipse</span>
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    );
    const button = screen.getByRole('button', { name: 'Shapes' });
    expect(button).toHaveAttribute('aria-haspopup', 'menu');
    expect(button.getBoundingClientRect().height).toBe(32);
    await userEvent.click(button);
    await screen.findByRole('menu');
    await settle();
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(button).toHaveAttribute('data-popup-open');
    const row = screen.getByRole('menuitem', { name: 'Rectangle' });
    expect(row.getBoundingClientRect().height).toBe(32);
  });
});
