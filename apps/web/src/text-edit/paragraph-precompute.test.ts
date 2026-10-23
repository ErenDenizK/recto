/**
 * The pre-analysis of the page in view (`paragraph-precompute.ts`, `?textpre=1`): editable
 * paragraphs are asked for once each, in reading order and one at a time; the queue stops
 * when the tool is left or the page changes, holds at most `PRE_MAX` paragraphs, and an
 * editor opening on a pre-analysed paragraph asks the engine nothing. A hovered paragraph
 * shares the queue's one slot; the hook queues nothing with the flag off, and its cleanup
 * stops the queue.
 */
import type { SourceId } from '@pdf-editor/document-model';
import type { ParagraphBlock, ParagraphLayoutAnalysis, ParagraphRef } from '@pdf-editor/engine';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getEngineService } from '../engine/engine-service';
import {
  PRE_MAX,
  precomputeParagraphs,
  precomputeQueue,
  prefetchParagraph,
  setTextPrecomputeForTests,
  usePrecomputeParagraphs,
} from './paragraph-precompute';
import { paragraphLayoutAnalysisOf } from './text-edit-store';

let sources = 0;

/** `count` detected paragraphs of a fresh source's first page (`refused` refuse paragraph mode). */
function blocks(count: number, refused: readonly number[] = []): readonly ParagraphBlock[] {
  const source = `pre-${++sources}` as SourceId;
  return Array.from({ length: count }, (_, index) => {
    const block = {
      ref: { source, pageIndex: 0, index } as unknown as ParagraphRef,
      text: `Paragraph ${index}`,
      ...(refused.includes(index) ? { refusal: 'vertical' } : {}),
    };
    return block as unknown as ParagraphBlock;
  });
}

