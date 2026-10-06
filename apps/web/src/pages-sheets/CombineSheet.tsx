/**
 * S15 Combine with open documents (`components/07-sheets.md` §17; INV-12, INV-R6; PG6): the
 * documents already open, combined into a new one from inside a document (J3's in-document
 * route; the Library's Combine needs no sheet). A task sheet.
 *
 * - **Checklist** of the open documents in tab order, the current one checked and first; ‹ ›
 *   (and Alt+Up / Alt+Down on a row) reorder, announced ("Moved agreement.pdf to position 1");
 *   the rows reflow by FLIP. Name: "Combined – report + agreement" until edited.
 * - **One outcome:** a new document of copies of the checked documents' pages, in this order,
 *   after the last of them; the sources stay open and untouched (M8's Merge dialog, which
 *   replaced them, is gone). Guard none: a new document, and locked sources are only read.
 * - **Commit** opens the new document straight in its Pages grid with "Sources: …" in the
 *   header (PG6), one undo step, "Combined 2 files · Undo".
 */
import type { DocumentId } from '@pdf-editor/document-model';
import { type KeyboardEvent, useEffect, useId, useRef } from 'react';
import { flushSync } from 'react-dom';

import { m } from '../i18n';
import { combineInto, showInGrid } from '../home/home-actions';
import { combinedTitle } from '../home/home-model';
import { flip } from '../motion/flip';
import { announce } from '../shell/announcer';
import { validateTitle } from '../stage/operation-plans';
import { titleProblemMessage } from '../stage/section-operations';
import { pagesPhrase, useTabItems, useWorkspaceStore } from '../state/workspace-store';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { Sheet, SheetField, useSheetDraft } from '../ui/sheet';
import styles from './PagesSheets.module.css';

export const COMBINE_SHEET = 'combine';

interface CombineDraft {
  /** Every open document, in the order they will be joined. */
  readonly order: readonly DocumentId[];
  readonly checked: readonly DocumentId[];
  /** The name as typed; null follows the order ("Combined – A + B"). */
  readonly name: string | null;
}

/** The order the sheet starts from: `given` first (the Library's), else the active, then tabs. */
export function initialCombineOrder(
  tabs: readonly DocumentId[],
  active: DocumentId | undefined,
  given: readonly DocumentId[] | undefined,
): { order: DocumentId[]; checked: DocumentId[] } {
  const first = given?.filter((id) => tabs.includes(id)) ?? (active ? [active] : []);
  const order = [...first, ...tabs.filter((id) => !first.includes(id))];
  const checked = given ? first : [...tabs];
  return { order, checked: checked.length > 0 ? checked : [...tabs] };
}

