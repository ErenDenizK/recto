import '../styles/tokens.css';
import '../styles/reset.css';
import '../styles/global.css';

import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import { Button } from './Button';
import { Surface } from './Surface';
import { canHover, forceState, stillStyles } from './test-states';

stillStyles();

afterEach(() => {
  vi.useRealTimers();
});

const bg = (el: Element) => getComputedStyle(el).backgroundColor;

describe('Button (09-primitives §3)', () => {
  it('is a 32 px pill with a 16 px glyph on a fine pointer', () => {
    render(
      <Button icon={<svg data-testid="glyph" />} variant="standard">
        Save copy
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Save copy' });
    expect(button.getBoundingClientRect().height).toBe(32);
    expect(getComputedStyle(button).borderTopLeftRadius).toBe('999px');
    expect(screen.getByTestId('glyph').getBoundingClientRect().width).toBe(16);
  });

  it('comes in S, M and L: 24, 32 and 40 px, footnote, body and callout (system audit §3.3)', () => {
    render(
      <>
        <Button size="sm" icon={<svg data-testid="s-glyph" />}>
          Small
        </Button>
        <Button>Medium</Button>
        <Button size="lg" icon={<svg data-testid="l-glyph" />}>
          Large
        </Button>
      </>,
    );
    const root = getComputedStyle(document.documentElement);
    const sizes = ['Small', 'Medium', 'Large'].map((name) => {
      const button = screen.getByRole('button', { name });
      return [button.getBoundingClientRect().height, getComputedStyle(button).fontSize];
    });
    expect(sizes).toEqual([
      [24, root.getPropertyValue('--type-footnote').trim()],
      [32, root.getPropertyValue('--type-body').trim()],
      [40, root.getPropertyValue('--type-callout').trim()],
    ]);
    expect(screen.getByTestId('s-glyph').getBoundingClientRect().width).toBe(16);
    expect(screen.getByTestId('l-glyph').getBoundingClientRect().width).toBe(20);
    for (const name of ['Small', 'Large']) {
      expect(getComputedStyle(screen.getByRole('button', { name })).borderTopLeftRadius).toBe(
        '999px',
      );
    }
  });

  it('draws every state of each variant from the control tokens (Q-14)', async () => {
    render(
      <>
        <Button variant="prominent">Prominent</Button>
        <Button variant="standard">Standard</Button>
        <Button variant="quiet">Quiet</Button>
        <Button variant="danger">Delete page</Button>
      </>,
    );
    const prominent = screen.getByRole('button', { name: 'Prominent' });
    const standard = screen.getByRole('button', { name: 'Standard' });
    const quiet = screen.getByRole('button', { name: 'Quiet' });
    const danger = screen.getByRole('button', { name: 'Delete page' });

    // Rest.
    expect(bg(prominent)).toBe('rgb(200, 251, 61)');
    expect(bg(standard)).toBe('rgba(255, 255, 255, 0.08)');
    expect(bg(quiet)).toBe('rgba(0, 0, 0, 0)');
    expect(getComputedStyle(danger).color).toBe('rgb(253, 114, 115)');

    // Hover: one step (where the page can hover).
    for (const [el, want] of [
      // --accent-hover, one step lighter than the lime rest.
      [prominent, /^rgb\(221, 255, 130\)$/],
      [standard, /^rgba\(255, 255, 255, 0\.12\)$/],
      // 0.045 is stored in 8 bits: 0.043.
      [quiet, /^rgba\(255, 255, 255, 0\.04\d*\)$/],
    ] as const) {
      if (!canHover()) break;
      const release = await forceState(el, ['hover']);
      expect(bg(el)).toMatch(want);
      await release();
    }
    // Danger hover keeps its fill and rings the edge.
    if (canHover()) {
      const off = await forceState(danger, ['hover']);
      expect(bg(danger)).toBe('rgba(255, 255, 255, 0.08)');
      expect(getComputedStyle(danger).boxShadow).toContain('rgb(253, 114, 115)');
      await off();
    }

    // Pressed: the pressed fill and the press scale.
    let release = await forceState(standard, ['active']);
    expect(bg(standard)).toBe('rgba(255, 255, 255, 0.16)');
    expect(getComputedStyle(standard).transform).not.toBe('none');
    await release();

    // Focus: the two-band ring, outset.
    release = await forceState(standard, ['focus', 'focus-visible']);
    expect(getComputedStyle(standard).outlineStyle).toBe('solid');
    expect(getComputedStyle(standard).outlineColor).toBe('rgb(200, 251, 61)');
    expect(getComputedStyle(standard).boxShadow).toContain('rgb(8, 9, 12)');
    await release();
  });

  it('stays focusable when disabled and describes why', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled reason="Choose at least one page" onClick={onClick}>
        Apply
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Apply' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAccessibleDescription('Choose at least one page');
    button.focus();
    expect(document.activeElement).toBe(button);
    await userEvent.click(button, { force: true });
    expect(onClick).not.toHaveBeenCalled();
    expect(getComputedStyle(button).color).toBe('rgb(85, 88, 95)');
  });

  it('falls back to "Not available now" when disabled with no reason', () => {
    render(<Button disabled>Apply</Button>);
    expect(screen.getByRole('button', { name: 'Apply' })).toHaveAccessibleDescription(
      'Not available now',
    );
  });

  it('looks disabled when blocked, and a press asks to unlock instead of acting', async () => {
    const onClick = vi.fn();
    const onPress = vi.fn();
    render(
      <Button blocked={{ reason: 'Locked · Unlock', onPress }} onClick={onClick}>
        Delete page
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Delete page' });
    expect(button).toHaveAttribute('data-blocked');
    expect(button).toHaveAccessibleDescription('Locked · Unlock');
    await userEvent.click(button);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('refuses clicks while busy, freezes its width, and shows the activity glyph after 400 ms', () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <Button variant="prominent" onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Save' });
    const width = button.getBoundingClientRect().width;
    vi.useFakeTimers();
    rerender(
      <Button variant="prominent" busy busyLabel="Saving a long copy…" onClick={onClick}>
        Save
      </Button>,
    );
    expect(button).toHaveAttribute('aria-busy', 'true');
    button.click();
    expect(onClick).not.toHaveBeenCalled();
    // Nothing changes on screen for a job under 400 ms.
    expect(button.querySelector('[data-activity]')).toBeNull();
    expect(button.textContent).toBe('Save');
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(button.querySelector('[data-activity]')).not.toBeNull();
    expect(button.textContent).toBe('Saving a long copy…');
    expect(Number.parseFloat(button.style.minWidth)).toBeCloseTo(width, 2);
    vi.useRealTimers();
    rerender(
      <Button variant="prominent" onClick={onClick}>
        Save
      </Button>,
    );
    expect(button.style.minWidth).toBe('');
    expect(button).not.toHaveAttribute('aria-busy');
  });

  it('never takes initial focus as a danger button', () => {
    render(
      <>
        {/* eslint-disable-next-line jsx-a11y/no-autofocus -- the test asks for it */}
        <Button variant="danger" autoFocus>
          Delete
        </Button>
      </>,
    );
    expect(document.activeElement).not.toBe(screen.getByRole('button', { name: 'Delete' }));
  });

  it('renders quiet on the floating glass, filled on a menu', () => {
    render(
      <>
        <Surface tier="bar" sigma={8} data-testid="bar">
          <Button>On the bar</Button>
        </Surface>
        <Surface tier="menu" sigma={12}>
          <Button>In a menu</Button>
        </Surface>
      </>,
    );
    expect(bg(screen.getByRole('button', { name: 'On the bar' }))).toBe('rgba(0, 0, 0, 0)');
    expect(bg(screen.getByRole('button', { name: 'In a menu' }))).toBe('rgba(255, 255, 255, 0.08)');
  });
});
