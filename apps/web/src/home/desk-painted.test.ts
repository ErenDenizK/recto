/**
 * The desk's paint mark (`desk-painted.ts`; DSN-87, `masa.md` §4): `desk:painted` is set
 * once, when the desk is on screen with its hero settled and its covers decoded or the waits are
 * over.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { memoryCoversBackend, setCoversBackend } from './covers';
import { COVER_WAIT_MS, DESK_PAINTED_MARK, HERO_WAIT_MS, watchDeskPainted } from './desk-painted';

const marks = () => performance.getEntriesByName(DESK_PAINTED_MARK);

function desk(hero: string): HTMLElement {
  const section = document.createElement('section');
  section.setAttribute('data-testid', 'home');
  section.setAttribute('data-desk', '');
  const top = document.createElement('div');
  top.setAttribute('data-hero', hero);
  section.append(top);
  document.body.append(section);
  return section;
}

const frames = (n: number) =>
  new Promise<void>((resolve) => {
    const step = (left: number) =>
      left <= 0 ? resolve() : requestAnimationFrame(() => step(left - 1));
    step(n);
  });

describe('the desk paint mark (DSN-87)', () => {
  const before = location.search;

  beforeEach(() => {
    performance.clearMarks(DESK_PAINTED_MARK);
    setCoversBackend(memoryCoversBackend());
  });

  afterEach(() => {
    history.replaceState(null, '', location.pathname + before);
    for (const section of document.querySelectorAll('[data-desk]')) section.remove();
    setCoversBackend(undefined);
    performance.clearMarks(DESK_PAINTED_MARK);
  });

  it('marks once the desk has painted with nothing to wait for', async () => {
    history.replaceState(null, '', location.pathname);
    desk('sample');
    watchDeskPainted();
    await expect.poll(() => marks().length, { timeout: 2000 }).toBe(1);
    // Later calls and later desks do not mark again.
    watchDeskPainted();
    await frames(3);
    expect(marks()).toHaveLength(1);
  });

  it('waits for the hero to leave its holding state, at most HERO_WAIT_MS', async () => {
    history.replaceState(null, '', location.pathname);
    const section = desk('holding');
    watchDeskPainted();
    await frames(5);
    expect(marks()).toHaveLength(0);
    section.querySelector('[data-hero]')?.setAttribute('data-hero', 'continue');
    await expect.poll(() => marks().length, { timeout: 2000 }).toBe(1);
    expect(HERO_WAIT_MS).toBe(300);
    expect(COVER_WAIT_MS).toBe(150);
  });

  it('finds a desk that mounts after the watch started', async () => {
    history.replaceState(null, '', location.pathname);
    watchDeskPainted();
    await frames(2);
    expect(marks()).toHaveLength(0);
    desk('none');
    await expect.poll(() => marks().length, { timeout: 2000 }).toBe(1);
  });
});
