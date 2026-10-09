/**
 * Strip metadata (spec document-tools.md §3; 07-sheets S4 "Remove when saving"), a task sheet
 * on the Sheet primitive in the sheet grammar (system-audit-2026-10 §3.6.1): one checkbox row
 * per removable kind, its name carrying what the diagnostics found ("XMP metadata 1 found",
 * 07 §6.8) and its description the names found or what the kind is. The choice is one history
 * entry (`setMetadataStrip`) and takes effect when the document is saved.
 *
 * - While the files are checked, the body says so and the primary waits.
 * - A partial check shows its warning row; what always stays is the group's footnote.
 * - Opened from Save a copy, it returns there when it closes, with ‹ Back
 *   (`document-store.ts`). Guard `document`, like the password sheets.
 */
import {
  type MetadataStrip,
  setMetadataStrip,
  type VirtualDocument,
} from '@pdf-editor/document-model';
import { useState } from 'react';

import { formatNumber, m } from '../i18n';
import { announce } from '../shell/announcer';
import { documentSources, useWorkspaceStore } from '../state/workspace-store';
import { Checkbox } from '../ui/Checkbox';
import { Notice } from '../ui/Notice';
import { Sheet, SheetGroup, SheetRow } from '../ui/sheet';
import { useSourceDiagnostics } from './diagnostics';
import { closeDocumentDialog, type DocumentDialog } from './document-store';
import { useDocumentSheet } from './PasswordSheet';
import { findingFor, initialStrip, mergeFindings, STRIP_ITEMS, stripSummary } from './strip-items';
import styles from './StripMetadataSheet.module.css';

export const STRIP_METADATA_SHEET = 'strip-metadata';

/** Up to eight names found, then an ellipsis. */
const namesLine = (names: readonly string[]) =>
  names.slice(0, 8).join(', ') + (names.length > 8 ? ', …' : '');

export function StripMetadataSheet({
  doc,
  open,
  origin,
}: {
  readonly doc: VirtualDocument;
  readonly open: boolean;
  readonly origin: DocumentDialog['origin'];
}) {
  const sheet = useDocumentSheet(doc, origin);
  const entries = useSourceDiagnostics(documentSources(doc));
  const loading = entries.some((e) => e === undefined || e.status === 'loading');
  const findings = mergeFindings(
    entries.flatMap((e) => (e?.status === 'ready' ? [e.value.metadata] : [])),
  );
  const partial = entries.some((e) => e?.status === 'failed');
  // The choice starts from what was found, once the check has answered.
  const [strip, setStrip] = useState<MetadataStrip | null>(null);
  if (!loading && strip === null) setStrip(initialStrip(findings, doc.metadata));
  const anything = strip !== null && Object.values(strip).some(Boolean);

  const onSubmit = () => {
    if (strip === null) return;
    const changed = useWorkspaceStore
      .getState()
      .applyOperation(
        (ws) => setMetadataStrip(ws, doc.id, anything ? strip : undefined),
        anything ? m.history_strip_metadata() : m.history_keep_metadata(),
      );
    closeDocumentDialog();
    if (changed) {
      announce(
        anything
          ? m.announce_metadata_stripped({ items: stripSummary(strip) })
          : m.announce_metadata_kept(),
      );
    }
  };

  return (
    <Sheet
      id={STRIP_METADATA_SHEET}
      kind="task"
      open={open}
      onClose={sheet.onClose}
      back={sheet.back}
      locked={sheet.locked}
      title={m.strip_title()}
      primary={{
        label: strip === null || anything ? m.strip_apply() : m.strip_keep(),
        onPress: onSubmit,
        disabled: strip === null,
        busy: strip === null,
        busyLabel: m.strip_checking(),
      }}
      initialFocus="primary"
      testId="strip-dialog"
    >
      <p className={styles.intro}>{m.strip_description()}</p>
      {strip === null ? (
        <p className={styles.checking} role="status">
          {m.strip_checking()}
        </p>
      ) : (
        <>
          {partial ? <Notice tone="info">{m.strip_partial()}</Notice> : null}
          <SheetGroup label={m.strip_found()} footnote={m.strip_kept_note()}>
            {STRIP_ITEMS.map((item) => {
              const found = findingFor(item.key, findings, doc.metadata);
              return (
                <SheetRow full key={item.key}>
                  <Checkbox
                    label={
                      <>
                        {item.label()}{' '}
                        <span
                          className={styles.count}
                          data-found={found.count > 0 || undefined}
                          data-testid={`strip-count-${item.key}`}
                        >
                          {found.count > 0
                            ? m.strip_found_count({ count: formatNumber(found.count) })
                            : m.strip_none_found()}
                        </span>
                      </>
                    }
                    description={
                      found.names && found.names.length > 0 ? namesLine(found.names) : item.hint()
                    }
                    checked={strip[item.key]}
                    onCheckedChange={(on) => setStrip({ ...strip, [item.key]: on })}
                  />
                </SheetRow>
              );
            })}
          </SheetGroup>
        </>
      )}
    </Sheet>
  );
}
