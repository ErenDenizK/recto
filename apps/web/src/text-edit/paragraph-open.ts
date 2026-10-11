/**
 * Opening the paragraph editor (craft spec §4.2, §4.7): from a detected paragraph, or from a
 * clicked run (the paragraph editor when the run belongs to a paragraph that does not refuse
 * paragraph mode, else the line editor, T6). Opening only sets the store's session; the editor
 * itself (`ParagraphEditor.tsx`, with the glyph canvas and the engine fonts) is its own chunk,
 * loaded by the page layer that shows it (`ParagraphEditSlot.tsx`; on phones the Edit text
 * chunk, EDN-17), so neither edition carries it before it is wanted.
 */
import type { ParagraphBlock, ParagraphRef } from '@pdf-editor/engine';

import type { PageTarget } from '../annotations/annotation-store';
import { offsetNearPoint, paragraphOfRun } from './paragraph-model';
import { pageRevision } from './runs';
import { pageParagraphs, type TextEditSession, useTextEditStore } from './text-edit-store';

/**
 * Opens the paragraph editor on `page` for the detected paragraph `blockRef` (its index in
 * the page's analysis), with the caret nearest `point` (unrotated user space). Resolves to
 * false, with nothing opened, when the paragraph is not found at the page's current state or
 * refuses paragraph mode.
 */
export async function openParagraphEditor(
  page: PageTarget,
  blockRef: Pick<ParagraphRef, 'index'>,
  point: { readonly x: number; readonly y: number },
): Promise<boolean> {
  const revision = pageRevision(page.source, page.pageIndex);
  let blocks: readonly ParagraphBlock[];
  try {
    blocks = await pageParagraphs(page.source, page.pageIndex);
  } catch (error) {
    console.warn('Detecting the paragraphs failed', error);
    return false;
  }
  if (pageRevision(page.source, page.pageIndex) !== revision) return false;
  const block = blocks.find((b) => b.ref.index === blockRef.index);
  if (!block || block.refusal) return false;
  useTextEditStore.getState().openParagraph({
    target: page,
    block,
    revision,
    caret: offsetNearPoint(block, point),
    point,
  });
  return true;
}

/**
 * Opens the editor for a clicked run: the paragraph editor when the run belongs to a
 * detected paragraph that does not refuse paragraph mode, else the line editor (as today).
 */
export async function openRunEditor(session: TextEditSession): Promise<'paragraph' | 'line'> {
  const { target, run, revision, selection } = session;
  const line = () => {
    useTextEditStore.getState().open(session);
    return 'line' as const;
  };
  let blocks: readonly ParagraphBlock[];
  try {
    blocks = await pageParagraphs(target.source, target.pageIndex);
  } catch (error) {
    console.warn('Detecting the paragraphs failed', error);
    return line();
  }
  if (pageRevision(target.source, target.pageIndex) !== revision) return line();
  const found = paragraphOfRun(blocks, run, selection.start);
  if (!found || found.block.refusal) return line();
  useTextEditStore.getState().openParagraph({
    target,
    block: found.block,
    revision,
    caret: found.offset,
    fallback: session,
  });
  return 'paragraph';
}
