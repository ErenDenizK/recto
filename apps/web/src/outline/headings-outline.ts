/**
 * Headings → outline tree for "Add bookmarks from headings" (PRD-33). The headings are the
 * ones the Markdown export finds (`ConvertReport.headingList`, recognize-and-compare §4):
 * level 1 to 4 by font size, in reading order. A heading nests under the nearest earlier one
 * of a smaller level; a level that skips one (1 then 3) nests one step down, never deeper.
 */
import { type OutlineNode, outlineItem, type PageId } from '@pdf-editor/document-model';
import type { ConvertHeading } from '@pdf-editor/engine';

type Building = Omit<OutlineNode, 'children'> & { children: Building[] };

/** The tree for `headings`; `pageIds[i]` is the id of page `i`. Headings off the document are dropped. */
export function outlineFromHeadings(
  headings: readonly ConvertHeading[],
  pageIds: readonly PageId[],
): OutlineNode[] {
  const roots: Building[] = [];
  const stack: { level: number; node: Building }[] = [];
  for (const heading of headings) {
    const page = pageIds[heading.page];
    const title = heading.text.replace(/\s+/g, ' ').trim();
    if (page === undefined || title === '') continue;
    while (stack.length > 0 && (stack[stack.length - 1]?.level ?? 0) >= heading.level) stack.pop();
    const node: Building = { ...outlineItem(title, { kind: 'page', page }), children: [] };
    (stack[stack.length - 1]?.node.children ?? roots).push(node);
    stack.push({ level: heading.level, node });
  }
  return roots;
}
