/**
 * S14 Interleave (`components/07-sheets.md` §16; spec 07.13): merge front and back scans, or
 * alternate two documents, into a new document. A task sheet.
 *
 * - **Second document:** the other open documents (the grid's sections first); with only one
 *   document open the sheet says "Open a second document first".
 * - **Order:** Alternate · Duplex scan, each with its hint; the resulting order shows as small
 *   slots, A and B told apart by letter and tag, "+8 more" past twelve.
 * - **One outcome** (INV-12, 07.13): a new document after the later source, both sources open
 *   and untouched; guard none, since the sources are only read (X32), so a locked source is
 *   allowed. It opens in its Pages grid, one undo step, "Interleaved into report + back · Undo".
 */
import type { DocumentId, InterleaveMode } from '@pdf-editor/document-model';
import { useState } from 'react';

import { formatNumber, m } from '../i18n';
import { showInGrid } from '../home/home-actions';
import { previewInterleave } from '../stage/operation-plans';
import { interleaveWith } from '../stage/section-operations';
import { pagesPhrase, useTabItems } from '../state/workspace-store';
import { RadioGroup } from '../ui/RadioGroup';
import { Sheet, SheetGroup, SheetRow, useSheetDraft } from '../ui/sheet';
import { toast } from '../ui/Toast/toast';
import styles from './PagesSheets.module.css';

export const INTERLEAVE_SHEET = 'interleave';
/** Slots shown in the resulting order before "+N more" (§16 §2). */
const SLOTS = 12;

interface InterleaveDraft {
  readonly second: DocumentId | null;
  readonly mode: InterleaveMode;
}

export function InterleaveSheet({
  documentId,
  open,
  onClose,
}: {
  readonly documentId: DocumentId | null;
  readonly open: boolean;
  readonly onClose: () => void;
}) {
  const tabs = useTabItems();
  const first = tabs.find((t) => t.id === documentId);
  const [kept, setKept] = useState(first);
  if (first && first !== kept) setKept(first);
  const a = first ?? kept;
  const others = tabs.filter((t) => t.id !== a?.id);
  const [draft, setDraft, , restored] = useSheetDraft<InterleaveDraft>(
    INTERLEAVE_SHEET,
    documentId,
    { second: null, mode: 'alternate' },
  );
  const b = others.find((t) => t.id === draft.second) ?? others[0];
  const slots = a && b ? previewInterleave(a.pageCount, b.pageCount, draft.mode, SLOTS) : [];
  const total = (a?.pageCount ?? 0) + (b?.pageCount ?? 0);

  const submit = () => {
    if (!a || !b) return;
    const created = interleaveWith(a.id, b.id, draft.mode);
    if (created === undefined) return;
    onClose();
    showInGrid(created);
    toast.undo(m.interleave_toast({ title: `${a.title} + ${b.title}` }), {
      documentId: created,
      spoken: false,
    });
  };

  return (
    <Sheet
      id={INTERLEAVE_SHEET}
      kind="task"
      open={open && a !== undefined}
      onClose={onClose}
      title={a ? m.interleave_sheet_title({ title: a.title }) : m.interleave_confirm()}
      restored={restored}
      primary={{
        label: m.interleave_confirm(),
        onPress: submit,
        disabled: b === undefined,
        reason: b === undefined ? m.interleave_needs_second() : undefined,
      }}
      testId="interleave-dialog"
    >
      {others.length === 0 ? (
        <SheetGroup>
          <SheetRow full>
            <p className={styles.summary} data-problem="">
              {m.interleave_needs_second()}
            </p>
          </SheetRow>
        </SheetGroup>
      ) : (
        <SheetGroup label={m.interleave_second_label()}>
          <RadioGroup<string>
            className={styles.choices}
            label={m.interleave_second_label()}
            value={b?.id ?? ''}
            onValueChange={(second) => setDraft((d) => ({ ...d, second: second as DocumentId }))}
            options={others.map((tab) => ({
              value: tab.id,
              label: tab.title,
              detail: pagesPhrase(tab.pageCount),
            }))}
          />
        </SheetGroup>
      )}
      <SheetGroup label={m.interleave_mode_label()}>
        <RadioGroup<InterleaveMode>
          className={styles.choices}
          label={m.interleave_mode_label()}
          value={draft.mode}
          onValueChange={(mode) => setDraft((d) => ({ ...d, mode }))}
          options={[
            {
              value: 'alternate',
              label: m.interleave_mode_alternate(),
              description: m.interleave_mode_alternate_hint(),
            },
            {
              value: 'duplex-reverse-b',
              label: m.interleave_mode_duplex(),
              description: m.interleave_mode_duplex_hint(),
            },
          ]}
        />
      </SheetGroup>
      {a && b ? (
        <SheetGroup label={m.interleave_preview_label()}>
          <SheetRow full className={styles.stackRow}>
            <ol
              className={styles.slots}
              aria-label={m.interleave_preview_label()}
              data-testid="interleave-preview"
            >
              {slots.map((slot, i) => {
                const tab = slot.from === 'a' ? a : b;
                return (
                  <li
                    key={i}
                    className={styles.slot}
                    data-tag={tab.colorIndex}
                    aria-label={m.interleave_slot_label({ title: tab.title, page: slot.page })}
                  >
                    <span className={styles.slotLetter} aria-hidden="true">
                      {slot.from === 'a' ? 'A' : 'B'}
                    </span>
                    {formatNumber(slot.page)}
                  </li>
                );
              })}
              {total > slots.length ? (
                <li className={styles.slotMore}>
                  {m.interleave_more({ count: total - slots.length })}
                </li>
              ) : null}
            </ol>
            <p className={styles.legendLine}>
              <span>A · {a.title}</span>
              <span>B · {b.title}</span>
            </p>
            <p className={styles.summary} role="status">
              {m.interleave_preview_new({
                title: `${a.title} + ${b.title}`,
                pages: pagesPhrase(total),
              })}
            </p>
          </SheetRow>
        </SheetGroup>
      ) : null}
    </Sheet>
  );
}
