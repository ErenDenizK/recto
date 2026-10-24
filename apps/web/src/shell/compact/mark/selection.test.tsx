/**
 * Phone lane B (design/phone-2026-10/README.md §3 row 2, §4): the selection watch's rule
 * (`selection-host.tsx`: only a non-empty range in a page's text layer), the bar's placement
 * (`selection-bar.tsx`: a callout's band clear above the selection, below it under the top bar,
 * within the chrome), the bar's actions (Highlight in the Highlighter's tint, the Edit text slot
 * hidden while that tool is `soon`), and the ink options' sizes (three dots of growing diameter,
 * the chosen one checked, a choice written to the pen preset).
 */
import '../../../styles/tokens.css';
import '../../../styles/reset.css';
import '../../../styles/global.css';

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetAnnotationStore, useAnnotationStore } from '../../../annotations/annotation-store';
import { TEXT_LAYER_ATTR } from '../../../viewer/text-model';
import { highlighterSlot, PEN_SIZES, writingSlots } from './ink-presets';
import { PenOptions } from './InkOptions';
import { registerCompactTool, resetCompactTools } from './registry';
import SelectionBar, { CALLOUT_BAND, placeBar } from './selection-bar';
import { isPageTextSelection } from '../selection-host';

const markup = vi.hoisted(() => ({ calls: [] as unknown[][] }));
vi.mock('../../../annotations/selection-markup', () => ({
  markupFromSelection: (...args: unknown[]) => {
    markup.calls.push(args);
    return Promise.resolve(false);
  },
}));

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  globalThis.getSelection()?.removeAllRanges();
});

function selectIn(el: Element): void {
  const range = document.createRange();
  range.selectNodeContents(el);
  const selection = globalThis.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

describe('the selection watch', () => {
  it('takes a non-empty range in a page text layer, and nothing else', () => {
    const layer = document.createElement('div');
    layer.setAttribute(TEXT_LAYER_ATTR, '0');
    layer.innerHTML = '<span>Hello page</span>';
    layer.style.userSelect = 'text';
    const other = document.createElement('p');
    other.style.userSelect = 'text';
    other.textContent = 'Chrome label';
    document.body.append(layer, other);

    selectIn(layer.firstElementChild as Element);
    expect(isPageTextSelection(globalThis.getSelection())).toBe(true);
    selectIn(other);
    expect(isPageTextSelection(globalThis.getSelection())).toBe(false);
    globalThis.getSelection()?.collapseToStart();
    expect(isPageTextSelection(globalThis.getSelection())).toBe(false);
  });
});

describe('the selection bar placement', () => {
  const limits = { top: 60, bottom: 760, left: 16, right: 374 };
  const bar = { width: 200, height: 52 };

  it('sits a callout band above the selection, centred on its first line', () => {
    const sel = { top: 400, bottom: 440, left: 40, right: 340 };
    const first = { top: 400, bottom: 420, left: 100, right: 300 };
    const p = placeBar(sel, first, bar, limits);
    expect(p.side).toBe('above');
    expect(p.y + bar.height).toBe(sel.top - CALLOUT_BAND - 8);
    expect(p.x).toBe(100);
  });

  it('goes below the selection when the top bar is in the way, and keeps to the chrome', () => {
    const sel = { top: 90, bottom: 110, left: 300, right: 380 };
    const p = placeBar(sel, sel, bar, limits);
    expect(p.side).toBe('below');
    expect(p.y).toBe(sel.bottom + CALLOUT_BAND + 8);
    // Clamped inside the right gutter.
    expect(p.x + bar.width).toBeLessThanOrEqual(limits.right);
    const low = placeBar({ ...sel, bottom: 740 }, sel, bar, limits);
    expect(low.y + bar.height).toBeLessThanOrEqual(limits.bottom);
  });
});

describe('the selection bar', () => {
  beforeEach(() => {
    resetAnnotationStore();
    markup.calls = [];
    // A selection to place the bar over (unplaced, it waits hidden).
    const text = document.createElement('p');
    text.textContent = 'Selected words';
    text.style.cssText = 'user-select: text; margin-top: 300px';
    document.body.append(text);
    selectIn(text);
  });
  afterEach(() => resetCompactTools());

  it('offers Highlight and Copy, and Edit text only once that tool is live', () => {
    registerCompactTool({
      id: 'edit-text',
      glyph: 'edit-text',
      label: () => 'Edit text',
      place: 'tile',
      order: 50,
      soon: true,
    });
    const { unmount } = render(<SelectionBar selected onKeep={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Highlight' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit text' })).toBeNull();
    unmount();
    registerCompactTool({
      id: 'edit-text',
      glyph: 'edit-text',
      label: () => 'Edit text',
      place: 'tile',
      order: 50,
      arm: () => undefined,
    });
    render(<SelectionBar selected onKeep={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Edit text' })).toBeTruthy();
  });

  it('highlights in the Highlighter preset’s tint', async () => {
    const pen = useAnnotationStore.getState().pen;
    const index = highlighterSlot(pen);
    if (index === undefined) throw new Error('no highlighter');
    useAnnotationStore.getState().editPreset(index, { color: '#8CF26B' });
    const keep = vi.fn();
    render(<SelectionBar selected onKeep={keep} />);
    screen.getByRole('button', { name: 'Highlight' }).click();
    await vi.waitFor(() => expect(markup.calls).toHaveLength(1));
    expect(markup.calls[0]).toEqual(['highlight', { color: '#8CF26B', opacity: 1 }]);
    // Nothing was created: the reading offer is withdrawn.
    await vi.waitFor(() => expect(keep).toHaveBeenLastCalledWith(false));
  });
});

describe('the ink sizes', () => {
  beforeEach(() => resetAnnotationStore());

  it('are three dots of growing diameter, the chosen one checked, a choice kept on the preset', () => {
    render(<PenOptions />);
    const sizes = screen.getAllByRole('radio', { name: /^(Fine|Medium|Bold)$/ });
    expect(sizes).toHaveLength(3);
    const dots = sizes.map((s) => (s.lastElementChild as HTMLElement).getBoundingClientRect());
    expect(dots[0]?.width).toBeLessThan(dots[1]?.width ?? 0);
    expect(dots[1]?.width).toBeLessThan(dots[2]?.width ?? 0);
    screen.getByRole('radio', { name: 'Bold' }).click();
    const pen = useAnnotationStore.getState().pen;
    const active = writingSlots(pen).includes(pen.active) ? pen.active : writingSlots(pen)[0];
    expect(active === undefined ? undefined : pen.presets[active].width).toBe(PEN_SIZES[2]);
  });
});
