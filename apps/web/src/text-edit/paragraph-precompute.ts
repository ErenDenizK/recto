/**
 * Pre-analysis of the paragraphs of the page in view (TXT-21, behind `?textpre=1`): while
 * the Edit text tool is armed, the layout analysis a click would ask for
 * (`analyzeParagraphLayout`, craft spec §4.8: the paragraph's model, the metrics of its styles
 * and the substitute faces they need) is asked for ahead, one paragraph at a time at idle, so
 * the first click finds it cached (`paragraphLayoutAnalysisOf`, per paragraph and page
 * revision). A paragraph the pointer comes over is asked for at once. The engine's layout
 * functions (`paragraphLayout`, the main thread's engine chunk) load ahead too: the editor
 * imports them on its first open.
 *
 * Only the page in view is analysed (its neighbours would triple the worker's work), at most
 * `PRE_MAX` paragraphs of it, and one call at a time, so a render waits behind one paragraph
 * at most. Leaving the tool, another revision of the page or the page leaving the view stops
 * the queue; the one call in flight is kept (a click may share it). The worker only reads: a
 * parked source (PF-18) is never in view, and its cached analyses go with its revision.
 */
import type { SourceId } from '@pdf-editor/document-model';
import type { ParagraphBlock } from '@pdf-editor/engine';
import { useEffect } from 'react';

import { getEngineService } from '../engine/engine-service';
import { pageRevision } from './runs';
import { hasParagraphLayoutAnalysis, paragraphLayoutAnalysisOf } from './text-edit-store';

/** The address parameter that turns the pre-analysis on (`?textpre=1`). */
export const TEXT_PRE_PARAM = 'textpre';

/** The most paragraphs of one page analysed ahead (the cache keeps 64 analyses). */
export const PRE_MAX = 32;

const flagged = (() => {
  try {
    return new URLSearchParams(location.search).get(TEXT_PRE_PARAM) === '1';
  } catch {
    return false;
  }
})();

/** Whether the pre-analysis is on (read once, when the module loads). */
export function textPrecomputeEnabled(): boolean {
  return flagged;
}

/** The paragraphs to analyse ahead, in reading order: editable, not yet asked for. */
export function precomputeQueue(
  blocks: readonly ParagraphBlock[],
  revision: number,
): readonly ParagraphBlock[] {
  return blocks
    .filter((block) => !block.refusal && !hasParagraphLayoutAnalysis(block.ref, revision))
    .slice(0, PRE_MAX);
}

const idle = (): Promise<void> =>
  new Promise((resolve) => {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => resolve(), { timeout: 500 });
    } else {
      setTimeout(resolve, 16);
    }
  });

/**
 * Analyses `blocks` (detected at `revision`) one at a time at idle while `live()` holds and
 * the page is still at `revision`. Resolves to how many it asked for.
 */
export async function precomputeParagraphs(
  blocks: readonly ParagraphBlock[],
  revision: number,
  live: () => boolean,
): Promise<number> {
  let asked = 0;
  for (const block of precomputeQueue(blocks, revision)) {
    await idle();
    if (!live() || pageRevision(block.ref.source, block.ref.pageIndex) !== revision) break;
    if (hasParagraphLayoutAnalysis(block.ref, revision)) continue;
    asked++;
    try {
      await paragraphLayoutAnalysisOf(block.ref, revision);
    } catch {
      // Not kept: a click asks again and reports the failure.
    }
  }
  return asked;
}

/** Asks for one paragraph's analysis now (the pointer came over it). */
export function prefetchParagraph(block: ParagraphBlock, revision: number): void {
  if (!flagged || block.refusal) return;
  if (pageRevision(block.ref.source, block.ref.pageIndex) !== revision) return;
  paragraphLayoutAnalysisOf(block.ref, revision).catch(() => undefined);
}

/**
 * Pre-analyses the paragraphs of `source`'s page `pageIndex` at `revision` while `wanted`
 * (the tool is armed and the page is the one in view) and the flag is on.
 */
export function usePrecomputeParagraphs(
  source: SourceId | undefined,
  pageIndex: number,
  revision: number,
  blocks: readonly ParagraphBlock[] | null,
  wanted: boolean,
): void {
  useEffect(() => {
    if (!flagged || !wanted || source === undefined || blocks === null) return;
    let live = true;
    getEngineService()
      .paragraphLayout()
      .catch(() => undefined);
    void precomputeParagraphs(blocks, revision, () => live);
    return () => {
      live = false;
    };
  }, [source, pageIndex, revision, blocks, wanted]);
}
