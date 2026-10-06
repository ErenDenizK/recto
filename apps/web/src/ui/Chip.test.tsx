import '../styles/tokens.css';
import '../styles/reset.css';
import '../styles/global.css';

import { render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import { Chip, ChipGroup } from './Chip';
import { canHover, forceState, stillStyles } from './test-states';

stillStyles();

type Filter = 'all' | 'comments' | 'marks' | 'fields';

function Filters({ disabled }: { readonly disabled?: Filter }) {
  const [value, setValue] = useState<Filter>('all');
  return (
    <>
      <ChipGroup<Filter>
        label="Show"
        value={value}
        onChange={setValue}
        chips={[
          { value: 'all', label: 'All', count: '5', name: 'All, 5 items' },
          { value: 'comments', label: 'Comments', count: '2', name: 'Comments, 2 items' },
          { value: 'marks', label: 'Marks', count: '3', disabled: disabled === 'marks' },
          { value: 'fields', label: 'Fields' },
        ]}
      />
      <output data-testid="value">{value}</output>
    </>
  );
}

describe('ChipGroup (09-primitives §5)', () => {
  it('is a radio group named by its label; each chip names its count', () => {
    render(<Filters />);
    expect(screen.getByRole('radiogroup', { name: 'Show' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'All, 5 items' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('radio', { name: 'Comments, 2 items' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('is one Tab stop; arrows, Home and End move and choose, skipping a disabled chip', async () => {
    render(<Filters disabled="marks" />);
    const all = screen.getByRole('radio', { name: 'All, 5 items' });
    expect(all).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: 'Fields' })).toHaveAttribute('tabindex', '-1');
    all.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByTestId('value').textContent).toBe('comments');
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Comments, 2 items' }));
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByTestId('value').textContent).toBe('fields');
    await userEvent.keyboard('{Home}');
    expect(screen.getByTestId('value').textContent).toBe('all');
    await userEvent.keyboard('{End}');
    expect(screen.getByTestId('value').textContent).toBe('fields');
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByTestId('value').textContent).toBe('all');
  });

  it('is a 28 px pill; selected adds the accent wash, a ring and a check (A-19)', async () => {
    render(<Filters />);
    const all = screen.getByRole('radio', { name: 'All, 5 items' });
    const comments = screen.getByRole('radio', { name: 'Comments, 2 items' });
    expect(all.getBoundingClientRect().height).toBe(28);
    expect(getComputedStyle(all).borderTopLeftRadius).toBe('999px');
    expect(getComputedStyle(all).backgroundColor).toBe('rgba(200, 251, 61, 0.12)');
    expect(getComputedStyle(all).boxShadow).toContain('rgba(200, 251, 61, 0.5)');
    expect(all.querySelector('svg')).not.toBeNull();
    expect(comments.querySelector('svg')).toBeNull();
    expect(getComputedStyle(comments).backgroundColor).toBe('rgba(255, 255, 255, 0.08)');
    if (canHover()) {
      const release = await forceState(comments, ['hover']);
      expect(getComputedStyle(comments).backgroundColor).toBe('rgba(255, 255, 255, 0.12)');
      await release();
    }
  });

  it('rests without a fill on the floating glass', () => {
    render(
      <div className="glass">
        <Filters />
      </div>,
    );
    expect(
      getComputedStyle(screen.getByRole('radio', { name: 'Comments, 2 items' })).backgroundColor,
    ).toBe('rgba(0, 0, 0, 0)');
  });
});

describe('Chip (09-primitives §5)', () => {
  it('toggles with aria-pressed, and a removable chip goes with Delete or its ✕', async () => {
    const onClick = vi.fn();
    const onRemove = vi.fn();
    render(<Chip label="Signature 1" pressed={false} onClick={onClick} onRemove={onRemove} />);
    const chip = screen.getByRole('button', { name: 'Signature 1' });
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(chip);
    expect(onClick).toHaveBeenCalledTimes(1);
    chip.focus();
    await userEvent.keyboard('{Delete}');
    expect(onRemove).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Remove: Signature 1' }));
    expect(onRemove).toHaveBeenCalledTimes(2);
  });

  it('does nothing while disabled, in the disabled colour', () => {
    const onClick = vi.fn();
    render(<Chip label="Marks" disabled onClick={onClick} />);
    const chip = screen.getByRole('button', { name: 'Marks' });
    expect(chip).toHaveAttribute('aria-disabled', 'true');
    chip.click();
    expect(onClick).not.toHaveBeenCalled();
    expect(getComputedStyle(chip).color).toBe('rgb(85, 88, 95)');
  });
});
