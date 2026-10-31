/**
 * Runs a reading (decision PRD-39, PRD-40; spec niyet §2.12, §2.13). Nothing here runs unless the
 * preview on screen is still true: the key of what was shown must equal the key of the reading
 * drawn again from the stores now, so a document changed underneath (a toast's Undo) or text
 * typed since never runs. Every step is guarded before the first one changes anything; the
 * document steps then commit as one history entry with one Undo toast, and only after that the
 * finishing step opens its tool, sheet or Save a copy in the same task as Enter (pickers keep
 * the user activation). A palette that writes no file by itself: outputs open Save a copy set up.
 */
import { type DocumentId, getActiveDocument, type PageId } from '@pdf-editor/document-model';

import { openRecent } from '../../home/home-actions';
import { useRecentsStore } from '../../files/recents';
import { openSaveCopy, type SaveCopyRequest } from '../../export/export-store';
import { m } from '../../i18n';
import { openFurnitureDialog } from '../../furniture/furniture-store';
import { openMarkupDoor } from '../../markup/doors';
import { findSensitiveData } from '../../redaction/review';
import { showRedactionsPanel } from '../../redaction/commands';
import { defaultPartTitles } from '../../stage/section-operations';
import { useSelectionStore } from '../../state/selection-store';
import { useViewStore } from '../../state/view-store';
import { useWorkspaceStore } from '../../state/workspace-store';
import { toast } from '../../ui/Toast';
import { goToPageIndex } from '../../viewer/navigation';
import { openFind, runSearch, setSearchQuery } from '../../viewer/search';
import { commandRegistry } from '../registry';
import { gatherIntentContext, workspaceVersion } from './context';
import {
  composeSteps,
  documentStepsOf,
  finishingStepOf,
  isNavigateStep,
  rangeText,
  stepPages,
} from './plan';
import { guardReason, historyLabel, previewOf } from './preview';
import type { Reading, Step } from './types';

export type RunResult = 'ran' | 'stale' | 'refused';

/** The request Save a copy opens with for an output step (PRD-40), or null for a plain open. */
function requestOf(step: Step, pageCount: number): SaveCopyRequest | null {
  switch (step.action) {
    case 'compress':
      return step.targetBytes === null ? 'size' : { kind: 'size', targetBytes: step.targetBytes };
    case 'exportImages':
      return { kind: 'images', type: step.format, range: rangeText(step.pages, pageCount) };
    case 'exportText':
      return { kind: 'text', format: step.format };
    default:
      return null;
  }
}

/** Selects `ids` as the navigator's, runs `run`, and gives the selection back (as the old palette did). */
async function withSelection(
  docId: DocumentId,
  ids: readonly PageId[],
  run: () => Promise<unknown>,
): Promise<void> {
  const selection = useSelectionStore.getState();
  const before = {
    selected: selection.selected,
    anchor: selection.anchor,
    focused: selection.focused,
  };
  const navigator = selection.navigatorDocument;
  selection.apply({ selected: new Set(ids), anchor: ids[0] ?? null, focused: ids[0] ?? null });
  selection.setNavigatorDocument(docId);
  try {
    await run();
  } finally {
    const now = useSelectionStore.getState();
    now.setNavigatorDocument(navigator);
    now.apply(before);
  }
}