export function CombineSheet({
  given,
  open,
  onClose,
}: {
  /** The documents to check first, in order (the Library's selection); else every one. */
  readonly given: readonly DocumentId[] | undefined;
  readonly open: boolean;
  readonly onClose: () => void;
}) {
  const tabs = useTabItems();
  const active = useWorkspaceStore((s) => s.workspace.activeDocument);
  const start = initialCombineOrder(
    tabs.map((t) => t.id),
    active,
    given,
  );
  const [draft, setDraft, reset, restored] = useSheetDraft<CombineDraft>(COMBINE_SHEET, null, {
    order: start.order,
    checked: start.checked,
    name: null,
  });
  // Opened with the Library's choice: that choice, not an earlier visit's draft.
  useEffect(() => {
    if (open && given !== undefined)
      setDraft({ order: start.order, checked: start.checked, name: null });
    // Each opening with a choice only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, given]);
  // A draft from an earlier visit follows the documents open now.
  const order = [
    ...draft.order.filter((id) => tabs.some((t) => t.id === id)),
    ...tabs.map((t) => t.id).filter((id) => !draft.order.includes(id)),
  ];
  const rows = order.flatMap((id) => tabs.find((t) => t.id === id) ?? []);
  const checkedRows = rows.filter((row) => draft.checked.includes(row.id));
  const name = draft.name ?? combinedTitle(checkedRows.map((r) => r.title));
  const checkedName = validateTitle(name);
  const total = checkedRows.reduce((sum, row) => sum + row.pageCount, 0);
  const enough = checkedRows.length >= 2;
  const listRef = useRef<HTMLOListElement>(null);
  const nameId = useId();

  const move = (index: number, direction: -1 | 1) => {
    const to = index + direction;
    const id = order[index];
    if (id === undefined || to < 0 || to >= order.length) return;
    const next = [...order];
    next.splice(index, 1);
    next.splice(to, 0, id);
    const items = listRef.current ? [...listRef.current.children] : [];
    void flip(items as HTMLElement[], () =>
      flushSync(() => setDraft((d) => ({ ...d, order: next }))),
    );
    const title = tabs.find((t) => t.id === id)?.title ?? '';
    announce(m.combine_announce_moved({ title, position: to + 1 }));
  };

  const toggle = (id: DocumentId) =>
    setDraft((d) => ({
      ...d,
      checked: d.checked.includes(id) ? d.checked.filter((c) => c !== id) : [...d.checked, id],
    }));

  const onRowKey = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
    event.preventDefault();
    move(index, event.key === 'ArrowUp' ? -1 : 1);
    requestAnimationFrame(() => {
      const row = listRef.current?.children[index + (event.key === 'ArrowUp' ? -1 : 1)];
      row?.querySelector<HTMLElement>('input')?.focus();
    });
  };

  const submit = () => {
    if (!enough || !checkedName.ok) return;
    const ids = checkedRows.map((r) => r.id);
    const created = combineInto(ids, checkedName.title);
    if (created === undefined) return;
    reset();
    onClose();
    showInGrid(created);
  };

  return (
    <Sheet
      id={COMBINE_SHEET}
      kind="task"
      open={open}
      onClose={onClose}
      title={m.combine_sheet_title()}
      description={m.combine_sheet_description()}
      restored={restored}
      primary={{
        label: m.home_combine_confirm(),
        onPress: submit,
        disabled: !enough || !checkedName.ok,
        reason: !enough
          ? m.combine_needs_two()
          : checkedName.ok
            ? undefined
            : titleProblemMessage(checkedName.problem),
        reasonRoom: true,
      }}
      testId="combine-sheet"
    >
      <div className={styles.stack}>
        <div className={styles.group}>
          <p className={styles.legend} id={`${nameId}-order`}>
            {m.combine_order_label()}
          </p>
          <ol ref={listRef} className={styles.list} aria-labelledby={`${nameId}-order`}>
            {rows.map((row, index) => {
              const on = draft.checked.includes(row.id);
              return (
                <li
                  key={row.id}
                  className={styles.row}
                  data-off={on ? undefined : ''}
                  data-testid="combine-row"
                >
                  <input
                    type="checkbox"
                    className={styles.check}
                    checked={on}
                    aria-label={row.title}
                    aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
                    onChange={() => toggle(row.id)}
                    onKeyDown={(event) => onRowKey(event, index)}
                  />
                  <span className={styles.tag} data-tag={row.colorIndex} aria-hidden="true" />
                  <span className={styles.rowTitle} title={row.title}>
                    {row.title}
                  </span>
                  <span className={styles.rowMeta}>{pagesPhrase(row.pageCount)}</span>
                  <span className={styles.rowButtons}>
                    <IconButton
                      size="row"
                      label={m.merge_move_up({ title: row.title })}
                      icon={<Icon name="caret-up" />}
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    />
                    <IconButton
                      size="row"
                      label={m.merge_move_down({ title: row.title })}
                      icon={<Icon name="caret-down" />}
                      disabled={index === rows.length - 1}
                      onClick={() => move(index, 1)}
                    />
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
        <SheetField
          label={m.combine_name_label()}
          showLabel
          id={nameId}
          value={name}
          spellCheck={false}
          autoComplete="off"
          error={checkedName.ok ? null : titleProblemMessage(checkedName.problem)}
          onChange={(event) => setDraft((d) => ({ ...d, name: event.target.value }))}
        />
        <p className={styles.preview} role="status" data-problem={enough ? undefined : ''}>
          {enough ? m.combine_preview({ pages: pagesPhrase(total) }) : m.combine_needs_two()}
        </p>
      </div>
    </Sheet>
  );
}
