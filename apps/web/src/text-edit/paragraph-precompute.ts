/**
 * Pre-analysis of the paragraphs of the page in view (TXT-22, behind `?textpre=1`): while
 * the Edit text tool is armed, the layout analysis a click would ask for
 * (`analyzeParagraphLayout`, craft spec §4.8: the paragraph's model, the metrics of its styles
 * and the substitute faces they need) is asked for ahead, one paragraph at a time at idle, so
 * the first click finds it cached (`paragraphLayoutAnalysisOf`, per paragraph and page
 * revision). A paragraph the pointer comes over goes to the front of the queue. The engine's
 * layout functions (`paragraphLayout`, the main thread's engine chunk) load ahead too: the
 * editor imports them on its first open.
 *
 * Only the page in view is analysed (its neighbours would triple the worker's work), at most
 * `PRE_MAX` paragraphs of it, and the pre-analysis never has more than one call in flight
 * (queue and hover share one slot), so a render waits behind one paragraph at most; only a
 * click, which never waits, may add its own. Leaving the tool, another revision of the page or
 * the page leaving the view stops the queue; the one call in flight is kept (a click may share
 * it). The worker only reads: a parked source (PF-18) is never in view, and its cached analyses
 * go with its revision.
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

// Read once, when the module loads: the sample's opening (`?sample`) rewrites the address
// later, and turning the flag on or off takes a reload.
const flagged = (() => {
  try {
    return new URLSearchParams(location.search).get(TEXT_PRE_PARAM) === '1';
  } catch {
    return false;
  }
})();
let override: boolean | null = null;

/** Whether the pre-analysis is on (the address, read once when the module loads). */
export function textPrecomputeEnabled(): boolean {
  return override ?? flagged;
}

/** Tests only: turns the flag on or off (null: back to the address). */
export function setTextPrecomputeForTests(on: boolean | null): void {
  override = on;
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

/** The one call the pre-analysis has in flight, if any, and the hovered paragraph waiting. */
let current: Promise<void> | null = null;
let front: { readonly block: ParagraphBlock; readonly revision: number } | null = null;

/** Whether `block` still wants asking for at `revision`. */
const wanting = (block: ParagraphBlock, revision: number): boolean =>
  !block.refusal &&
  !hasParagraphLayoutAnalysis(block.ref, revision) &&
  pageRevision(block.ref.source, block.ref.pageIndex) === revision;

/** Asks for one analysis in the single slot; the hovered paragraph goes next. */
function ask(block: ParagraphBlock, revision: number): Promise<void> {
  const call = paragraphLayoutAnalysisOf(block.ref, revision).then(
    () => undefined,
    // Not kept: a click asks again and reports the failure.
    () => undefined,
  );
  const done = call.then(() => {
    if (current === done) current = null;
    const next = front;
    front = null;
    if (next && current === null && wanting(next.block, next.revision)) {
      void ask(next.block, next.revision);
    }
  });
  current = done;
  return done;
}

/** Waits until the slot is free (a hovered paragraph may take it first). */
async function slot(): Promise<void> {
  while (current) await current;
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
    await slot();
    if (!live() || pageRevision(block.ref.source, block.ref.pageIndex) !== revision) break;
    if (!wanting(block, revision)) continue;
    asked++;
    await ask(block, revision);
  }
  return asked;
}

/**
 * The pointer came over `block`: it is asked for now when the slot is free, else next (a
 * newer hover replaces an older one still waiting).
 */
export function prefetchParagraph(block: ParagraphBlock, revision: number): void {
  if (!textPrecomputeEnabled() || !wanting(block, revision)) return;
  if (current) front = { block, revision };
  else void ask(block, revision);
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
    if (!textPrecomputeEnabled() || !wanted || source === undefined || blocks === null) return;
    let live = true;
    getEngineService()
      .paragraphLayout()
      .catch(() => undefined);
    void precomputeParagraphs(blocks, revision, () => live);
    return () => {
      live = false;
      front = null;
    };
  }, [source, pageIndex, revision, blocks, wanted]);
}
