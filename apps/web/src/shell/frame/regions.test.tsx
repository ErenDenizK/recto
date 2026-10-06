/**
 * The F6 cycle (spec X9; flows §7.2; A-13), Vitest browser mode: the regions in order, the
 * landing target of each, absent and `inert` regions passed by, and F6 ignored in a dialog.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';

import { cycleRegion, REGIONS, regionsOf, useRegionCycling } from './regions';

function Frame({ hiddenBand = false }: { readonly hiddenBand?: boolean }) {
  useRegionCycling();
  return (
    <div>
      <header data-region="top">
        <button type="button">Library</button>
        <div role="tablist" aria-label="Open documents">
          <button type="button" role="tab" aria-selected tabIndex={0}>
            report
          </button>
        </div>
      </header>
      <aside data-region="navigator">
        <div role="tablist" aria-label="Navigator views">
          <button type="button" role="tab" aria-selected tabIndex={0}>
            Pages
          </button>
        </div>
      </aside>
      <main id="stage">
        {/* The page viewport is a Tab stop, as the reader's is (ReadView.tsx). */}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
        <div data-read-viewport tabIndex={0} role="region" aria-label="Pages of report" />
      </main>
      <div data-frame-layer="band" inert={hiddenBand}>
        <div data-region="toolbar" role="toolbar" aria-label="Document tools">
          <button type="button" tabIndex={0}>
            Edit
          </button>
        </div>
        <button type="button" data-region="pill">
          3 / 12 · 96%
        </button>
      </div>
    </div>
  );
}

afterEach(cleanup);

describe('regions (X9)', () => {
  it('lists the frame’s regions in the spec order', () => {
    expect(REGIONS).toEqual([
      '[data-region="top"]',
      '[data-region="navigator"]',
      '#stage',
      '[data-region="tool-sheet"]',
      '[data-region="facts"]',
      '[data-region="pending"]',
      '[data-region="toolbar"]',
      '[data-region="context"]',
      '[data-region="pill"]',
      '[data-region="toasts"]',
    ]);
  });

  it('F6 lands on the active tab, the sidebar’s tab, the page, the dock, the pill, and wraps', async () => {
    render(<Frame />);
    const order = [
      screen.getByRole('tab', { name: 'report' }),
      screen.getByRole('tab', { name: 'Pages' }),
      screen.getByRole('region', { name: 'Pages of report' }),
      screen.getByRole('button', { name: 'Edit' }),
      screen.getByRole('button', { name: '3 / 12 · 96%' }),
    ];
    for (const target of order) {
      await userEvent.keyboard('{F6}');
      expect(target).toHaveFocus();
    }
    await userEvent.keyboard('{F6}');
    expect(order[0]).toHaveFocus();
    await userEvent.keyboard('{Shift>}{F6}{/Shift}');
    expect(order[4]).toHaveFocus();
  });

  it('passes by inert regions (hidden on scroll, away in Focus)', () => {
    render(<Frame hiddenBand />);
    const found = regionsOf(document).map((el) => el.dataset.region ?? el.id);
    expect(found).toEqual(['top', 'navigator', 'stage']);
  });

  it('does nothing while focus is in a dialog', async () => {
    render(
      <>
        <Frame />
        <div role="dialog" aria-label="Sheet">
          <button type="button">Inside</button>
        </div>
      </>,
    );
    const inside = screen.getByRole('button', { name: 'Inside' });
    inside.focus();
    await userEvent.keyboard('{F6}');
    expect(inside).toHaveFocus();
    expect(cycleRegion(document, 1)).toBe(true);
  });
});
