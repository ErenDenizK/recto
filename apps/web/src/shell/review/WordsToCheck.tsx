/**
 * Review's Words to check (`components/06-navigation.md` N5; spec X33, which re-homes the
 * inspector's OCR section here): after OCR has run on the document, its low-confidence words
 * grouped by page, each page heading with its quality word (Good · Review · Poor · No text).
 * A row (or J / K, `ocr/ocr-review.ts`) scrolls to the word and rings it on the page
 * (`05-canvas` §27); nothing changes, so it works locked.
 *
 * The filter appears once OCR has run on the document and stays for the session
 * (`useHasWordsToCheck`), so undoing the run leaves an empty filter rather than a chip that
 * vanishes under the pointer.
 */
import type { DocumentId, VirtualDocument } from '@pdf-editor/document-model';

import { formatPercent, m } from '../../i18n';
import { qualityLabel } from '../../ocr/labels';
import { documentHasOcr, documentQualityRows, ocrRecords } from '../../ocr/ocr-model';
import { type DocumentWord, documentWords, focusOcrWord } from '../../ocr/ocr-review';
import { useOcrStore } from '../../ocr/ocr-store';
import { useOcrThresholds } from '../../ocr/ocr-thresholds';
import { useWorkspaceStore } from '../../state/workspace-store';
import { EmptyNote } from '../../ui/EmptyNote';
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
  /** Pages of the document with recognised text. */
  readonly recognised: number;
}

/** The words to check of the active document (none until the thresholds load). */
export function useDocumentWords(): WordsToCheckData {
  const ws = useWorkspaceStore((s) => s.workspace);
  const thresholds = useOcrThresholds();
  const doc = ws.activeDocument === undefined ? undefined : ws.documents[ws.activeDocument];
  if (!thresholds || !doc) return { words: [], recognised: 0 };
  return {
    words: documentWords(ws, thresholds),
    recognised: documentQualityRows(doc, ocrRecords(ws.engineEdits, thresholds)).length,
  };
}

const percent = (value: number) => formatPercent(Math.round(value) / 100);

export function WordsToCheck({ data }: { readonly data: WordsToCheckData }) {
  const focus = useOcrStore((s) => s.focus);
  const { words, recognised } = data;
  if (words.length === 0) {
    return (
      <div className={styles.empty}>
        <EmptyNote
          title={m.review_words_empty()}
          body={recognised > 0 ? m.review_words_recognised({ count: recognised }) : undefined}
        />
      </div>
    );
  }
  const groups: { key: string; words: DocumentWord[] }[] = [];
  for (const word of words) {
    const last = groups[groups.length - 1];
    if (last?.key === word.section.page.id) last.words.push(word);
    else groups.push({ key: word.section.page.id, words: [word] });
  }
  return (
    <div className={styles.scroll} data-testid="review-words">
      {groups.map((group) => {
        const first = group.words[0];
        if (!first) return null;
        const page = m.comments_page({ page: first.section.docIndex + 1 });
        return (
          <section key={group.key} className={styles.group} aria-label={page}>
            <h3 className={styles.pageTitle}>
              {page} · {qualityLabel(first.section.record.quality)}
            </h3>
            <ul className={styles.list}>
              {group.words.map((word) => {
                const current =
                  focus?.pageId === word.section.page.id && focus.word === word.row.index;
                return (
                  <li key={word.row.index}>
                    <button
                      type="button"
                      className={styles.wordRow}
                      aria-current={current ? 'true' : undefined}
                      data-sidebar-current={current ? '' : undefined}
                      data-testid="review-word"
                      onClick={() => focusOcrWord(word.section, word.row)}
                    >
                      <span className={styles.word}>“{word.row.text}”</span>
                      <span className={styles.wordMeta}>
                        {m.review_words_low({ confidence: percent(word.row.confidence) })}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      <p className={styles.wordsSummary}>{m.review_words_recognised({ count: recognised })}</p>
    </div>
  );
}