/** The engine's analysis, mocked: resolves on the next task and counts what is in flight. */
function mockAnalysis() {
  const asked: number[] = [];
  let inFlight = 0;
  let most = 0;
  const spy = vi
    .spyOn(getEngineService(), 'analyzeParagraphLayout')
    .mockImplementation(async (ref) => {
      asked.push(ref.index);
      inFlight++;
      most = Math.max(most, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight--;
      return { ref, text: '' } as unknown as ParagraphLayoutAnalysis;
    });
  return { spy, asked, most: () => most };
}

/** A promise held open until `release` is called. */
function hold(): { held: Promise<void>; release: () => void } {
  let release: (() => void) | undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { held, release: () => release?.() };
}

afterEach(() => {
  setTextPrecomputeForTests(null);
  vi.restoreAllMocks();
});

describe('precomputeParagraphs', () => {
  it('asks for each editable paragraph once, in reading order, one at a time', async () => {
    vi.spyOn(getEngineService(), 'pageRevision').mockReturnValue(1);
    const engine = mockAnalysis();
    const page = blocks(4, [1]);
    expect(await precomputeParagraphs(page, 1, () => true)).toBe(3);
    expect(engine.asked).toEqual([0, 2, 3]);
    expect(engine.most()).toBe(1);
    // Asked again (the page shown again): nothing new.
    expect(await precomputeParagraphs(page, 1, () => true)).toBe(0);
    expect(engine.spy).toHaveBeenCalledTimes(3);
  });

  it('an editor opening on a pre-analysed paragraph asks the engine nothing', async () => {
    vi.spyOn(getEngineService(), 'pageRevision').mockReturnValue(1);
    const engine = mockAnalysis();
    const page = blocks(2);
    await precomputeParagraphs(page, 1, () => true);
    const ref = page[1]?.ref;
    if (!ref) throw new Error('no paragraph');
    await paragraphLayoutAnalysisOf(ref, 1);
    expect(engine.spy).toHaveBeenCalledTimes(2);
  });

  it('stops when the tool is left', async () => {
    vi.spyOn(getEngineService(), 'pageRevision').mockReturnValue(1);
    const engine = mockAnalysis();
    let live = true;
    engine.spy.mockImplementation((ref) => {
      engine.asked.push(ref.index);
      live = false;
      return Promise.resolve({ ref, text: '' } as unknown as ParagraphLayoutAnalysis);
    });
    expect(await precomputeParagraphs(blocks(5), 1, () => live)).toBe(1);
    expect(engine.asked).toEqual([0]);
  });

  it('stops when the page changes', async () => {
    const revision = vi.spyOn(getEngineService(), 'pageRevision').mockReturnValue(1);
    const engine = mockAnalysis();
    engine.spy.mockImplementation((ref) => {
      engine.asked.push(ref.index);
      revision.mockReturnValue(2);
      return Promise.resolve({ ref, text: '' } as unknown as ParagraphLayoutAnalysis);
    });
    expect(await precomputeParagraphs(blocks(5), 1, () => true)).toBe(1);
  });

  it('keeps going after a failed paragraph and does not keep the failure', async () => {
    vi.spyOn(getEngineService(), 'pageRevision').mockReturnValue(1);
    const engine = mockAnalysis();
    engine.spy.mockRejectedValueOnce(new Error('engine failed'));
    const page = blocks(3);
    expect(await precomputeParagraphs(page, 1, () => true)).toBe(3);
    expect(precomputeQueue(page, 1).map((block) => block.ref.index)).toEqual([0]);
  });
});

describe('precomputeQueue', () => {
  it('holds at most PRE_MAX paragraphs', () => {
    expect(precomputeQueue(blocks(PRE_MAX + 10), 1)).toHaveLength(PRE_MAX);
  });
});

describe('prefetchParagraph', () => {
  it("waits for the queue's call in flight, then goes next", async () => {
    setTextPrecomputeForTests(true);
    vi.spyOn(getEngineService(), 'pageRevision').mockReturnValue(1);
    const engine = mockAnalysis();
    const { held, release } = hold();
    const analysis = engine.spy.getMockImplementation();
    if (!analysis) throw new Error('no mock');
    // The queue's first call is held in flight until the hover has been seen.
    engine.spy.mockImplementationOnce(async (ref, options) => {
      const result = analysis(ref, options);
      await held;
      return result;
    });
    const page = blocks(4);
    const hovered = page[3];
    if (!hovered) throw new Error('no paragraph');
    const run = precomputeParagraphs(page, 1, () => true);
    await vi.waitFor(() => expect(engine.asked).toEqual([0]));
    prefetchParagraph(hovered, 1);
    expect(engine.asked).toEqual([0]);
    release();
    await run;
    expect(engine.most()).toBe(1);
    expect(engine.asked).toEqual([0, 3, 1, 2]);
  });
});

describe('usePrecomputeParagraphs', () => {
  it('queues nothing with the flag off', async () => {
    setTextPrecomputeForTests(false);
    vi.spyOn(getEngineService(), 'pageRevision').mockReturnValue(1);
    const engine = mockAnalysis();
    const page = blocks(3);
    renderHook(() => usePrecomputeParagraphs(page[0]?.ref.source, 0, 1, page, true));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(engine.spy).not.toHaveBeenCalled();
  });

  it('stops the queue when it is cleaned up', async () => {
    setTextPrecomputeForTests(true);
    vi.spyOn(getEngineService(), 'pageRevision').mockReturnValue(1);
    vi.spyOn(getEngineService(), 'paragraphLayout').mockResolvedValue(
      {} as Awaited<ReturnType<ReturnType<typeof getEngineService>['paragraphLayout']>>,
    );
    const engine = mockAnalysis();
    const { held, release } = hold();
    engine.spy.mockImplementation(async (ref) => {
      engine.asked.push(ref.index);
      await held;
      return { ref, text: '' } as unknown as ParagraphLayoutAnalysis;
    });
    const page = blocks(6);
    const hook = renderHook(() => usePrecomputeParagraphs(page[0]?.ref.source, 0, 1, page, true));
    await waitFor(() => expect(engine.asked).toEqual([0]));
    // Cleaned up with the first call in flight: it finishes, nothing after it is asked.
    hook.unmount();
    release();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(engine.asked).toEqual([0]);
  });
});
