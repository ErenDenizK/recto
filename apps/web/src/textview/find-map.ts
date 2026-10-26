/**
 * Find's hits in the Text view (PRD-36, "Find"): which block or list item a hit's rects fall in
 * and where in its text the match is. The count is the engine's; the mark is best effort: the
 * engine's order differs from the Text view's, and joined hyphens or ligatures can stop a
 * match, so a hit whose words are not found in its block marks the whole block (`exact: false`).
 *
 * Matching folds case the way Find does (`fold`, which reads Turkish İ as i). Hits of one page
 * in the same block are told apart by their rank in Find's order (`seq`): the n-th hit in a
 * block marks the n-th occurrence of the match text in it.
 */
import type { Rect } from '@pdf-editor/document-model';
import type { TextViewPage } from '@pdf-editor/engine';

import type { PageFrame } from '../viewer/geometry';
import { type DocumentHit, fold } from '../viewer/search';
import type { FindMark } from './contract';
import { type TextViewAnchor, userToDisplay } from './position';

function overlap(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/** The block or list item of `page` that the hit's rects overlap most, if any. */
export function anchorOfHit(
  hit: DocumentHit,
  page: TextViewPage,
  frame: PageFrame,
): TextViewAnchor | undefined {
  const rects = hit.rects.map((rect) => userToDisplay(frame, rect));
  const area = (box: Rect) => rects.reduce((sum, rect) => sum + overlap(rect, box), 0);
  let best: TextViewAnchor | undefined;
  let bestArea = 0;
  for (const block of page.blocks) {
    const candidates =
      block.kind === 'list'
        ? block.items.map((item, index) => ({ anchor: { block, item: index }, box: item.bbox }))
        : [{ anchor: { block }, box: block.bbox }];
    for (const { anchor, box } of candidates) {
      const size = area(box);
      if (size > bestArea) {
        best = anchor;
        bestArea = size;
      }
    }
  }
  return best;
}

function textOf({ block, item }: TextViewAnchor): string {
  if (block.kind === 'list') return block.items[item ?? 0]?.text ?? '';
  return block.kind === 'heading' || block.kind === 'paragraph' ? block.text : '';
}

const sameAnchor = (a: TextViewAnchor, b: TextViewAnchor) =>
  a.block.id === b.block.id && a.item === b.item;

/** The text the engine matched, whitespace collapsed; empty when it does not say. */
function matchText(hit: DocumentHit): string {
  const { context, matchStart, matchLength } = hit;
  if (matchStart === undefined || matchLength === undefined) return '';
  return context
    .slice(matchStart, matchStart + matchLength)
    .replace(/\s+/g, ' ')
    .trim();
}

/** The start of the `rank`-th (0-based) non-overlapping occurrence of `needle`, case folded. */
function nthOccurrence(text: string, needle: string, rank: number): number {
  const haystack = fold(text);
  const target = fold(needle);
  if (target === '') return -1;
  let from = 0;
  for (let n = 0; ; n++) {
    const at = haystack.indexOf(target, from);
    if (at < 0 || n === rank) return at;
    from = at + target.length;
  }
}

/**
 * Where `hit` sits in the text of `page`: `pageHits` are all of Find's hits on that page (the
 * hit among them). Undefined when no block is under the hit's rects.
 */
export function markForHit(
  hit: DocumentHit,
  pageHits: readonly DocumentHit[],
  page: TextViewPage,
  frame: PageFrame,
): FindMark | undefined {
  const anchor = anchorOfHit(hit, page, frame);
  if (!anchor) return undefined;
  let rank = 0;
  for (const other of pageHits) {
    if (other === hit || other.seq >= hit.seq) continue;
    const there = anchorOfHit(other, page, frame);
    if (there && sameAnchor(there, anchor)) rank++;
  }
  const text = textOf(anchor);
  const needle = matchText(hit);
  const at = needle === '' ? -1 : nthOccurrence(text, needle, rank);
  const base = {
    blockId: anchor.block.id,
    ...(anchor.item === undefined ? {} : { item: anchor.item }),
  };
  if (at < 0) return { ...base, start: 0, length: text.length, exact: false };
  return { ...base, start: at, length: needle.length, exact: true };
}
