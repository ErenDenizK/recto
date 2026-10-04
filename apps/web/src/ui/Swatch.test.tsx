import '../styles/tokens.css';

import { render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';

import { NO_FILL, Swatch } from './Swatch';
import { SwatchGroup } from './SwatchGroup';

function Row({ initial }: { initial: string | null }) {
  const [value, setValue] = useState<string | null>(initial);
  return (
    <>
      <SwatchGroup label="Ink colour" value={value} onValueChange={setValue}>
        <Swatch value={NO_FILL} tooltip={false} />
        <Swatch value="#1a1a1a" name="Black" tooltip={false} />
        <Swatch value="#1760EE" tooltip={false} />
        <Swatch value="#DB1C22" tooltip={false} />
      </SwatchGroup>
      <output data-testid="value">{String(value)}</output>
    </>
  );
}

describe('Swatch', () => {
  it('is a radio named by its colour inside a radio group, matched in any case', () => {
    render(<Row initial="#1A1A1A" />);
    const group = screen.getByRole('radiogroup', { name: 'Ink colour' });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Black' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Blue' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('radio', { name: 'No fill' })).toBeInTheDocument();
  });

  it('is one Tab stop; the arrows move and choose', async () => {
    render(<Row initial="#1760EE" />);
    screen.getByRole('radio', { name: 'Blue' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByTestId('value').textContent).toBe('#DB1C22');
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(screen.getByTestId('value').textContent).toBe('#1A1A1A');
  });

  it('shrinks the chosen dot inside a ring of its colour with a gap, in a 32 px target', () => {
    render(<Row initial="#1760EE" />);
    const blue = screen.getByRole('radio', { name: 'Blue' });
    const red = screen.getByRole('radio', { name: 'Red' });
    expect(blue.getBoundingClientRect().height).toBe(32);
    const [ring, dot] = blue.children as unknown as HTMLElement[];
    expect(dot!.getBoundingClientRect().width).toBe(14);
    expect(ring!.getBoundingClientRect().width).toBe(22);
    expect(getComputedStyle(ring!).borderTopColor).toBe('rgb(23, 96, 238)');
    expect(red.children[1]!.getBoundingClientRect().width).toBe(18);
  });

  it('rings black on dark glass with the contrast ring, not red', () => {
    render(<Row initial={null} />);
    expect(screen.getByRole('radio', { name: 'Black' })).toHaveAttribute('data-ring-dark');
    expect(screen.getByRole('radio', { name: 'Red' })).not.toHaveAttribute('data-ring-dark');
  });
});
