import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PageTarget } from '../annotations/annotation-store';
import type { PageFrame } from '../viewer/geometry';
import { paragraph } from './paragraph-fixtures';
import { NUDGE_IDLE_MS, nudgeParagraph, openAfterNudge } from './paragraph-nudge';
import { setParagraphFrameForTests } from './paragraph-frame-flag';

const commit = vi.hoisted(() => vi.fn());
const open = vi.hoisted(() => vi.fn());
vi.mock('./actions', () => ({ commitParagraphMove: commit }));
vi.mock('./paragraph-open', () => ({ openParagraphEditor: open }));

const frame: PageFrame = {
  size: { width: 612, height: 792 },
  originX: 0,
  originY: 0,
  rotation: 0,
  scale: 2,
};
const target = { source: 's', pageIndex: 0, pageId: 'p', position: 1 } as unknown as PageTarget;
const key = (name: string, shiftKey = false) => ({
  key: name,
  shiftKey,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
});

describe('the keyboard nudge (TXT-24)', () => {
  const { block } = paragraph(['one two three']);
  const at = { target, block, revision: 3, frame };

  beforeEach(() => {
    vi.useFakeTimers();
    commit.mockReset();
    open.mockReset();
    commit.mockResolvedValue({ ok: true, label: 'Move paragraph' });
    setParagraphFrameForTests(true);
  });
  afterEach(() => {
    vi.useRealTimers();
    setParagraphFrameForTests(null);
  });

  it('commits a burst of presses once, 600 ms after the last', () => {
    expect(nudgeParagraph(key('ArrowRight'), at)).toBe(true);
    expect(nudgeParagraph(key('ArrowRight', true), at)).toBe(true);
    expect(nudgeParagraph(key('ArrowDown'), at)).toBe(true);
    vi.advanceTimersByTime(NUDGE_IDLE_MS - 1);
    expect(commit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith(target, block, 3, { dx: 11, dy: -1 });
  });

  it('leaves other keys, and every key with the toggle off, alone', () => {
    expect(nudgeParagraph(key('a'), at)).toBe(false);
    expect(nudgeParagraph({ ...key('ArrowUp'), ctrlKey: true }, at)).toBe(false);
    setParagraphFrameForTests(false);
    expect(nudgeParagraph(key('ArrowUp'), at)).toBe(false);
    vi.advanceTimersByTime(NUDGE_IDLE_MS);
    expect(commit).not.toHaveBeenCalled();
  });

  it('opening the paragraph meanwhile commits the nudge first, then opens it where it lies', async () => {
    nudgeParagraph(key('ArrowRight', true), at);
    expect(openAfterNudge(target, block)).toBe(true);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(open).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(open).toHaveBeenCalledTimes(1));
    const point = open.mock.calls[0]?.[2] as { x: number; y: number };
    expect(point.x).toBeCloseTo((block.lines[0]?.x0 ?? 0) + 10);
    // Nothing is left to commit when the idle time ends.
    vi.advanceTimersByTime(NUDGE_IDLE_MS);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(openAfterNudge(target, block)).toBe(false);
  });
});
