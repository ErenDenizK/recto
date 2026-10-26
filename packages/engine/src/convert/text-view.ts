/**
 * The Text view's block model (PRD-35): the blocks `toBlocks` already built for the Markdown
 * pass, classified by the same `classify` (headings from the document's size clusters, list
 * items from markers), merged into lists, with their page and source box. One layout pass
 * feeds both outputs; nothing here reorders.
 */
import type { Rect } from '@pdf-editor/document-model';

import type { TextViewBlock, TextViewListItem, TextViewPage } from '../types';
import type { Box } from './layout';
import { blockPlainText, classify, type PageBlocks, type StyleModel } from './markdown';

const toRect = (b: Box): Rect => ({ x: b.x0, y: b.y0, width: b.x1 - b.x0, height: b.y1 - b.y0 });

export function textViewPage(
  page: PageBlocks,
  style: StyleModel,
  info: { readonly width: number; readonly height: number; readonly hasText: boolean },
  imageBoxes: readonly Box[],
  joinHyphens: boolean,
): TextViewPage {
  const blocks: TextViewBlock[] = [];
  const base = (bbox: Box) => ({
    id: `p${page.page + 1}-${blocks.length + 1}`,
    page: page.page,
    bbox: toRect(bbox),
  });
  // The open list and the left edge of each depth, closed by any other block.
  let list: { items: TextViewListItem[]; lefts: number[]; ordered: boolean } | undefined;
  for (const block of page.blocks) {
    const c = classify(block, style);
    if (block.kind === 'image') {
      list = undefined;
      const box = imageBoxes[block.image.index];
      if (box) blocks.push({ kind: 'image', ...base(box) });
      continue;
    }
    const text = blockPlainText(block, joinHyphens);
    const first = block.lines[0];
    const box: Box = {
      x0: Math.min(...block.lines.map((l) => l.box.x0)),
      y0: Math.min(...block.lines.map((l) => l.box.y0)),
      x1: Math.max(...block.lines.map((l) => l.box.x1)),
      y1: Math.max(...block.lines.map((l) => l.box.y1)),
    };
    if (c.kind === 'list-item' && block.marker && first) {
      const ordered = block.marker.ordered;
      if (list && list.ordered !== ordered) list = undefined;
      if (!list) {
        const items: TextViewListItem[] = [];
        list = { items, lefts: [], ordered };
        blocks.push({ kind: 'list', ordered, items, ...base(box) });
      }
      // Depth: the number of open indents to the left of this item (0.5 × size tolerance).
      const tolerance = 0.5 * first.size;
      while (list.lefts.length > 0 && first.box.x0 < (list.lefts.at(-1) ?? 0) - tolerance)
        list.lefts.pop();
      const top = list.lefts.at(-1);
      if (top === undefined || first.box.x0 > top + tolerance) list.lefts.push(first.box.x0);
      list.items.push({ text, bbox: toRect(box), depth: list.lefts.length - 1 });
      // The list block's own box grows with its items.
      const last = blocks[blocks.length - 1];
      if (last?.kind === 'list') {
        const x0 = Math.min(last.bbox.x, box.x0);
        const y0 = Math.min(last.bbox.y, box.y0);
        blocks[blocks.length - 1] = {
          ...last,
          bbox: toRect({
            x0,
            y0,
            x1: Math.max(last.bbox.x + last.bbox.width, box.x1),
            y1: Math.max(last.bbox.y + last.bbox.height, box.y1),
          }),
        };
      }
      continue;
    }
    list = undefined;
    if (text === '') continue;
    blocks.push(
      c.kind === 'heading'
        ? { kind: 'heading', level: c.level, text, ...base(box) }
        : { kind: 'paragraph', text, ...base(box) },
    );
  }
  return {
    page: page.page,
    pageAnchor: `page-${page.page + 1}`,
    size: { width: info.width, height: info.height },
    needsOcr: !info.hasText,
    blocks,
  };
}
