import '../styles/tokens.css';
import '../styles/reset.css';
import '../styles/global.css';

import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import { parseShortcut } from '../commands/shortcuts';
import { IconButton, LONG_PRESS_MS } from './IconButton';
import { canHover, forceState, stillStyles } from './test-states';

stillStyles();

const icon = <svg data-testid="icon" viewBox="0 0 20 20" />;
const bg = (el: Element) => getComputedStyle(el).backgroundColor;

describe('IconButton (09-primitives §4)', () => {
  it('is a 32 px circle with a 20 px icon on a bar, a 28 px circle with a 16 px icon in a row', () => {
    render(
      <>
        <IconButton label="Undo" icon={icon} />
        <IconButton label="Close" icon={<svg data-testid="row-icon" />} size="row" />
      </>,
    );
    const bar = screen.getByRole('button', { name: 'Undo' });
    const row = screen.getByRole('button', { name: 'Close' });
    expect(bar.getBoundingClientRect().height).toBe(32);
    expect(bar.getBoundingClientRect().width).toBe(32);
    expect(getComputedStyle(bar).borderTopLeftRadius).toBe('999px');
    expect(screen.getByTestId('icon').getBoundingClientRect().width).toBe(20);
    expect(row.getBoundingClientRect().height).toBe(28);
    expect(screen.getByTestId('row-icon').getBoundingClientRect().width).toBe(16);
  });

  it('shows hover, pressed, focus, toggled, armed and disabled from the tokens (Q-14)', async () => {
    render(
      <>
        <IconButton label="Undo" icon={icon} />
        <IconButton label="Heat map" icon={icon} aria-pressed />
        <IconButton label="Pen" icon={icon} aria-pressed data-tool="ink" />
        <IconButton label="Redo" icon={icon} aria-disabled />
      </>,
    );
    const undo = screen.getByRole('button', { name: 'Undo' });
    expect(bg(undo)).toBe('rgba(0, 0, 0, 0)');
    if (canHover()) {
      const off = await forceState(undo, ['hover']);
      expect(bg(undo)).toMatch(/^rgba\(255, 255, 255, 0\.04\d*\)$/);
      expect(getComputedStyle(undo).color).toBe('rgb(230, 231, 234)');
      await off();
    }
    let release = await forceState(undo, ['active']);
    expect(bg(undo)).toMatch(/^rgba\(255, 255, 255, 0\.07\d*\)$/);
    expect(getComputedStyle(undo).transform).not.toBe('none');
    await release();
    release = await forceState(undo, ['focus', 'focus-visible']);
    expect(getComputedStyle(undo).outlineColor).toBe('rgb(200, 251, 61)');
    await release();

    const heatMap = screen.getByRole('button', { name: 'Heat map' });
    if (!heatMap.matches(':hover')) expect(bg(heatMap)).toBe('rgba(124, 140, 255, 0.16)');
    // The test browser's pointer may rest over a button from an earlier file; hover is right then.
    const pen = screen.getByRole('button', { name: 'Pen' });
    expect(bg(pen)).toBe(pen.matches(':hover') ? 'rgb(143, 157, 255)' : 'rgb(124, 140, 255)');
    const redo = screen.getByRole('button', { name: 'Redo' });
    expect(getComputedStyle(redo).color).toBe('rgb(74, 78, 85)');
    release = await forceState(redo, ['hover']);
    expect(bg(redo)).toBe('rgba(0, 0, 0, 0)');
    await release();
  });

  it('names itself and its shortcut', () => {
    render(<IconButton label="Undo" icon={icon} shortcut={parseShortcut('Mod+Z')} />);
    const undo = screen.getByRole('button', { name: 'Undo' });
    expect(undo.getAttribute('aria-keyshortcuts')).toMatch(/\+Z$/i);
  });

  it('on touch, a long press calls onLongPress and swallows the click; a tap clicks', async () => {
    const onClick = vi.fn();
    const onLongPress = vi.fn();
    render(<IconButton label="Undo" icon={icon} onClick={onClick} onLongPress={onLongPress} />);
    const undo = screen.getByRole('button', { name: 'Undo' });
    const pointer = (type: string) =>
      undo.dispatchEvent(
        new PointerEvent(type, { bubbles: true, pointerType: 'touch', clientX: 5, clientY: 5 }),
      );
    vi.useFakeTimers();
    act(() => {
      pointer('pointerdown');
      vi.advanceTimersByTime(LONG_PRESS_MS);
      pointer('pointerup');
    });
    undo.click();
    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
    act(() => {
      pointer('pointerdown');
      vi.advanceTimersByTime(100);
      pointer('pointerup');
    });
    undo.click();
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onLongPress).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
    // A mouse never long-presses.
    await userEvent.click(undo);
    expect(onClick).toHaveBeenCalledTimes(2);
  });
});
