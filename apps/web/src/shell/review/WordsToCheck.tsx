/**
 * Review's Words to check (`components/06-navigation.md` N5; spec X33, which re-homes the
 * inspector's OCR section here; spec D2-9): after OCR has run on the document, every
 * recognised page in page order, its heading with the quality word and mean confidence
 * (Good · Review · Poor · No text) and a line with its languages, resolution and word count,
 * then its low-confidence words. A page heading goes to the page; a word (or J / K,
 * `ocr/ocr-review.ts`) scrolls to it and rings it on the page (`05-canvas` §27). Nothing
 * changes, so it works locked. Under the list, the pages by quality ("Good: 3 · Review: 1").
 *
 * The filter appears once OCR has run on the document and stays for the session
 * (`useHasWordsToCheck`), so undoing the run leaves an empty filter rather than a chip that
 * vanishes under the pointer.
 */
import type { DocumentId, VirtualDocument } from '@pdf-editor/document-model';

import { formatNumber, formatPercent, getLocale, m } from '../../i18n';
import { qualityLabel } from '../../ocr/labels';
import {
  countByQuality,
  documentHasOcr,
  documentQualityRows,
  languageList,
  type OcrPageRow,
  ocrRecords,
  QUALITY_ORDER,
} from '../../ocr/ocr-model';
import { type DocumentWord, documentWords, focusOcrWord } from '../../ocr/ocr-review';
import { useOcrStore } from '../../ocr/ocr-store';
import { useOcrThresholds } from '../../ocr/ocr-thresholds';
import { useViewStore } from '../../state/view-store';
import { useWorkspaceStore } from '../../state/workspace-store';
import { EmptyNote } from '../../ui/EmptyNote';
import { ListRow } from '../../ui/ListRow';
import styles from './ReviewPanel.module.css';

/** Documents OCR has run on in this session (the filter stays, X33). */
const recognised = new Set<DocumentId>();

/** Whether Review offers Words to check for `doc`. */
export function useHasWordsToCheck(doc: VirtualDocument | undefined): boolean {
  const edits = useWorkspaceStore((s) => s.workspace.engineEdits);
  if (!doc) return false;
  if (documentHasOcr(edits, doc)) recognised.add(doc.id);
  return recognised.has(doc.id);
}

export interface WordsToCheckData {
  readonly words: readonly DocumentWord[];
  /** The document's recognised pages, in page order. */
  readonly pages: readonly OcrPageRow[];
  /** Pages of the document with recognised text. */
  readonly recognised: number;
}

/** The words to check of the active document (none until the thresholds load). */
export function useDocumentWords(): WordsToCheckData {
  const ws = useWorkspaceStore((s) => s.workspace);
  const thresholds = useOcrThresholds();
  const doc = ws.activeDocument === undefined ? undefined : ws.documents[ws.activeDocument];
  if (!thresholds || !doc) return { words: [], pages: [], recognised: 0 };
  const pages = documentQualityRows(doc, ocrRecords(ws.engineEdits, thresholds)).sort(
    (a, b) => a.docIndex - b.docIndex,
  );
  return { words: documentWords(ws, thresholds), pages, recognised: pages.length };
}

const percent = (value: number) => formatPercent(Math.round(value) / 100);

export function WordsToCheck({ data }: { readonly data: WordsToCheckData }) {
  const focus = useOcrStore((s) => s.focus);
  const { words, pages, recognised } = data;
  const locale = getLocale();
  const byPage = new Map<string, DocumentWord[]>();
  for (const word of words) {
    const list = byPage.get(word.section.page.id);
    if (list) list.push(word);
    else byPage.set(word.section.page.id, [word]);
  }
  const counts = countByQuality(pages);
  const qualities = QUALITY_ORDER.filter((q) => counts[q] > 0)
    .map((q) => `${qualityLabel(q)}: ${formatNumber(counts[q])}`)
    .join(' · ');
  return (
    <div className={styles.scroll} data-testid="review-words">
      {words.length === 0 ? (
        <div className={styles.empty}>
          <EmptyNote title={m.review_words_empty()} />
        </div>
      ) : null}
      {pages.map((row) => {
        const page = m.comments_page({ page: row.docIndex + 1 });
        const { record } = row;
        const facts = [
          languageList(record.languages, locale),
          record.dpi === undefined ? undefined : m.ocr_dpi({ dpi: formatNumber(record.dpi) }),
          m.review_words_count({ count: record.words.length }),
        ].filter(Boolean);
        const pageWords = byPage.get(row.pageId) ?? [];
        return (
          <section
            key={row.pageId}
            className={styles.group}
            aria-label={page}
            data-testid="review-words-page"
            data-quality={record.quality}
          >
            <ListRow
              className={styles.pageRow}
              onClick={() => useViewStore.getState().scrollToPage(row.pageId)}
            >
              <span className={styles.pageRowTitle}>
                {page} · {qualityLabel(record.quality)}
              </span>
              {record.words.length > 0 ? (
                <span className={styles.wordMeta}>{percent(record.meanConfidence)}</span>
              ) : null}
            </ListRow>
            <p className={styles.pageFacts}>{facts.join(' · ')}</p>
            {pageWords.length > 0 ? (
              <ul className={styles.list}>
                {pageWords.map((word) => {
                  const current =
                    focus?.pageId === word.section.page.id && focus.word === word.row.index;
                  return (
                    <li key={word.row.index}>
                      <ListRow
                        className={styles.wordRow}
                        current={current}
                        data-sidebar-current={current ? '' : undefined}
                        data-testid="review-word"
                        onClick={() => focusOcrWord(word.section, word.row)}
                      >
                        <span className={styles.word}>“{word.row.text}”</span>
                        <span className={styles.wordMeta}>
                          {m.review_words_low({ confidence: percent(word.row.confidence) })}
                        </span>
                      </ListRow>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </section>
        );
      })}
      {recognised > 0 ? (
        <p className={styles.wordsSummary}>
          {m.review_words_recognised({ count: recognised })}
          {qualities === '' ? '' : ` · ${qualities}`}
        </p>
      ) : null}
    </div>
  );
}
