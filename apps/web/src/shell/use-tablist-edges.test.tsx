/**
 * The tab list's scroll edges (XD-3, use-tablist-edges.ts): the list marks the edges with tabs
 * beyond them, and a resize keeps the active tab (the one Tab stop) in view, clear of the fades.
 * Vitest browser mode, so layout and scrolling are real.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useTablistEdges } from './use-tablist-edges';

const frames = (n: number) =>
  new Promise<void>((resolve) => {
    let left = n;
    const step = () => (--left <= 0 ? resolve() : requestAnimationFrame(step));
    requestAnimationFrame(step);
  });

function List({ width, count, active }: { width: number; count: number; active: number }) {
  const ref = useTablistEdges();
  return (
    <div
      ref={ref}
      role="tablist"
      aria-label="Open documents"
      style={{ display: 'flex', width, overflowX: 'auto' }}
    >
      {Array.from({ length: count }, (_, i) => (
        <button
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed fixture list
          key={i}
          type="button"
          role="tab"
          aria-selected={i === active}
          tabIndex={i === active ? 0 : -1}
          style={{ flex: 'none', width: 120 }}
        >
          {`tab ${i}`}
        </button>
      ))}
    </div>
  );
}

afterEach(cleanup);

describe('useTablistEdges', () => {
  it('marks nothing while the tabs fit', async () => {
    render(<List width={400} count={2} active={0} />);
    await frames(2);
    const list = screen.getByRole('tablist');
    expect(list.hasAttribute('data-more-start')).toBe(false);
    expect(list.hasAttribute('data-more-end')).toBe(false);
  });

  it('marks the edges with tabs beyond them as the list scrolls', async () => {
    render(<List width={200} count={4} active={0} />);
    await frames(2);
    const list = screen.getByRole('tablist');
    expect(list.hasAttribute('data-more-start')).toBe(false);
    expect(list.hasAttribute('data-more-end')).toBe(true);
    list.scrollLeft = 100;
    await frames(2);
    expect(list.hasAttribute('data-more-start')).toBe(true);
    expect(list.hasAttribute('data-more-end')).toBe(true);
    list.scrollLeft = list.scrollWidth;
    await frames(2);
    expect(list.hasAttribute('data-more-start')).toBe(true);
    expect(list.hasAttribute('data-more-end')).toBe(false);
  });

  it('keeps the active tab in view, clear of the fades, when the list narrows', async () => {
    const { rerender } = render(<List width={500} count={4} active={2} />);
    await frames(2);
    rerender(<List width={200} count={4} active={2} />);
    await frames(3);
    const list = screen.getByRole('tablist').getBoundingClientRect();
    const tab = screen.getByRole('tab', { name: 'tab 2' }).getBoundingClientRect();
    expect(tab.left).toBeGreaterThanOrEqual(list.left + 24 - 1);
    expect(tab.right).toBeLessThanOrEqual(list.right - 24 + 1);
  });
});
