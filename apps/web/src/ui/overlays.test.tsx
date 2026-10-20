import '../styles/tokens.css';
import '../styles/global.css';

import { Popover } from '@base-ui/react/popover';
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import { settled } from '../../test/settled';
import { parseShortcut } from '../commands/shortcuts';
import { installContainerTransform } from './container-transform';
import { PopoverBody, PopoverHeader, PopoverPopup } from './Popover';
import { ScrollArea } from './ScrollArea';
import { TOUCH_HOLD_MS, Tooltip, TooltipProvider } from './Tooltip';

const wait = (ms: number) => act(() => new Promise((resolve) => setTimeout(resolve, ms)));

/**
 * A fake clock for the tests whose subject is a time rule (a touch hold, a tooltip delay): the
 * rule's timers run on it and `advance` moves it, so a stalled runner cannot let a real timer
 * fire between two steps (PRC-21). Only the timer functions are faked; frames stay real.
 */
const clock = () => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

/** Moves the fake clock on until no tooltip is left (its close timer and exit run on it). */
const tooltipGone = async () => {
  for (let i = 0; i < 40 && screen.queryByRole('tooltip'); i++) {
    await advance(100);
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  expect(screen.queryByRole('tooltip')).toBeNull();
};

afterEach(() => {
  vi.useRealTimers();
});

function touch(type: string, target: Element, id = 3) {
  const box = target.getBoundingClientRect();
  act(() => {
    target.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: box.left + box.width / 2,
        clientY: box.top + box.height / 2,
        pointerId: id,
        pointerType: 'touch',
        isPrimary: true,
        button: 0,
        buttons: type === 'pointerup' ? 0 : 1,
      }),
    );
  });
}

