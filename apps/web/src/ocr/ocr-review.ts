/**
 * The page the OCR section describes and the review of its low-confidence words with J / K
 * (spec recognize-and-compare §1.3): the single selected page of the active document, else
 * the page Read mode shows. The focused word is brought into view and ringed on its page
 * (OcrLayer.tsx); rows and focus come from the model's `ocr.apply` edits (ocr-model.ts).
 */
import type { VirtualDocument, VirtualPage, Workspace } from '@pdf-editor/document-model';

import { formatNumber, formatPercent, m } from '../i18n';
import { announce } from '../shell/announcer';
import { useSelectionStore } from '../state/selection-store';
import { isNavigatorShowing, isPageView, useUiStore } from '../state/ui-store';
import { useViewStore } from '../state/view-store';
import { useWorkspaceStore } from '../state/workspace-store';
import { useToolStore } from '../viewer/tool-store';
import {
  documentHasOcr,
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

/** The page the section shows, and its recognised text when it has any. */
export interface OcrSectionPage {
  readonly doc: VirtualDocument;
  readonly docIndex: number;
  readonly page: VirtualPage;
  readonly record: OcrPageRecord | undefined;
}

export function sectionPageOf(
  ws: Workspace,
  selected: ReadonlySet<string>,
  currentPage: number,
  t: OcrThresholds,
): OcrSectionPage | undefined {
  const doc = ws.activeDocument === undefined ? undefined : ws.documents[ws.activeDocument];
  if (!doc || doc.pages.length === 0) return undefined;
  const picked = doc.pages.flatMap((p, i) => (selected.has(p.id) ? [i] : []));
  const docIndex =
    picked.length === 1 ? (picked[0] as number) : Math.min(currentPage, doc.pages.length - 1);
  const page = doc.pages[docIndex];
  if (!page) return undefined;
  const record =
    page.ref.kind === 'source'
      ? ocrRecords(ws.engineEdits, t).get(recordKey(page.ref.source, page.ref.index))
      : undefined;
  return { doc, docIndex, page, record };
}

function currentSectionPage(t: OcrThresholds): OcrSectionPage | undefined {
  return sectionPageOf(
    useWorkspaceStore.getState().workspace,
    useSelectionStore.getState().selected,
    useViewStore.getState().currentPage,
    t,
  );
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

/** Whether J / K review OCR words: Read mode, the panel open, a page with such words. */
export function reviewingOcr(): boolean {
  const ui = useUiStore.getState();
  if (!isPageView(ui)) return false;
  if (showingWordsToCheck()) {
    const t = ocrThresholdsNow();
    return t !== undefined && documentWords(useWorkspaceStore.getState().workspace, t).length > 0;
  }
  if (!ui.rightPanelOpen) return false;
  // The Redactions panel's review keeps J / K while it is open or the Redact tool is on.
  if (isNavigatorShowing(ui, 'redactions')) return false;
  if (useToolStore.getState().mode === 'redact') return false;
  const t = ocrThresholdsNow();
  if (!t) return false;
  const section = currentSectionPage(t);
  if (!section?.record) return false;
  if (!documentHasOcr(useWorkspaceStore.getState().workspace.engineEdits, section.doc)) {
    return false;
  }
  return lowConfidenceRows(section.record, t).length > 0;
}

/** J / K through the document's words to check (Review's Words to check). */
function stepDocumentWord(t: OcrThresholds, delta: 1 | -1): boolean {
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

/** J / K: the next or previous low-confidence word of the section's page. */
export function stepOcrWord(delta: 1 | -1): boolean {
  const t = ocrThresholdsNow();
  if (!t) return false;
  if (showingWordsToCheck()) return stepDocumentWord(t, delta);
  const section = currentSectionPage(t);
  if (!section?.record) return false;
  const rows = lowConfidenceRows(section.record, t);
  const focus = useOcrStore.getState().focus;
  const current =
    focus?.pageId === section.page.id ? rows.findIndex((r) => r.index === focus.word) : -1;
  const next = rows[stepRow(rows.length, current, delta)];
  if (!next) {
    announce(m.ocr_no_low_words());
    return false;
  }
  focusOcrWord(section, next);
  announce(
    m.ocr_word_announce({
      index: formatNumber(rows.indexOf(next) + 1),
      total: formatNumber(rows.length),
      word: next.text,
      confidence: formatPercent(Math.round(next.confidence) / 100),
    }),
  );
  return true;
}
