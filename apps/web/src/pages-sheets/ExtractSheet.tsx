/**
 * S16 Extract pages (`components/07-sheets.md` §18): copy or move pages into a new document.
 * Opened by the page menu's Extract page…, the Pages bar's Extract, the thumbnail menu and
 * Mod+Shift+E, with the selection. A task sheet.
 *
 * - **Pages:** a range field ("3, 5-7"), prefilled from the selection, parsed as Split's ranges
 *   are (`stage/operation-plans.ts`), its problems said under it.
 * - **Keep them in report.pdf** (the default) copies them and changes nothing, so it is allowed
 *   while locked (flows §2.6); **Remove them from report.pdf** moves them, a `pages` act, dimmed
 *   with "Locked" on a locked document.
 * - **Name:** "report (extract)" until edited.
 * - **Commit:** the new document opens as a tab after this one, one undo step, with a toast.
 */
import type { DocumentId, PageId } from '@pdf-editor/document-model';
import { findPageLocation } from '@pdf-editor/document-model';
import { useEffect, useState } from 'react';

import { m } from '../i18n';
import { extractPages } from '../stage/arrange-actions';
import { parsePageRanges, validateTitle } from '../stage/operation-plans';
import { titleProblemMessage } from '../stage/section-operations';
import { useChangeRefusal } from '../state/guard';
import { pagesPhrase, useWorkspaceStore } from '../state/workspace-store';
import { RadioGroup } from '../ui/RadioGroup';
import { Sheet, SheetField, SheetGroup, SheetRow, useSheetDraft } from '../ui/sheet';
import { toast } from '../ui/Toast/toast';
import styles from './PagesSheets.module.css';
import { rangeProblemMessage } from './range-problems';

export const EXTRACT_SHEET = 'extract';

type ExtractMode = 'keep' | 'remove';

interface ExtractDraft {
  readonly pages: string;
  readonly mode: ExtractMode;
  readonly name: string | null;
}

/** "3, 5-7" for 0-based `indices` (any order): ascending, runs joined by a hyphen. */
export function rangesText(indices: readonly number[]): string {
  const sorted = [...new Set(indices)].sort((a, b) => a - b);
  const parts: string[] = [];
  let start: number | undefined;
  let previous: number | undefined;
  for (const index of [...sorted, Number.NaN]) {
    if (previous !== undefined && index === previous + 1) {
      previous = index;
      continue;
    }
    if (start !== undefined && previous !== undefined) {
      parts.push(start === previous ? String(start + 1) : `${start + 1}-${previous + 1}`);
    }
    start = index;
    previous = index;
  }
  return parts.join(', ');
}

