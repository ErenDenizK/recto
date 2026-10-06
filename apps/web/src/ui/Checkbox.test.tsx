import '../styles/tokens.css';
import '../styles/reset.css';
import '../styles/global.css';

import { render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';

import { Checkbox, CheckboxGroup } from './Checkbox';
import { canHover, forceState, stillStyles } from './test-states';

stillStyles();

function One({ error }: { readonly error?: string }) {
  const [checked, setChecked] = useState(false);
  return (
    <Checkbox
      label="Remove metadata"
      checked={checked}
      onCheckedChange={setChecked}
      error={error}
    />
  );
}

const STEPS = ['rotate', 'compress', 'ocr'];

function Steps() {
  const [value, setValue] = useState<string[]>(['rotate']);
  return (
    <CheckboxGroup label="Steps" value={value} onValueChange={setValue} allValues={STEPS}>
      <Checkbox label="All steps" parent />
      <Checkbox label="Rotate" value="rotate" />
      <Checkbox label="Compress" value="compress" />
      <Checkbox label="Recognize text" value="ocr" />
    </CheckboxGroup>
  );
}

describe('Checkbox (09-primitives §8)', () => {
  it('is a 16 px box in a 32 px row; the label toggles it, and so does Space', async () => {
    render(<One />);
    const box = screen.getByRole('checkbox', { name: 'Remove metadata' });
    expect(box.getBoundingClientRect().width).toBe(16);
    expect(box.closest('label')?.getBoundingClientRect().height).toBe(32);
    expect(box).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(screen.getByText('Remove metadata'));
    expect(box).toHaveAttribute('aria-checked', 'true');
    box.focus();
    await userEvent.keyboard(' ');
    expect(box).toHaveAttribute('aria-checked', 'false');
  });

  it('is a bordered box off, the neutral on-fill on, the border one step up on hover', async () => {
    render(<One />);
    const box = screen.getByRole('checkbox', { name: 'Remove metadata' });
    expect(getComputedStyle(box).boxShadow).toContain('rgba(255, 255, 255, 0.48)');
    if (canHover()) {
      const release = await forceState(box.closest('label') as Element, ['hover']);
      expect(getComputedStyle(box).boxShadow).toContain('rgba(255, 255, 255, 0.6)');
      await release();
    }
    await userEvent.click(box);
    expect(getComputedStyle(box).backgroundColor).toBe('rgb(232, 233, 236)');
  });

  it('shows an error with a danger border and a message it is described by', () => {
    render(<One error="Choose at least one" />);
    const box = screen.getByRole('checkbox', { name: 'Remove metadata' });
    expect(box).toHaveAttribute('aria-invalid', 'true');
    expect(box).toHaveAccessibleDescription('Choose at least one');
    expect(getComputedStyle(box).boxShadow).toContain('rgb(253, 114, 115)');
  });

  it('a parent box is mixed while some children are checked, and checks them all', async () => {
    render(<Steps />);
    const parent = screen.getByRole('checkbox', { name: 'All steps' });
    expect(parent).toHaveAttribute('aria-checked', 'mixed');
    await userEvent.click(parent);
    for (const name of ['Rotate', 'Compress', 'Recognize text']) {
      expect(screen.getByRole('checkbox', { name })).toHaveAttribute('aria-checked', 'true');
    }
    expect(parent).toHaveAttribute('aria-checked', 'true');
  });
});
