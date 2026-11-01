/**
 * The plan of a reading (decision PRD-39; spec niyet §2.9, §2.12): which of its steps change the
 * document, which one finishes the sentence, and the one composed model operation the document
 * steps run as, so a whole sentence is one history entry and one Undo takes it all back. Pure:
 * no store imports, so `preview.ts` and the tests share it with `run.ts`.
 *
 * Page numbers in the steps are 1-based positions in the document as the preview was drawn.
 * `composeSteps` turns them (and a split's cut points) into page ids before anything runs, so
 * `son sayfayı sil ve 1. sayfayı döndür` acts on the pages it showed whatever the order does to
 * the positions after it; `pageIdsOf` and `relocateStep` do the same for the finishing step,
 * which runs after the commit has moved the pages.
 */
import type { PageId, VirtualDocument } from '@pdf-editor/document-model';

import { ALL_PAGES, type RangeChoice } from '../../furniture/furniture-model';
import { FAMILY, type Pages, type Reading, type Step } from './types';

export type SplitStep = Extract<Step, { action: 'split' }>;

/** A step that changes the document and commits with the others as one entry (§2.1). */
export function isDocumentStep(step: Step): boolean {
  if (step.action === 'watermark') return step.text !== null;
  if (step.action === 'split') return step.how !== 'choose';
  return FAMILY[step.action] === 'document';
}

/** A step that moves the view or the search and commits nothing. */
export function isNavigateStep(step: Step): boolean {
  return FAMILY[step.action] === 'navigate';
}

/** A step that opens a tool, a sheet or Save a copy (§2.1): at most one, run last. */
export function isFinishingStep(step: Step): boolean {
  return !isDocumentStep(step) && !isNavigateStep(step) && step.action !== 'unavailable';
}

/** The document steps of a reading, in typed (run) order. */
export function documentStepsOf(reading: Reading): Step[] {
  return reading.steps.filter(isDocumentStep);
}

/** The step that finishes the sentence, or undefined. */
export function finishingStepOf(reading: Reading): Step | undefined {
  return reading.steps.find(isFinishingStep);
}

/** The pages a step names, or undefined for a step without any. */
export function stepPages(step: Step): Pages | undefined {
  return 'pages' in step ? step.pages : undefined;
}

/**
 * The commands that open what a finishing step finishes with (§2.12 step 2), by action: the
 * runner asks the registry whether each may run before it changes anything.
 */
export function commandOf(step: Step): string | null {
  switch (step.action) {
    case 'compress':
      return 'document.compress';
    case 'exportImages':
      return 'document.exportImages';
    case 'exportText':
      return 'document.exportMarkdown';
    case 'saveCopy':
      return 'file.export';
    case 'print':
      return 'file.print';
    case 'extract':
      return 'pages.extract';
    case 'combine':
      return 'documents.mergeAll';
    case 'signPlace':
      return 'tool.signature';
    case 'certify':
      return 'document.sign';
    case 'ocr':
      return 'document.ocr';
    case 'password':
      return 'document.setPassword';
    case 'officeToPdf':
      return 'file.open';
    case 'split':
      return step.how === 'choose' ? 'section.split' : null;
    default:
      return null;
  }
}

/** The change guard's act of a document step: structure is `pages`, furniture `document`. */
export function actOf(step: Step): 'pages' | 'document' {
  return step.action === 'pageNumbers' || step.action === 'watermark' ? 'document' : 'pages';
}

/** Whether the pages are every page of a document of `count` pages. */
export const coversAll = (pages: Pages, count: number): boolean =>
  count > 0 && pages.pages.length === count;

/**
 * The furniture range of a page set (`RangeChoice`): all, even, odd or one run; null for a list
 * with gaps, which furniture cannot take (`not-a-run`, §2.9). "All" is what the sentence said
 * (`named === 'all'`), not a length match: earlier steps of the chain may add or remove pages, and
 * `count` is the document the range is applied to.
 */
export function rangeChoiceOf(pages: Pages, count: number): RangeChoice | null {
  const list = pages.pages;
  if (list.length === 0) return null;
  if (pages.named === 'all') return { ...ALL_PAGES, to: Math.max(1, count) };
  const first = list[0] as number;
  const last = list.at(-1) as number;
  if (pages.named === 'even' || pages.named === 'odd') {
    return { mode: pages.named, from: first, to: last };
  }
  if (last - first === list.length - 1) return { mode: 'custom', from: first, to: last };
  return null;
}

/** "2, 4, 6-8": the 1-based page range text of Save a copy's Images section; "" for every page. */
export function rangeText(pages: Pages): string {
  if (pages.named === 'all') return '';
  const parts: string[] = [];
  const list = pages.pages;
  for (let i = 0; i < list.length; ) {
    let j = i;
    while (j + 1 < list.length && list[j + 1] === (list[j] ?? 0) + 1) j++;
    parts.push(j > i ? `${list[i]}-${list[j]}` : `${list[i]}`);
    i = j + 1;
  }
  return parts.join(', ');
}

/** The page ids at 1-based `positions` of `doc`; throws when the document no longer has them. */
export function idsAt(doc: VirtualDocument, positions: readonly number[]): PageId[] {
  return positions.map((position) => {
    const page = doc.pages[position - 1];
    if (page === undefined) throw new Error(`Page ${position} is not in this document`);
    return page.id;
  });
}

/** The page ids a finishing step names, as `doc` (the preview's document) shows them. */
export function pageIdsOf(step: Step, doc: VirtualDocument | undefined): PageId[] | null {
  const positions =
    step.action === 'signPlace'
      ? [step.page]
      : step.action === 'extract' || step.action === 'exportImages' || step.action === 'delete'
        ? step.pages.pages
        : [];
  if (positions.length === 0) return [];
  if (doc === undefined) return null;
  try {
    return idsAt(doc, positions);
  } catch {
    return null;
  }
}

/**
 * The step with its pages found again in `now` by `ids` (from `pageIdsOf`), after the document
 * steps moved them; null when one of the pages is gone.
 */
export function relocateStep(
  step: Step,
  ids: readonly PageId[],
  now: VirtualDocument | undefined,
): Step | null {
  if (ids.length === 0) return step;
  // "All" is every page once the document steps have run.
  if ((step.action === 'extract' || step.action === 'exportImages') && step.pages.named === 'all') {
    const every = (now?.pages ?? []).map((_, i) => i + 1);
    return { ...step, pages: { ...step.pages, pages: every } };
  }
  const at = ids.map((id) => (now?.pages.findIndex((page) => page.id === id) ?? -1) + 1);
  if (at.includes(0)) return null;
  if (step.action === 'signPlace') return { ...step, page: at[0] as number };
  if (step.action === 'extract' || step.action === 'exportImages') {
    return { ...step, pages: { ...step.pages, pages: [...at].sort((a, b) => a - b) } };
  }
  return step;
}

/** The ids of the pages the delete steps among `steps` remove, found in `doc` (as previewed). */
export function deletedIdsOf(doc: VirtualDocument, steps: readonly Step[]): Set<PageId> {
  const gone = new Set<PageId>();
  for (const step of steps) {
    if (step.action !== 'delete') continue;
    const ids =
      step.pages.named === 'all' ? doc.pages.map((page) => page.id) : (pageIdsOf(step, doc) ?? []);
    for (const id of ids) gone.add(id);
  }
  return gone;
}

/** Whether a split is followed by a finishing step: the finishing step would open on part 1. */
export function finishesAfterSplit(reading: Reading): boolean {
  return (
    documentStepsOf(reading).some((step) => step.action === 'split') &&
    finishingStepOf(reading) !== undefined
  );
}
