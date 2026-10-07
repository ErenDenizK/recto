import '../styles/tokens.css';
import '../styles/reset.css';
import '../styles/global.css';

import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { cdp, userEvent } from 'vitest/browser';

import { formatShortcut, parseShortcut } from '../commands/shortcuts';
import { Keycaps } from './Keycaps';
import { ResizeHandle } from './ResizeHandle';

/** Chrome DevTools Protocol, typed loosely (the provider's session type is not exported). */
function devtools(method: string, params: object): Promise<unknown> {
  return (cdp() as unknown as { send(m: string, p: object): Promise<unknown> }).send(
    method,
    params,
  );
}

describe('Keycaps (09-primitives §15)', () => {
  it('draws 18 px caps with radius 4, decorative', () => {
    const { container } = render(
      <Keycaps shortcut={parseShortcut('Mod+Shift+S')} platform="other" />,
    );
    const caps = container.firstElementChild as HTMLElement;
    expect(caps).toHaveAttribute('aria-hidden', 'true');
    const cap = caps.querySelector('kbd') as HTMLElement;
    expect(cap.getBoundingClientRect().height).toBe(18);
    expect(getComputedStyle(cap).borderTopLeftRadius).toBe('4px');
    expect([...caps.querySelectorAll('kbd')].map((k) => k.textContent)).toEqual([
      'Ctrl',
      'Shift',
      'S',
    ]);
  });

  it('upper-cases letters as Latin key labels, not in the Turkish locale', () => {
    expect(formatShortcut(parseShortcut('I'), 'other').at(-1)).toBe('I');
  });

  it('a key pressed outside a field marks the root, so coarse pointers show keycaps', () => {
    document.documentElement.removeAttribute('data-keys');
    render(<input aria-label="Name" />);
    // Synthetic events are not keys a person pressed.
    fireEvent.keyDown(window, { key: 'a' });
    expect(document.documentElement.hasAttribute('data-keys')).toBe(false);
  });

  it('a finger or a pen marks the root as touch input, a mouse or a key clears it', async () => {
    const root = document.documentElement;
    root.removeAttribute('data-touch-input');
    render(<button type="button">Target</button>);
    const target = screen.getByRole('button', { name: 'Target' });
    await userEvent.click(target);
    expect(root.hasAttribute('data-touch-input')).toBe(false);
    // A real touch press through CDP, so the events are trusted.
    await devtools('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    try {
      const box = target.getBoundingClientRect();
      const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      await devtools('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
      await devtools('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await expect.poll(() => root.hasAttribute('data-touch-input')).toBe(true);
    } finally {
      await devtools('Emulation.setTouchEmulationEnabled', { enabled: false });
    }
    await userEvent.keyboard('{Shift}');
    expect(root.hasAttribute('data-touch-input')).toBe(false);
  });
});

function Panel({ onCollapse }: { readonly onCollapse?: () => void }) {
  const [width, setWidth] = useState(240);
  return (
    <div style={{ position: 'relative', width, height: 200 }} id="panel">
      <ResizeHandle
        label="Resize sidebar"
        value={width}
        min={200}
        max={400}
        direction={1}
        controls="panel"
        onChange={(v) => setWidth(Math.min(400, Math.max(200, v)))}
        onCollapse={onCollapse}
      />
    </div>
  );
}

describe('ResizeHandle (09-primitives §23)', () => {
  it('is a separator valued in px; arrows step 16, Home and End go to the ends', () => {
    render(<Panel />);
    const handle = screen.getByRole('separator', { name: 'Resize sidebar' });
    expect(handle).toHaveAttribute('aria-valuenow', '240');
    expect(handle.getBoundingClientRect().width).toBe(8);
    handle.focus();
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(handle).toHaveAttribute('aria-valuenow', '256');
    fireEvent.keyDown(handle, { key: 'End' });
    expect(handle).toHaveAttribute('aria-valuenow', '400');
    fireEvent.keyDown(handle, { key: 'Home' });
    expect(handle).toHaveAttribute('aria-valuenow', '200');
  });

  it('collapses with Enter where the panel can', () => {
    let collapsed = 0;
    render(<Panel onCollapse={() => (collapsed += 1)} />);
    fireEvent.keyDown(screen.getByRole('separator'), { key: 'Enter' });
    expect(collapsed).toBe(1);
  });

  it('shows a 2 × 24 px grip only on hover, drag or focus', () => {
    render(<Panel />);
    const handle = screen.getByRole('separator');
    const grip = handle.firstElementChild as HTMLElement;
    expect(grip.getBoundingClientRect().height).toBe(24);
    expect(grip.getBoundingClientRect().width).toBe(2);
    expect(getComputedStyle(grip).opacity).toBe('0');
  });
});
