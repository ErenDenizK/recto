import '../styles/tokens.css';
import '../styles/reset.css';
import '../styles/global.css';

import { render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';

import { RadioGroup } from './RadioGroup';
import { stillStyles } from './test-states';

stillStyles();

type Size = 'same' | 'smaller' | 'smallest';

function SizeChoice() {
  const [value, setValue] = useState<Size>('same');
  return (
    <>
      <RadioGroup<Size>
        label="Size"
        value={value}
        onValueChange={setValue}
        options={[
          { value: 'same', label: 'Same as original' },
          { value: 'smaller', label: 'Smaller', detail: 'about 1.1 MB' },
          {
            value: 'smallest',
            label: 'Smallest',
            description: 'Needs the text recognized first',
            disabled: true,
          },
        ]}
      />
      <output data-testid="value">{value}</output>
    </>
  );
}

describe('RadioGroup (09-primitives §9)', () => {
  it('is a named radio group of 16 px circles in 32 px rows', () => {
    render(<SizeChoice />);
    expect(screen.getByRole('radiogroup', { name: 'Size' })).toBeInTheDocument();
    const same = screen.getByRole('radio', { name: 'Same as original' });
    expect(same).toHaveAttribute('aria-checked', 'true');
    expect(same.getBoundingClientRect().width).toBe(16);
    expect(same.closest('label')?.getBoundingClientRect().height).toBe(32);
    expect(getComputedStyle(same).backgroundColor).toBe('rgb(232, 233, 236)');
    expect(screen.getByText('about 1.1 MB')).toBeVisible();
    // The estimate is part of the option's name (07-sheets §4.8).
    expect(screen.getByRole('radio', { name: 'Smaller, about 1.1 MB' })).toBeInTheDocument();
  });

  it('is one Tab stop; the arrows move and choose, skipping a disabled option', async () => {
    render(<SizeChoice />);
    screen.getByRole('radio', { name: 'Same as original' }).focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByTestId('value').textContent).toBe('smaller');
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByTestId('value').textContent).toBe('same');
  });

  it('keeps a disabled option’s reason as its description', () => {
    render(<SizeChoice />);
    const smallest = screen.getByRole('radio', { name: 'Smallest' });
    expect(smallest).toHaveAttribute('aria-disabled', 'true');
    expect(smallest).toHaveAccessibleDescription('Needs the text recognized first');
  });

  it('chooses by its label', async () => {
    render(<SizeChoice />);
    await userEvent.click(screen.getByText('Smaller'));
    expect(screen.getByTestId('value').textContent).toBe('smaller');
  });
});
