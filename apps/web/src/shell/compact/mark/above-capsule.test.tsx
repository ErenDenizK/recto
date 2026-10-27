/**
 * What stands above the single capsule (`[data-compact-above-capsule]`: the tray and the Redo
 * chip, EDN-24): the selection bar's lower limit and the keyboard band's foot are the top of the
 * highest of them (selection-bar.tsx `chromeLimits`, keyboard.ts).
 */
import { afterEach, describe, expect, it } from 'vitest';

import { watchKeyboard } from './keyboard';
import { chromeLimits } from './selection-bar';

function box(attrs: Record<string, string>, top: number, height: number): HTMLElement {
  const el = document.createElement('div');
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  el.style.cssText = `position:fixed;left:0;width:100px;top:${top}px;height:${height}px;`;
  document.body.append(el);
  return el;
}

afterEach(() => document.body.replaceChildren());

describe('the selection bar’s limits', () => {
  it('end at the capsule alone, then at the top of the tray above it', () => {
    box({ 'data-testid': 'compact-capsule' }, 300, 56);
    const alone = chromeLimits().bottom;
    box({ 'data-compact-above-capsule': '' }, 236, 56);
    expect(chromeLimits().bottom).toBe(alone - 64);
  });

  it('end above the highest of tray and chip', () => {
    box({ 'data-testid': 'compact-capsule' }, 300, 56);
    box({ 'data-compact-above-capsule': '' }, 236, 56);
    const chip = box({ 'data-compact-above-capsule': '' }, 180, 44);
    expect(chromeLimits().bottom).toBe(chip.getBoundingClientRect().top - 8);
  });
});

describe('the keyboard band', () => {
  it('ends above the tray when one stands above the capsule', () => {
    box({ 'data-testid': 'compact-capsule' }, 300, 56);
    let band = 0;
    let stop = watchKeyboard((s) => (band = s.band.bottom));
    expect(band).toBe(300);
    stop();
    box({ 'data-compact-above-capsule': '' }, 236, 56);
    stop = watchKeyboard((s) => (band = s.band.bottom));
    expect(band).toBe(236);
    stop();
  });
});
