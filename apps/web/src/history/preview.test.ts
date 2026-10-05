/**
 * The scrubber's preview (08-feedback FB7 §6): at most one history jump per 100 ms with the
 * latest step winning, restore to the opening step, and no preview across an engine edit that
 * replays.
 */
import {
  createHistory,
  createWorkspace,
  type EngineEdit,
  type History,
  pushHistory,
  type SourceId,
  type Workspace,
} from '@pdf-editor/document-model';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createPreviewSession, crossesReplay, PREVIEW_INTERVAL_MS } from './preview';

afterEach(() => vi.useRealTimers());

function session(start = 5) {
  let clock = 0;
  const shown: number[] = [];
  const preview = createPreviewSession({
    start,
    show: (index) => shown.push(index),
    now: () => clock,
  });
  return {
    preview,
    shown,
    advance(ms: number) {
      clock += ms;
      vi.advanceTimersByTime(ms);
    },
  };
}

describe('createPreviewSession', () => {
  it('shows the first step at once and the latest after the interval', () => {
    vi.useFakeTimers();
    const s = session();
    s.preview.preview(4);
    expect(s.shown).toEqual([4]);
    s.preview.preview(3);
    s.preview.preview(2);
    s.preview.preview(1);
    expect(s.shown).toEqual([4]);
    s.advance(PREVIEW_INTERVAL_MS);
    expect(s.shown).toEqual([4, 1]);
    expect(s.preview.shown).toBe(1);
    // Quiet for longer than the interval: the next one is immediate again.
    s.advance(PREVIEW_INTERVAL_MS * 2);
    s.preview.preview(2);
    expect(s.shown).toEqual([4, 1, 2]);
  });

  it('restores the opening step once, and drops a waiting preview', () => {
    vi.useFakeTimers();
    const s = session(5);
    s.preview.preview(3);
    s.preview.preview(2);
    s.preview.restore();
    s.advance(PREVIEW_INTERVAL_MS * 2);
    expect(s.shown).toEqual([3, 5]);
    s.preview.restore();
    expect(s.shown).toEqual([3, 5]);
  });

  it('flush drops a waiting preview without showing it', () => {
    vi.useFakeTimers();
    const s = session(5);
    s.preview.preview(4);
    s.preview.preview(2);
    s.preview.flush();
    s.advance(PREVIEW_INTERVAL_MS * 2);
    expect(s.shown).toEqual([4]);
  });

  it('a step that must wait is not shown', () => {
    const shown: number[] = [];
    const preview = createPreviewSession({
      start: 3,
      show: (index) => shown.push(index),
      waits: (_from, to) => to === 1,
    });
    preview.preview(1);
    expect(shown).toEqual([]);
    expect(preview.shown).toBe(3);
  });
});

describe('crossesReplay', () => {
  const source = 's1' as SourceId;
  const edit = (id: string, kind: EngineEdit['kind']): EngineEdit => ({
    id,
    source,
    pageIndex: 0,
    kind,
    payload: null,
  });
  const withEdits = (ws: Workspace, ...edits: EngineEdit[]): Workspace => ({
    ...ws,
    engineEdits: [...ws.engineEdits, ...edits],
  });

  it('is true only across a text, paragraph, OCR, redaction or image replacement', () => {
    const w0 = createWorkspace();
    const w1 = withEdits(w0, edit('a', 'annotation.create'));
    const w2 = withEdits(w1, edit('b', 'text.editParagraph'));
    const w3 = withEdits(w2, edit('c', 'annotation.update'));
    let history: History = createHistory(w0, 'Start', 0);
    for (const [i, ws] of [w1, w2, w3].entries()) {
      history = pushHistory(history, ws, `Step ${i + 1}`, { now: i + 1 });
    }
    expect(crossesReplay(history, 0, 1)).toBe(false);
    expect(crossesReplay(history, 3, 2)).toBe(false);
    expect(crossesReplay(history, 3, 1)).toBe(true);
    expect(crossesReplay(history, 1, 2)).toBe(true);
    expect(crossesReplay(history, 2, 2)).toBe(false);
  });
});