/** Runs one finishing or navigate step (§2.12 steps 4 and 5). */
async function runLast(step: Step, pageCount: number): Promise<void> {
  const ws = useWorkspaceStore.getState().workspace;
  const doc = getActiveDocument(ws);
  switch (step.action) {
    case 'goto':
      goToPageIndex(step.page - 1);
      return;
    case 'heading': {
      const first = step.matches[0];
      if (first) goToPageIndex(first.page - 1);
      return;
    }
    case 'recent': {
      const match = step.matches[0];
      const entry = useRecentsStore.getState().entries.find((e) => e.id === match?.id);
      if (entry) await openRecent(entry);
      return;
    }
    case 'find':
      setSearchQuery(step.text);
      openFind();
      await runSearch(doc, useViewStore.getState().currentPage);
      return;
    case 'extract': {
      if (!doc) return;
      const ids = step.pages.pages.flatMap((n) => (doc.pages[n - 1] ? [doc.pages[n - 1]!.id] : []));
      await withSelection(doc.id, ids, () => commandRegistry.execute('pages.extract'));
      return;
    }
    case 'signPlace':
      goToPageIndex(step.page - 1);
      await commandRegistry.execute('tool.signature');
      return;
    case 'redactFind':
      if (!doc) return;
      await commandRegistry.execute('mode.read');
      showRedactionsPanel();
      void findSensitiveData(doc, step.patterns);
      return;
    case 'split':
      await commandRegistry.execute('section.split');
      return;
    case 'watermark':
      if (doc) openFurnitureDialog('watermark', doc.id);
      return;
    case 'fill':
      openMarkupDoor('sign');
      return;
    case 'compress':
    case 'exportImages':
    case 'exportText':
      if (doc) openSaveCopy(doc.id, requestOf(step, pageCount));
      return;
    case 'saveCopy':
      await commandRegistry.execute('file.export');
      return;
    case 'print':
      await commandRegistry.execute('file.print');
      return;
    case 'combine':
      await commandRegistry.execute('documents.mergeAll');
      return;
    case 'certify':
      await commandRegistry.execute('document.sign');
      return;
    case 'ocr':
      await commandRegistry.execute('document.ocr');
      return;
    case 'password':
      await commandRegistry.execute('document.setPassword');
      return;
    case 'officeToPdf':
      await commandRegistry.execute('file.open');
      return;
    default:
      return;
  }
}

/**
 * Runs `reading` if `shownKey` (the key of the preview on screen, drawn from `text`) still
 * describes it now: 'stale' when the document or the text moved, 'refused' when a guard says no
 * or the commit changed nothing (then no later step runs), else 'ran'.
 */
export async function runReading(
  reading: Reading,
  shownKey: string,
  text = '',
): Promise<RunResult> {
  const ctx = gatherIntentContext();
  const shown = previewOf(reading, ctx, workspaceVersion(), text);
  if (shown.key !== shownKey) return 'stale';
  if (!shown.runnable || guardReason(reading) !== undefined) return 'refused';

  const doc = getActiveDocument(useWorkspaceStore.getState().workspace);
  const documentSteps = documentStepsOf(reading);
  if (documentSteps.length > 0) {
    if (!doc) return 'refused';
    const hasSplit = documentSteps.some((step) => step.action === 'split');
    let operation;
    try {
      operation = composeSteps(doc, documentSteps, defaultPartTitles);
    } catch {
      return 'refused';
    }
    const committed = useWorkspaceStore
      .getState()
      .applyOperation(operation, () => historyLabel(reading, ctx));
    if (!committed) return 'refused';
    toast.undo(m.toast_intent_done({ count: documentSteps.length }), {
      ...(hasSplit ? {} : { documentId: doc.id }),
    });
    // Show the first page the sentence changed when it is not the one in view.
    const first = documentSteps.map(stepPages).find((p) => p !== undefined)?.pages[0];
    const survivor = first === undefined ? undefined : doc.pages[first - 1];
    const now = getActiveDocument(useWorkspaceStore.getState().workspace);
    const index =
      survivor === undefined ? -1 : (now?.pages.findIndex((p) => p.id === survivor.id) ?? -1);
    if (index >= 0 && index !== useViewStore.getState().currentPage) goToPageIndex(index);
  }

  // Pages in the sentence are positions as previewed, so "every page" is judged by that count.
  const last = finishingStepOf(reading) ?? reading.steps.find(isNavigateStep);
  if (last !== undefined) await runLast(last, ctx.pageCount);
  return 'ran';
}