describe('Tooltip', () => {
  it('shows after the hover delay, with keycaps, and stays while the pointer is on it (A-24)', async () => {
    render(
      <TooltipProvider>
        <Tooltip label="Undo" shortcut={parseShortcut('Mod+Z')}>
          <button type="button" aria-label="Undo">
            ↶
          </button>
        </Tooltip>
      </TooltipProvider>,
    );
    await userEvent.hover(screen.getByRole('button', { name: 'Undo' }));
    const tip = await screen.findByRole('tooltip', {}, { timeout: 2000 });
    expect(tip).toHaveTextContent('Undo');
    expect(tip.querySelectorAll('kbd').length).toBeGreaterThan(0);
    // Hoverable: moving onto the tooltip (at rest after its entrance) keeps it.
    await settled(tip);
    await userEvent.hover(tip);
    await wait(150);
    expect(screen.getByRole('tooltip')).toBeVisible();
  });

  it('closes on Esc and lets the key reach the surface', async () => {
    const onKey = vi.fn();
    render(
      // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- the test's surface listens for Esc
      <div
        onKeyDown={(event) => {
          onKey(event.key);
        }}
      >
        <TooltipProvider>
          <Tooltip label="Close">
            <button type="button" aria-label="Close">
              ✕
            </button>
          </Tooltip>
        </TooltipProvider>
      </div>,
    );
    // A key press first makes the next focus a keyboard one (focus-visible), without Tab leaving
    // the test's surface: on CI, Shift+Tab could land outside it, and Esc then never reached it.
    await userEvent.keyboard('{Shift}');
    const close = screen.getByRole('button', { name: 'Close' });
    close.focus();
    await screen.findByRole('tooltip', {}, { timeout: 2000 });
    expect(close).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(onKey).toHaveBeenCalledWith('Escape');
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
  });

  it('says why a disabled control is unavailable, and describes the trigger with it', async () => {
    render(
      <TooltipProvider>
        <Tooltip label="Undo" reason="nothing to undo">
          <button type="button" aria-label="Undo" aria-disabled="true">
            ↶
          </button>
        </Tooltip>
      </TooltipProvider>,
    );
    const button = screen.getByRole('button', { name: 'Undo' });
    expect(button).toHaveAccessibleDescription('nothing to undo');
    await userEvent.hover(button);
    const tip = await screen.findByRole('tooltip', {}, { timeout: 2000 });
    expect(tip).toHaveTextContent('Undo: nothing to undo');
  });

  it('never shows for a disabled control without a reason', async () => {
    clock();
    render(
      <TooltipProvider>
        <Tooltip label="Undo">
          <button type="button" aria-label="Undo" disabled>
            ↶
          </button>
        </Tooltip>
      </TooltipProvider>,
    );
    screen.getByRole('button', { name: 'Undo' }).focus();
    await advance(700);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('shows on a touch held 450 ms, until release, and that release does not click', async () => {
    clock();
    const onClick = vi.fn();
    render(
      <TooltipProvider>
        <Tooltip label="Highlight">
          <button type="button" aria-label="Highlight" onClick={onClick}>
            H
          </button>
        </Tooltip>
      </TooltipProvider>,
    );
    const button = screen.getByRole('button', { name: 'Highlight' });
    touch('pointerdown', button);
    await advance(TOUCH_HOLD_MS - 150);
    expect(screen.queryByRole('tooltip')).toBeNull();
    await advance(300);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Highlight');
    touch('pointerup', button);
    act(() => button.click());
    expect(onClick).not.toHaveBeenCalled();
    await tooltipGone();
    // A short tap still activates.
    touch('pointerdown', button);
    await advance(100);
    touch('pointerup', button);
    act(() => button.click());
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('after a tap, shows none for the focus or hover the tap leaves behind (§20 item 6; MOB-4)', async () => {
    clock();
    clock();
    render(
      <TooltipProvider>
        <Tooltip label="Extract" shortcut={parseShortcut('Mod+Shift+E')}>
          <button type="button">Extract</button>
        </Tooltip>
      </TooltipProvider>,
    );
    const button = screen.getByRole('button', { name: 'Extract' });
    // A tap: the bar then re-lays under where the finger was (the Pages bar morphing).
    touch('pointerdown', button);
    touch('pointerup', button);
    act(() => button.focus());
    await userEvent.hover(button);
    await advance(900);
    expect(screen.queryByRole('tooltip')).toBeNull();
    // A held touch still shows it.
    touch('pointerdown', button);
    await advance(TOUCH_HOLD_MS + 150);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Extract');
    touch('pointerup', button);
    await tooltipGone();
  });
});

describe('ScrollArea', () => {
  it('marks the edges where content continues and contains overscroll', async () => {
    render(
      <ScrollArea style={{ height: 120, width: 200 }} data-testid="area">
        {Array.from({ length: 30 }, (_, i) => (
          <p key={i} style={{ margin: 0, height: 20 }}>
            Row {i + 1}
          </p>
        ))}
      </ScrollArea>,
    );
    const root = screen.getByTestId('area');
    const viewport = root.firstElementChild as HTMLElement;
    expect(getComputedStyle(viewport).overscrollBehaviorY).toBe('contain');
    await waitFor(() => expect(root).toHaveAttribute('data-overflow-y-end'));
    expect(root).not.toHaveAttribute('data-overflow-y-start');
    expect(getComputedStyle(viewport).maskImage).toContain('linear-gradient');
    act(() => {
      viewport.scrollTop = 200;
      viewport.dispatchEvent(new Event('scroll'));
    });
    await waitFor(() => expect(root).toHaveAttribute('data-overflow-y-start'));
  });

  it('takes its scroll padding from the free rectangle', () => {
    render(
      <div style={{ '--free-top': '48px', '--free-bottom': '64px' } as React.CSSProperties}>
        <ScrollArea style={{ height: 100 }} data-testid="area">
          <p style={{ height: 400, margin: 0 }}>Long</p>
        </ScrollArea>
      </div>,
    );
    const viewport = screen.getByTestId('area').firstElementChild as HTMLElement;
    const style = getComputedStyle(viewport);
    expect(style.scrollPaddingTop).toBe('48px');
    expect(style.scrollPaddingBottom).toBe('64px');
  });
});

describe('Popover', () => {
  installContainerTransform();

  it('is the one recipe: radius 16, 12 px padding, a 44 px title row with ✕, scaling from its anchor', async () => {
    render(
      <Popover.Root>
        <Popover.Trigger>Open</Popover.Trigger>
        <PopoverPopup data-testid="pop">
          <PopoverHeader title="Edit Blue pen" />
          <PopoverBody>Width and colour.</PopoverBody>
        </PopoverPopup>
      </Popover.Root>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit Blue pen' });
    expect(dialog).toHaveAccessibleDescription('Width and colour.');
    // The entry grows out of its trigger (the container transform, platform.md §1): its clip,
    // a translate with a uniform scale about the trigger (MOT-9) and its opacity, on Web
    // Animations (Q-7: no layout moves).
    expect(dialog).toHaveAttribute('data-ct');
    const moved = new Set(
      dialog
        .getAnimations()
        .flatMap((a) => (a.effect as KeyframeEffect).getKeyframes())
        .flatMap((k) => Object.keys(k))
        .filter((k) => !['offset', 'easing', 'composite', 'computedOffset'].includes(k)),
    );
    expect([...moved].sort()).toEqual(['clipPath', 'opacity', 'transform', 'transformOrigin']);
    await settled(dialog);
    // The finished entrance is cancelled on the frame after it ends, which a slow runner may not
    // have reached when `settled` returns.
    await waitFor(() => expect(dialog.getAnimations()).toEqual([]));
    expect(dialog.style.cssText).toBe('');
    const style = getComputedStyle(dialog);
    expect(style.borderTopLeftRadius).toBe('16px');
    expect(style.paddingTop).toBe('12px');
    expect(style.transform).toBe('none');
    const close = screen.getByRole('button', { name: 'Close' });
    expect(close.parentElement?.getBoundingClientRect().height).toBe(44);
    await userEvent.click(close);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
