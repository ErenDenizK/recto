/**
 * S4 Document info (`components/07-sheets.md` §6; spec D2-9): the file facts and honesty badges
 * (`DocumentFacts`), the editable metadata, the password and its outcome, and the diagnostics on
 * demand, on the one Sheet primitive. It takes over the inspector's Info section (inventory 6.7,
 * INV-13) and the M8 side sheet of the same name.
 *
 * - **Opened by** the title menu's Document info…, ⌘K and the facts row of a signed file's
 *   badges; the document dialog store (`document-store.ts`) says which document, so a password
 *   dialog opened from here (Set or Remove password…) comes back to it when it closes
 *   (`DocumentDialogs.tsx`).
 * - **A task sheet** (side 400 with a scrim from expanded up, a 640 form on medium, a bottom
 *   sheet on compact). Focus lands on the Title field (S4 §6). Every field commits on blur or
 *   Enter as one undo step; nothing waits for a footer, so the sheet has no primary and no
 *   lime: ✕, Esc or the scrim close it.
 * - **Locked:** the lock banner with Unlock (the title menu's switch); the metadata stays
 *   readable and its edits are refused by the guard at `commit()`.
 */
import type { VirtualDocument } from '@pdf-editor/document-model';
import { type RefObject, useRef } from 'react';

import { m } from '../i18n';
import { openTitleMenu } from '../shell/frame/frame-store';
import { useChangeRefusal } from '../state/guard';
import { documentSources, useWorkspaceStore } from '../state/workspace-store';
import { Sheet } from '../ui/sheet';
import { useRetained } from '../ui/use-retained';
import { DiagnosticsDetails } from './Diagnostics';
import { DocumentFacts } from './DocumentFacts';
import styles from './DocumentInfoSheet.module.css';
import { closeDocumentDialog, useDocumentDialogStore } from './document-store';
import { MetadataEditor } from './MetadataEditor';
import { SecurityInfo } from './SecurityInfo';

export const DOCUMENT_INFO_SHEET = 'document-info';

/** Mounted once at the app root: the sheet for the document the store names. */
export function DocumentInfoSheet() {
  const dialog = useDocumentDialogStore((s) =>
    s.dialog?.kind === 'info' && s.dialog.origin === 'app' ? s.dialog : null,
  );
  const live = useWorkspaceStore((s) =>
    dialog === null ? undefined : s.workspace.documents[dialog.documentId],
  );
  // The document stays shown while the sheet plays its exit.
  const [doc] = useRetained(live ?? null);
  const open = dialog !== null && live !== undefined;
  if (!doc) return null;
  return <InfoSheet key={doc.id} doc={doc} open={open} />;
}

function InfoSheet({ doc, open }: { readonly doc: VirtualDocument; readonly open: boolean }) {
  const ws = useWorkspaceStore((s) => s.workspace);
  const body = useRef<HTMLDivElement>(null);
  const refusal = useChangeRefusal(doc.id, 'document');
  const sources = documentSources(doc).flatMap((id) => {
    const source = ws.sources[id];
    return source ? [source] : [];
  });
  // S4 §6: focus on the Title field (the metadata editor's first), read when the sheet opens.
  const titleField: RefObject<HTMLElement | null> = {
    get current() {
      return (
        body.current?.querySelector<HTMLElement>('[data-testid="metadata-editor"] input') ?? null
      );
    },
  };
  return (
    <Sheet
      id={DOCUMENT_INFO_SHEET}
      kind="task"
      open={open}
      onClose={(reason) => closeDocumentDialog(reason === 'replaced')}
      title={m.docinfo_title()}
      subtitle={doc.title}
      initialFocus={titleField}
      locked={
        refusal?.kind === 'locked'
          ? { name: doc.title, onUnlock: () => openTitleMenu('menu') }
          : undefined
      }
      testId="document-info"
    >
      <div ref={body} className={styles.stack} data-document-info="">
        <section className={styles.group} aria-label={m.docinfo_file()}>
          <h3 className={styles.legend}>{m.docinfo_file()}</h3>
          <DocumentFacts doc={doc} />
        </section>
        <section className={styles.group} aria-label={m.info_metadata()}>
          <h3 className={styles.legend}>{m.info_metadata()}</h3>
          <MetadataEditor doc={doc} />
        </section>
        <section className={styles.group} aria-label={m.info_security()}>
          <h3 className={styles.legend}>{m.info_security()}</h3>
          <SecurityInfo doc={doc} />
        </section>
        {sources.length > 0 ? <DiagnosticsDetails sources={sources} /> : null}
      </div>
    </Sheet>
  );
}
