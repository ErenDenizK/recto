/**
 * A piece following its content's width on a spring (motion/resize.ts; language.md §7.3 *bar
 * morph*; quality-bar Q-2, Q-6; owner feedback 2026-10-09 G6).
 */
import { afterEach, describe, expect, it } from 'vitest';

import { RESIZING, restingWidth, springWidth, TARGET_WIDTH } from './resize';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));

/** A piece in a row, holding one child of `width` px. */
function piece(width: number): { el: HTMLDivElement; child: HTMLDivElement } {
  const row = document.createElement('div');
  row.style.cssText = 'display: flex; width: 800px;';
  const el = document.createElement('div');
  el.style.cssText = 'display: flex; flex: none; height: 40px;';
  const child = document.createElement('div');
  child.style.cssText = `flex: none; width: ${width}px; height: 20px;`;
  el.append(child);
  row.append(el);
  document.body.append(row);
  return { el, child };
}

const width = (el: Element) => el.getBoundingClientRect().width;

/** Waits until `el` is at rest: no motion, no attribute, no inline width (Q-2). */
async function settled(el: HTMLElement): Promise<void> {
  const deadline = performance.now() + 3000;
  while (el.hasAttribute(RESIZING) && performance.now() < deadline) await frame();
  expect(el.hasAttribute(RESIZING)).toBe(false);
  expect(el.hasAttribute(TARGET_WIDTH)).toBe(false);
  expect(el.style.width).toBe('');
  expect(el.getAnimations()).toHaveLength(0);
}

afterEach(() => {
  delete document.documentElement.dataset.motion;
  document.body.replaceChildren();
});

describe('springWidth', () => {
  it('draws a content change from the old width to the new on a spring, and rests clean', async () => {
    const { el, child } = piece(100);
    const stop = springWidth(el);
    await frame();
    child.style.width = '300px';
    await frame();
    await frame();
    expect(el.hasAttribute(RESIZING)).toBe(true);
    expect(restingWidth(el)).toBe(300);
    // The child keeps its resting width while the piece's own width moves.
    expect(width(child)).toBe(300);
    await wait(60);
    expect(width(el)).toBeGreaterThan(100);
    expect(width(el)).toBeLessThan(300);
    await settled(el);
    expect(width(el)).toBe(300);
    expect(child.style.flex).toBe('');
    stop();
  });

  it('retargets from where it is when the content changes mid-flight', async () => {
    const { el, child } = piece(100);
    const stop = springWidth(el);
    await frame();
    child.style.width = '400px';
    await frame();
    await wait(80);
    const mid = width(el);
    expect(mid).toBeGreaterThan(100);
    // New content, seen by the mutation observer.
    child.style.width = '150px';
    el.append(document.createElement('span'));
    await frame();
    await frame();
    expect(Math.abs(width(el) - mid)).toBeLessThan(80);
    expect(restingWidth(el)).toBe(150);
    await settled(el);
    expect(width(el)).toBe(150);
    stop();
  });

  it('changes at once under reduced motion (§7.5)', async () => {
    document.documentElement.dataset.motion = 'reduced';
    const { el, child } = piece(100);
    const stop = springWidth(el);
    await frame();
    child.style.width = '300px';
    await frame();
    expect(el.hasAttribute(RESIZING)).toBe(false);
    expect(width(el)).toBe(300);
    stop();
  });

  it('starts nothing while the content moves the width itself', async () => {
    const { el, child } = piece(100);
    const stop = springWidth(el, { hold: () => true });
    await frame();
    child.style.width = '300px';
    await frame();
    expect(el.hasAttribute(RESIZING)).toBe(false);
    expect(width(el)).toBe(300);
    stop();
  });

  it('reads a piece at rest by its own width', () => {
    const { el } = piece(120);
    expect(restingWidth(el)).toBe(120);
  });
});
