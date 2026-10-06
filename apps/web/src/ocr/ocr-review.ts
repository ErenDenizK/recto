/**
 * The review of a document's low-confidence OCR words (spec recognize-and-compare §1.3; spec
 * X33): Review's Words to check (`shell/review/WordsToCheck.tsx`) lists them by page, and
 * J / K step through them while it shows. The focused word is brought into view and ringed on
 * its page (OcrLayer.tsx); rows and focus come from the model's `ocr.apply` edits
 * (ocr-model.ts). The inspector's OCR section, which reviewed one page at a time, is gone
 * (spec D2-9): its page facts are Words to check's page rows.
 */
import type { VirtualDocument, VirtualPage, Workspace } from '@pdf-editor/document-model';

import { formatNumber, formatPercent, m } from '../i18n';
import { announce } from '../shell/announcer';
import { isPageView, useUiStore } from '../state/ui-store';
import { useViewStore } from '../state/view-store';
import { useWorkspaceStore } from '../state/workspace-store';
import {
  lowConfidenceRows,
  type OcrPageRecord,
  type OcrThresholds,
  type OcrWordRow,
  ocrRecords,
  recordKey,
  stepRow,
} from './ocr-model';
import { setOcrFocus, useOcrStore } from './ocr-store';
import { ocrThresholdsNow } from './ocr-thresholds';

/** A recognised page of a document and its record. */
export interface OcrSectionPage {
  readonly doc: VirtualDocument;
  readonly docIndex: number;
  readonly page: VirtualPage;
  readonly record: OcrPageRecord | undefined;
}

/** Focuses a word row: ring on the page, the page scrolled so the word is in view. */
export function focusOcrWord(section: OcrSectionPage, row: OcrWordRow): void {
  const { page, record } = section;
  if (!record) return;
  setOcrFocus({
    pageId: page.id,
    source: record.source,
    pageIndex: record.pageIndex,
    word: row.index,
    rect: row.rect,
  });
  useViewStore.getState().scrollToPage(page.id, { reveal: row.rect });
}

/** One word to check and the page it is on (the Review section's Words to check, X33). */
export interface DocumentWord {
  readonly section: OcrSectionPage & { readonly record: OcrPageRecord };
  readonly row: OcrWordRow;
}

/**
 * Every low-confidence word of the active document's recognised pages, in page then reading
 * order: the Review section's Words to check (06-navigation N5, spec X33) and its J / K.
 */
export function documentWords(ws: Workspace, t: OcrThresholds): DocumentWord[] {
  const doc = ws.activeDocument === undefined ? undefined : ws.documents[ws.activeDocument];
  if (!doc) return [];
  const records = ocrRecords(ws.engineEdits, t);
  const out: DocumentWord[] = [];
  const seen = new Set<string>();
  doc.pages.forEach((page, docIndex) => {
    if (page.ref.kind !== 'source') return;
    const key = recordKey(page.ref.source, page.ref.index);
    const record = records.get(key);
    // A source page shown twice is checked once, where it first appears.
    if (!record || seen.has(key)) return;
    seen.add(key);
    for (const row of lowConfidenceRows(record, t)) {
      out.push({ section: { doc, docIndex, page, record }, row });
    }
  });
  return out;
}

/** Whether the sidebar shows Review's Words to check (J / K then walk the whole document). */
export function showingWordsToCheck(): boolean {
  const ui = useUiStore.getState();
  return ui.leftPanelOpen && ui.leftPanelView === 'review' && ui.reviewFilter === 'words';
}

/**
 * Opens the sidebar's Review on Words to check (spec X33): S10's Show results and the OCR
 * toast's Review.
 */
export function showWordsToCheck(): void {
  useUiStore.setState({ leftPanelOpen: true, leftPanelView: 'review', reviewFilter: 'words' });
}

/** Whether J / K review OCR words: the page view, Words to check showing, some words. */
export function reviewingOcr(): boolean {
  if (!isPageView(useUiStore.getState()) || !showingWordsToCheck()) return false;
  const t = ocrThresholdsNow();
  return t !== undefined && documentWords(useWorkspaceStore.getState().workspace, t).length > 0;
}

/** J / K: the next or previous word to check of the document. */
export function stepOcrWord(delta: 1 | -1): boolean {
  const t = ocrThresholdsNow();
  if (!t || !showingWordsToCheck()) return false;
  const words = documentWords(useWorkspaceStore.getState().workspace, t);
  const focus = useOcrStore.getState().focus;
  const current = words.findIndex(
    (w) => w.section.page.id === focus?.pageId && w.row.index === focus.word,
  );
  const next = words[stepRow(words.length, current, delta)];
  if (!next) {
    announce(m.ocr_no_low_words());
    return false;
  }
  focusOcrWord(next.section, next.row);
  announce(
    m.ocr_word_announce({
      index: formatNumber(words.indexOf(next) + 1),
      total: formatNumber(words.length),
      word: next.row.text,
      confidence: formatPercent(Math.round(next.row.confidence) / 100),
    }),
  );
  return true;
}