export function ExtractSheet({
  pageIds,
  open,
  onClose,
}: {
  /** The pages it was opened with (the selection). */
  readonly pageIds: readonly PageId[];
  readonly open: boolean;
  readonly onClose: () => void;
}) {
  const ws = useWorkspaceStore((s) => s.workspace);
  const firstLocation = pageIds[0] === undefined ? undefined : findPageLocation(ws, pageIds[0]);
  const liveDoc = firstLocation ? ws.documents[firstLocation.document] : undefined;
  // The document stays shown while the sheet closes, if the extract took its last pages.
  const [kept, setKept] = useState(liveDoc);
  if (liveDoc && liveDoc !== kept) setKept(liveDoc);
  const doc = liveDoc ?? kept;
  const documentId: DocumentId | null = doc?.id ?? null;
  const indices = doc
    ? pageIds.flatMap((id) => {
        const location = findPageLocation(ws, id);
        return location?.document === doc.id ? [location.index] : [];
      })
    : [];
  const [draft, setDraft, , restored] = useSheetDraft<ExtractDraft>(EXTRACT_SHEET, documentId, {
    pages: rangesText(indices),
    mode: 'keep',
    name: null,
  });
  // Each opening takes the pages it was opened with.
  useEffect(() => {
    if (open) setDraft((d) => ({ ...d, pages: rangesText(indices) }));
    // Each opening only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const refusal = useChangeRefusal(documentId, 'pages');
  const removeLocked = refusal !== undefined;
  const mode: ExtractMode = removeLocked ? 'keep' : draft.mode;
  const pageCount = doc?.pages.length ?? 0;
  const parsed = parsePageRanges(draft.pages, pageCount);
  const chosen = parsed.ok
    ? [
        ...new Set(
          parsed.ranges.flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => a + i)),
        ),
      ]
    : [];
  const name = draft.name ?? (doc ? m.extract_document_title({ title: doc.title }) : '');
  const checkedName = validateTitle(name);
  const removesAll = mode === 'remove' && chosen.length >= pageCount;
  const problems = draft.pages.trim().length > 0 && !parsed.ok ? parsed.problems : [];
  const ready = parsed.ok && chosen.length > 0 && checkedName.ok && !removesAll;

  const submit = () => {
    if (!ready || !doc) return;
    const ids = chosen.flatMap((i) => doc.pages[i]?.id ?? []);
    const created = extractPages({
      pageIds: ids,
      title: checkedName.ok ? checkedName.title : name,
      keep: mode === 'keep',
    });
    if (created === undefined) return;
    onClose();
    toast.undo(
      mode === 'keep'
        ? m.extract_toast_copied({ count: ids.length })
        : m.extract_toast_moved({ count: ids.length }),
      { documentId: created, spoken: false },
    );
  };

  const reason = !parsed.ok
    ? problems[0]
      ? rangeProblemMessage(problems[0])
      : m.range_error_empty()
    : removesAll
      ? m.pages_bar_one_page()
      : !checkedName.ok
        ? titleProblemMessage(checkedName.problem)
        : undefined;

  return (
    <Sheet
      id={EXTRACT_SHEET}
      kind="task"
      open={open && doc !== undefined}
      onClose={onClose}
      title={m.extract_sheet_title()}
      subtitle={doc?.title}
      restored={restored}
      primary={{
        label: m.extract_primary({ count: chosen.length }),
        onPress: submit,
        disabled: !ready,
        reason,
        reasonRoom: true,
      }}
      testId="extract-sheet"
    >
      <SheetGroup>
        <SheetRow full>
          <SheetField
            label={m.extract_pages_label()}
            showLabel
            value={draft.pages}
            spellCheck={false}
            autoComplete="off"
            placeholder={m.split_ranges_placeholder()}
            data-testid="extract-pages"
            error={problems[0] ? rangeProblemMessage(problems[0]) : null}
            onChange={(event) => setDraft((d) => ({ ...d, pages: event.target.value }))}
          />
        </SheetRow>
      </SheetGroup>
      <SheetGroup label={m.extract_mode_label()}>
        <RadioGroup<ExtractMode>
          className={styles.choices}
          label={m.extract_mode_label()}
          value={mode}
          onValueChange={(next) => setDraft((d) => ({ ...d, mode: next }))}
          options={[
            { value: 'keep', label: m.extract_keep({ title: doc?.title ?? '' }) },
            {
              value: 'remove',
              label: m.extract_remove({ title: doc?.title ?? '' }),
              disabled: removeLocked,
              description: removeLocked ? m.sheet_locked_reason() : undefined,
            },
          ]}
        />
      </SheetGroup>
      <SheetGroup>
        <SheetRow full>
          <SheetField
            label={m.combine_name_label()}
            showLabel
            value={name}
            spellCheck={false}
            autoComplete="off"
            error={checkedName.ok ? null : titleProblemMessage(checkedName.problem)}
            onChange={(event) => setDraft((d) => ({ ...d, name: event.target.value }))}
          />
        </SheetRow>
        <SheetRow full>
          <p className={styles.summary} role="status" data-problem={ready ? undefined : ''}>
            {ready
              ? mode === 'keep'
                ? m.extract_preview_keep({ pages: pagesPhrase(chosen.length) })
                : m.extract_preview_remove({ pages: pagesPhrase(chosen.length) })
              : (reason ?? '')}
          </p>
        </SheetRow>
      </SheetGroup>
    </Sheet>
  );
}
