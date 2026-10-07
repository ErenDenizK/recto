/**
 * Keycaps under a finger (09-primitives §15; V2 review item 26): a touch or pen press marks the
 * root as touch input, which hides keycaps on a coarse pointer; a mouse press or a key clears
 * it. Emulates touch over CDP, so it runs in the chromium-touch project (vitest.config.ts).
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { cdp, userEvent } from 'vitest/browser';

import './Keycaps';

/** Chrome DevTools Protocol, typed loosely (the provider's session type is not exported). */
function devtools(method: string, params: object): Promise<unknown> {
  return (cdp() as unknown as { send(m: string, p: object): Promise<unknown> }).send(
    method,
    params,
  );
}

describe('Keycaps and touch input', () => {
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
