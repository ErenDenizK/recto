import '../styles/tokens.css';
import '../styles/reset.css';
import '../styles/global.css';

import { act, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import { Switch, type SwitchProps } from './Switch';
import { forceState, stillStyles } from './test-states';

stillStyles();

function Setting(props: Partial<SwitchProps> & { readonly onChange?: (v: boolean) => void }) {
  const [checked, setChecked] = useState(props.checked ?? false);
  return (
    <form
      data-testid="form"
      onSubmit={(event) => {
        event.preventDefault();
        props.onChange?.(!checked);
      }}
    >
      <Switch
        label="Reduce motion"
        {...props}
        checked={checked}
        onCheckedChange={(next) => {
          setChecked(next);
          props.onChange?.(next);
        }}
      />
    </form>
  );
}

const thumbX = (track: Element) =>
  new DOMMatrix(getComputedStyle(track.firstElementChild as Element).transform).m41;

describe('Switch (09-primitives §7)', () => {
  it('is a switch named by its label, in a 32 px row; a press on the label toggles it', async () => {
    render(<Setting />);
    const control = screen.getByRole('switch', { name: 'Reduce motion' });
    expect(control).toHaveAttribute('aria-checked', 'false');
    const row = control.closest('label');
    expect(row?.getBoundingClientRect().height).toBe(32);
    expect(control.getBoundingClientRect().width).toBe(36);
    expect(control.getBoundingClientRect().height).toBe(20);
    await userEvent.click(screen.getByText('Reduce motion'));
    expect(control).toHaveAttribute('aria-checked', 'true');
  });

  it('is off as a bordered track, on as the neutral on-fill with the thumb at the end', async () => {
    render(<Setting />);
    const control = screen.getByRole('switch', { name: 'Reduce motion' });
    expect(getComputedStyle(control).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    expect(getComputedStyle(control).boxShadow).toContain('rgba(255, 255, 255, 0.48)');
    expect(thumbX(control)).toBe(0);
    const release = await forceState(control, ['hover']);
    expect(getComputedStyle(control).boxShadow).toContain('rgba(255, 255, 255, 0.6)');
    await release();
    await userEvent.click(control);
    expect(getComputedStyle(control).backgroundColor).toBe('rgb(230, 231, 234)');
    expect(thumbX(control)).toBe(16);
    const press = await forceState(control, ['active']);
    expect((control.firstElementChild as HTMLElement).getBoundingClientRect().width).toBe(20);
    await press();
  });

  it('toggles with Space, not with Enter (the form keeps Enter)', async () => {
    const onChange = vi.fn();
    render(<Setting onChange={onChange} />);
    const control = screen.getByRole('switch', { name: 'Reduce motion' });
    control.focus();
    await userEvent.keyboard('{Enter}');
    expect(control).toHaveAttribute('aria-checked', 'false');
    await userEvent.keyboard(' ');
    expect(control).toHaveAttribute('aria-checked', 'true');
  });

  it('a drag of the thumb past half toggles on release, and the click after it is swallowed', () => {
    const onChange = vi.fn();
    render(<Setting onChange={onChange} />);
    const control = screen.getByRole('switch', { name: 'Reduce motion' });
    const box = control.getBoundingClientRect();
    const at = (type: string, x: number) =>
      control.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          button: 0,
          pointerId: 1,
          pointerType: 'touch',
          clientX: x,
          clientY: box.top + 10,
        }),
      );
    act(() => {
      at('pointerdown', box.left + 10);
      at('pointermove', box.left + 16);
      at('pointermove', box.left + 22);
      at('pointerup', box.left + 22);
      control.click();
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(control).toHaveAttribute('aria-checked', 'true');
    // A short drag back (under half the travel) leaves it on.
    act(() => {
      at('pointerdown', box.right - 10);
      at('pointermove', box.right - 16);
      at('pointerup', box.right - 16);
      control.click();
    });
    expect(control).toHaveAttribute('aria-checked', 'true');
  });

  it('says when the system sets it, and is disabled then', () => {
    render(<Setting checked system />);
    const control = screen.getByRole('switch', { name: 'Reduce motion' });
    expect(control).toHaveAttribute('aria-checked', 'true');
    expect(control).toHaveAttribute('data-disabled');
    expect(control).toHaveAccessibleDescription('On, set by your system');
  });

  it('refuses input while busy and shows the activity glyph in the thumb', async () => {
    render(<Setting busy />);
    const control = screen.getByRole('switch', { name: 'Reduce motion' });
    expect(control).toHaveAttribute('aria-busy', 'true');
    expect(control.querySelector('[data-activity]')).not.toBeNull();
    await userEvent.click(control);
    expect(control).toHaveAttribute('aria-checked', 'false');
  });
});
