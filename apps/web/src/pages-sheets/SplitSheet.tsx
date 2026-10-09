/**
 * S13 Split (`components/07-sheets.md` §15): cut a document into several. A tool sheet over the
 * Pages grid: opening it shows the grid (by its view change), and the grid draws a cut line
 * before each part's first page with "2 of 3" (`split-preview.ts`), live as the choice changes.
 *
 * - **How:** Every n pages · Page ranges · At top-level bookmarks · Before each selected page,
 *   with the n or the ranges in a field under the choice. Problems are said under the field
 *   (empty, syntax, out of range, overlap), never by a red wash.
 * - **Primary:** "Split into 3". Guard `pages` (the original keeps only the pages outside the
 *   ranges, X32): a locked document shows the sheet's lock banner and a dimmed primary.
 * - **Commit:** the parts open as tabs, one undo step, "Split into 3 documents · Undo".
 * - The choice is kept per document for the session (07 §1.1 rule 5).
 */
import type { DocumentId, SplitSpec } from '@pdf-editor/document-model';
import { useEffect, useId, useState } from 'react';

import { formatNumber, m } from '../i18n';
import { openTitleMenu } from '../shell/frame/frame-store';
import {
  defaultChunkSize,
  outlineCuts,
  parsePageRanges,
  previewSplit,
  selectionCuts,
  type SplitPreview,
} from '../stage/operation-plans';
import { enterGrid } from '../stage/grid/grid-transition';
import { splitSection } from '../stage/section-operations';
import { useChangeRefusal } from '../state/guard';
import { useSelectionStore } from '../state/selection-store';
import { stageView, useUiStore } from '../state/ui-store';
import { pagesPhrase, useWorkspaceStore } from '../state/workspace-store';
import { NumberField } from '../ui/NumberField';
import { RadioGroup } from '../ui/RadioGroup';
import { Sheet, SheetField, SheetGroup, SheetRow, useSheetDraft } from '../ui/sheet';
import { toast } from '../ui/Toast/toast';
import styles from './PagesSheets.module.css';
import { rangeProblemMessage } from './range-problems';
import { setSplitPreview } from './split-preview';

type SplitMode = 'every' | 'ranges' | 'outline' | 'selection';

interface SplitDraft {
  readonly mode: SplitMode;
  readonly every: string;
  readonly ranges: string;
}

export const SPLIT_SHEET = 'split';

function sizesList(parts: readonly number[]): string {
  const shown = parts.slice(0, 12).map((n) => formatNumber(n));
  return parts.length > 12 ? `${shown.join(', ')}, …` : shown.join(', ');
}

/** Where each part after the first starts, for the grid's cut lines. */
function cutsOf(spec: SplitSpec | undefined, cuts: readonly number[], pageCount: number): number[] {
  if (spec === undefined) return [];
  if (spec.mode === 'every') {
    const out: number[] = [];
    for (let i = spec.n; i < pageCount; i += spec.n) out.push(i);
    return out;
  }
  if (spec.mode === 'ranges') return spec.ranges.map(([start]) => start).filter((s) => s > 0);
  return [...cuts];
}

