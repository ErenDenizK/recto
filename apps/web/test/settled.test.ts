import { afterEach, describe, expect, it } from 'vitest';

import { moving, settled } from './settled';

const host = document.createElement('div');
document.body.append(host);

afterEach(() => {
  host.replaceChildren();
});

/** A long task: nothing else on the page runs, as when a sibling file or the runner hogs it. */
const freeze = (ms: number) => {
  const until = performance.now() + ms;
  while (performance.now() < until);
};

function mover(duration: number): HTMLElement {
  const el = document.createElement('div');
  host.append(el);
  el.animate([{ opacity: '0' }, { opacity: '1' }], { duration, fill: 'forwards' });
  return el;
}

describe('settled', () => {
  it('resolves once the motion has run out', async () => {
    const el = mover(200);
    expect(moving(el)).toHaveLength(1);
    await settled(el);
    expect(moving(el)).toHaveLength(0);
  });

  it('fails when the element is still moving after its budget', async () => {
    const el = mover(2000);
    await expect(settled(el, { timeout: 300 })).rejects.toThrow('still moving');
  });

  it('does not charge a freeze of the page against the budget', async () => {
    // A sheet's entrance, then its glass settling: the second motion starts when the first
    // ends, and the freeze outlasts the whole budget, so the first ends inside it and the
    // second is only seen once the page runs again.
    const el = document.createElement('div');
    host.append(el);
    const entrance = el.animate([{ opacity: '0' }, { opacity: '1' }], {
      duration: 400,
      fill: 'forwards',
    });
    entrance.onfinish = () => {
      el.animate([{ color: 'red' }, { color: 'blue' }], { duration: 300 });
    };
    setTimeout(() => freeze(1500), 50);
    await expect(settled(el, { timeout: 800 })).resolves.toBe(el);
    expect(moving(el)).toHaveLength(0);
  });
});
