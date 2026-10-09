/**
 * The Library cards' motion (`card-motion.ts`; motion-2026-10 library-capsule.md §2): a closed
 * card shrinks out as an inert clone under the others, the others slide into its gap from where
 * they were drawn, an arriving card grows in at its slot, and nothing is left on a card at rest.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { ghostOf, playGrid, snapshotGrid } from './card-motion';

function grid(ids: readonly string[]): { grid: HTMLElement; layer: HTMLElement } {
  const el = document.createElement('div');
  el.style.cssText =
    'position:relative;display:grid;grid-template-columns:repeat(3,100px);gap:10px';
  for (const id of ids) el.append(card(id));
  const layer = document.createElement('div');
  layer.style.cssText = 'position:absolute;inset:0;z-index:-1';
  el.append(layer);
  document.body.append(el);
  return { grid: el, layer };
}

function card(id: string): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('role', 'option');
  el.setAttribute('data-document-id', id);
  el.setAttribute('aria-label', id);
  el.style.height = '120px';
  const canvas = document.createElement('canvas');
  canvas.width = 20;
  canvas.height = 20;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#f00';
    ctx.fillRect(0, 0, 20, 20);
  }
  el.append(canvas);
  return el;
}

const cardOf = (root: HTMLElement, id: string) =>
  root.querySelector<HTMLElement>(`[data-document-id="${id}"]`) as HTMLElement;
const transformRuns = (el: Element) =>
  el.getAnimations().filter((a) => {
    const frame = (a.effect as KeyframeEffect).getKeyframes()[0];
    return frame !== undefined && 'transform' in frame;
  });

afterEach(() => {
  document.body.replaceChildren();
});

describe('card motion', () => {
  it('a closed card shrinks out as an inert clone and the next one slides into its place', async () => {
    const { grid: root, layer } = grid(['a', 'b', 'c']);
    const snapshot = snapshotGrid(root, ['a', 'b', 'c'], ['a', 'c']);
    expect(snapshot.ghosts).toHaveLength(1);
    cardOf(root, 'b').remove();
    playGrid(root, layer, snapshot);
    const ghost = layer.firstElementChild as HTMLElement;
    expect(ghost).not.toBeNull();
    // Never a card to a query, a click or assistive technology.
    expect(ghost.hasAttribute('role')).toBe(false);
    expect(ghost.hasAttribute('data-document-id')).toBe(false);
    expect(ghost.inert).toBe(true);
    expect(ghost.getAnimations()).toHaveLength(1);
    // c moved left by one column (110 px) and starts from where it was drawn.
    const [slide] = transformRuns(cardOf(root, 'c'));
    expect(String((slide?.effect as KeyframeEffect).getKeyframes()[0]?.transform)).toMatch(
      /^translate\(110px, 0px\)/,
    );
    expect(transformRuns(cardOf(root, 'a'))).toHaveLength(0);
    await Promise.all(
      [...root.getAnimations({ subtree: true })].map((a) => a.finished.catch(() => undefined)),
    );
    // At rest: the clone gone, nothing inline on the cards (Q-2).
    expect(layer.childElementCount).toBe(0);
    expect(cardOf(root, 'c').style.transform).toBe('');
  });

  it('an arriving card grows in at its slot, from above, and fades in', async () => {
    const { grid: root, layer } = grid(['a']);
    const snapshot = snapshotGrid(root, ['a'], ['a', 'n']);
    root.insertBefore(card('n'), layer);
    playGrid(root, layer, snapshot);
    const arriving = cardOf(root, 'n');
    const [grow] = transformRuns(arriving);
    expect(String((grow?.effect as KeyframeEffect).getKeyframes()[0]?.transform)).toMatch(
      /translate\(0px, -12px\) scale\(0\.9, 0\.9\)/,
    );
    expect(arriving.getAnimations().length).toBe(2);
    await Promise.all(arriving.getAnimations().map((a) => a.finished.catch(() => undefined)));
    expect(arriving.style.transform).toBe('');
    expect(arriving.style.opacity).toBe('');
  });

  it('a clone leaves its check badge behind', () => {
    const source = card('x');
    const check = document.createElement('span');
    check.setAttribute('data-testid', 'library-card-check');
    source.append(check);
    document.body.append(source);
    expect(ghostOf(source).querySelector('span')).toBeNull();
  });

  it('a clone keeps the page bitmap the card drew', () => {
    const source = card('x');
    document.body.append(source);
    const ghost = ghostOf(source);
    const pixel = ghost.querySelector('canvas')?.getContext('2d')?.getImageData(5, 5, 1, 1).data;
    expect([...(pixel ?? [])]).toEqual([255, 0, 0, 255]);
  });
});