export function SplitSheet({
  documentId,
  open,
  onClose,
}: {
  readonly documentId: DocumentId | null;
  readonly open: boolean;
  readonly onClose: () => void;
}) {
  const live = useWorkspaceStore((s) =>
    documentId === null ? undefined : s.workspace.documents[documentId],
  );
  // The split consumes the document; keep showing it while the sheet closes.
  const [kept, setKept] = useState(live);
  if (live && live !== kept) setKept(live);
  const doc = live ?? kept;
  const selected = useSelectionStore((s) => s.selected);
  const refusal = useChangeRefusal(documentId, 'pages');
  const pageCount = doc?.pages.length ?? 0;
  const [draft, setDraft, , restored] = useSheetDraft<SplitDraft>(SPLIT_SHEET, documentId, {
    mode: 'every',
    every: String(defaultChunkSize(pageCount)),
    ranges: '',
  });
  const patch = (next: Partial<SplitDraft>) => setDraft((d) => ({ ...d, ...next }));

  // Split works over the grid (§15 §2): opening it shows the grid at the current page.
  useEffect(() => {
    if (open && stageView(useUiStore.getState()) !== 'grid') enterGrid();
  }, [open]);

  const everyId = useId();
  const outline = doc ? outlineCuts(doc) : { cuts: [], titles: [], bookmarks: 0 };
  const chosenCuts = doc ? selectionCuts(doc, selected) : [];
  const parsed = parsePageRanges(draft.ranges, pageCount);
  const n = Number(draft.every);

  let preview: SplitPreview;
  let spec: SplitSpec | undefined;
  let titles: (string | undefined)[] | undefined;
  let cuts: readonly number[] = [];
  switch (draft.mode) {
    case 'every':
      preview = previewSplit(pageCount, { mode: 'every', n });
      spec = preview.ok ? { mode: 'every', n } : undefined;
      break;
    case 'ranges':
      preview = parsed.ok
        ? previewSplit(pageCount, { mode: 'ranges', ranges: parsed.ranges })
        : { ok: false, reason: 'invalid' };
      spec = parsed.ok && preview.ok ? { mode: 'ranges', ranges: parsed.ranges } : undefined;
      break;
    case 'outline':
      preview = previewSplit(pageCount, { mode: 'cuts', cuts: outline.cuts });
      cuts = outline.cuts;
      spec =
        preview.ok && doc
          ? { mode: 'at-pages', pageIds: outline.cuts.flatMap((i) => doc.pages[i]?.id ?? []) }
          : undefined;
      titles = [...outline.titles];
      break;
    case 'selection':
      preview = previewSplit(pageCount, { mode: 'cuts', cuts: chosenCuts });
      cuts = chosenCuts;
      spec =
        preview.ok && doc
          ? { mode: 'at-pages', pageIds: chosenCuts.flatMap((i) => doc.pages[i]?.id ?? []) }
          : undefined;
      break;
  }
  const parts = preview.ok ? preview.parts.length : 0;
  const lines = cutsOf(spec, cuts, pageCount).filter((cut) => cut > 0 && cut < pageCount);

  // The grid shows the cuts while the sheet is open.
  useEffect(() => {
    if (!open || documentId === null || !preview.ok) {
      setSplitPreview(null);
      return;
    }
    setSplitPreview({ documentId, cuts: lines, parts });
  });
  useEffect(() => () => setSplitPreview(null), []);

  const submit = () => {
    if (documentId === null || !preview.ok || spec === undefined || !doc) return;
    const created = splitSection(documentId, spec, titles);
    if (created.length === 0) return;
    setSplitPreview(null);
    onClose();
    toast.undo(m.split_toast({ count: created.length }), {
      documentId: created[0],
      spoken: false,
    });
  };

  const rangeProblems =
    draft.mode === 'ranges' && draft.ranges.trim().length > 0 && !parsed.ok
      ? parsed.problems.map(rangeProblemMessage)
      : [];
  const summary = preview.ok
    ? [
        m.split_preview({ count: preview.parts.length, sizes: sizesList(preview.parts) }),
        ...(preview.remaining > 0 && doc
          ? [
              m.split_preview_remaining({
                pages: pagesPhrase(preview.remaining),
                title: doc.title,
              }),
            ]
          : []),
      ]
    : [
        preview.reason === 'single-part'
          ? draft.mode === 'outline'
            ? m.split_outline_single()
            : m.split_single_part()
          : draft.mode === 'ranges'
            ? draft.ranges.trim().length === 0
              ? m.range_error_empty()
              : m.split_fix_ranges()
            : m.split_invalid_every(),
      ];

  return (
    <Sheet
      id={SPLIT_SHEET}
      kind="tool"
      open={open && doc !== undefined}
      onClose={onClose}
      title={doc ? m.split_title({ title: doc.title }) : m.split_confirm()}
      subtitle={doc ? pagesPhrase(pageCount) : undefined}
      restored={restored}
      locked={
        refusal?.kind === 'locked' && doc
          ? { name: doc.title, onUnlock: () => openTitleMenu('menu') }
          : undefined
      }
      primary={{
        label: parts > 1 ? m.split_primary({ count: parts }) : m.split_confirm(),
        onPress: submit,
        disabled: !preview.ok,
        reason: preview.ok ? undefined : summary[0],
        reasonRoom: true,
      }}
      testId="split-dialog"
    >
      <SheetGroup label={m.split_mode_label()}>
        <RadioGroup<SplitMode>
          className={styles.choices}
          label={m.split_mode_label()}
          value={draft.mode}
          onValueChange={(mode) => patch({ mode })}
          options={[
            { value: 'every', label: m.split_mode_every_short() },
            { value: 'ranges', label: m.split_mode_ranges() },
            {
              value: 'outline',
              label: m.split_mode_outline(),
              disabled: outline.bookmarks === 0,
              description:
                outline.bookmarks === 0
                  ? m.split_outline_none()
                  : m.split_outline_hint({ count: outline.bookmarks }),
            },
            {
              value: 'selection',
              label: m.split_mode_selection(),
              disabled: chosenCuts.length === 0,
              description:
                chosenCuts.length === 0
                  ? m.split_selection_none()
                  : m.split_selection_hint({ count: chosenCuts.length }),
            },
          ]}
        />
        {draft.mode === 'every' ? (
          <SheetRow title={m.split_every_input_label()} labelFor={everyId}>
            <NumberField
              id={everyId}
              className={styles.number}
              label={m.split_every_input_label()}
              min={1}
              max={Math.max(1, pageCount - 1)}
              value={Number.isFinite(Number(draft.every)) ? Number(draft.every) : null}
              onValueChange={(every) => patch({ every: every === null ? '' : String(every) })}
            />
          </SheetRow>
        ) : null}
      </SheetGroup>
      {draft.mode === 'ranges' ? (
        <SheetGroup footnote={doc ? m.split_ranges_hint({ title: doc.title }) : undefined}>
          <SheetRow full>
            <SheetField
              label={m.split_ranges_input_label()}
              showLabel
              placeholder={m.split_ranges_placeholder()}
              spellCheck={false}
              autoComplete="off"
              value={draft.ranges}
              data-testid="split-ranges"
              error={rangeProblems[0] ?? null}
              onChange={(event) => patch({ ranges: event.target.value })}
            />
            {rangeProblems.length > 1 ? (
              <ul className={styles.problems} data-testid="split-range-errors">
                {rangeProblems.slice(1).map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            ) : null}
          </SheetRow>
        </SheetGroup>
      ) : null}
      <SheetGroup>
        <SheetRow full>
          <p
            className={styles.summary}
            role="status"
            data-testid="split-preview"
            data-problem={preview.ok ? undefined : ''}
          >
            {summary.join(' ')}
          </p>
        </SheetRow>
      </SheetGroup>
    </Sheet>
  );
}
