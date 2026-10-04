/**
 * `viewTransition()`: 240 ms at most, the update awaited, focus restored, and a plain update
 * where View Transitions are missing or motion is reduced (language.md §7.4; research 22 §5.5;
 * spec D0-12).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { VIEW_TRANSITION_MS, viewTransition } from './view-transition';

/** Hides `document.startViewTransition` as an engine without View Transitions would. */
function withoutViewTransitions() {
  Object.defineProperty(document, 'startViewTransition', { value: undefined, configurable: true });
}

afterEach(() => {
  Reflect.deleteProperty(document, 'startViewTransition');
  delete document.documentElement.dataset.motion;
  vi.restoreAllMocks();
  document.head.querySelector('style[data-test]')?.remove();
  document.body.replaceChildren();
});

describe('viewTransition', () => {
  it('stays at or under 250 ms (A-10: input is blocked while one runs)', () => {
    expect(VIEW_TRANSITION_MS).toBe(240);
  });

  it('just runs the update where View Transitions are missing', async () => {
    withoutViewTransitions();
    const update = vi.fn();
    await viewTransition(update);
    expect(update).toHaveBeenCalledOnce();
  });

  it('awaits an asynchronous update', async () => {
    withoutViewTransitions();
    let applied = false;
    await viewTransition(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      applied = true;
    });
    expect(applied).toBe(true);
  });

  it('restores focus that went with the old DOM', async () => {
    withoutViewTransitions();
    const button = document.createElement('button');
    button.textContent = 'Open';
    document.body.append(button);
    button.focus();
    await viewTransition(() => {
      button.remove();
      document.body.append(button);
    });
    expect(document.activeElement).toBe(button);
  });

  it('leaves focus the update moved on purpose', async () => {
    withoutViewTransitions();
    const [from, to] = ['From', 'To'].map((label) => {
      const button = document.createElement('button');
      button.textContent = label;
      document.body.append(button);
      return button;
    });
    from!.focus();
    await viewTransition(() => to!.focus());
    expect(document.activeElement).toBe(to);
  });

  it('skips the transition under reduced motion', async () => {
    if (!document.startViewTransition) return;
    document.documentElement.dataset.motion = 'reduced';
    const start = vi.spyOn(document, 'startViewTransition');
    const update = vi.fn();
    await viewTransition(update);
    expect(update).toHaveBeenCalledOnce();
    expect(start).not.toHaveBeenCalled();
  });

  it('runs a View Transition with the name as its type, cut off at 240 ms', async () => {
    // Engines without View Transitions are covered by the fallback above.
    if (!document.startViewTransition) return;
    const style = document.createElement('style');
    style.dataset.test = '';
    style.textContent =
      '::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*) ' +
      '{ animation-duration: 3s; }';
    document.head.append(style);
    const start = vi.spyOn(document, 'startViewTransition');
    const marker = document.createElement('p');
    await viewTransition(() => document.body.append(marker), { name: 'library' });
    expect(marker.isConnected).toBe(true);
    const transition = start.mock.results[0]?.value as ViewTransition;
    if ('types' in transition) expect(transition.types.has('library')).toBe(true);
    const began = performance.now();
    await transition.finished;
    // A 3 s stylesheet transition ends at the cap (with room for a slow test machine).
    expect(performance.now() - began).toBeLessThan(VIEW_TRANSITION_MS + 600);
  });
});
