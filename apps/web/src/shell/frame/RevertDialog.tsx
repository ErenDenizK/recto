/**
 * "Revert to the opened version?" (07-sheets S1 copy and behaviour; ADR-0032 §2.2): a centred
 * confirmation, 400 wide, until D0-4's `confirm()` replaces it. The body counts the changes
 * that go ("Your 3 changes since opening go. Undo brings them back."); focus starts on Revert,
 * since Undo brings everything back; Esc cancels and the backdrop ignores presses. After the
 * revert a toast names it with Undo (`files/revert.ts`).
 */
import { AlertDialog } from '@base-ui/react/alert-dialog';
import type { DocumentId } from '@pdf-editor/document-model';
import { RotateCcw } from 'lucide-react';
import { useRef } from 'react';

import { changesSinceOpening, revertDocument } from '../../files/revert';
import { useRevertDialogStore } from '../../files/save-commands';
import { m } from '../../i18n';
import { useWorkspaceStore } from '../../state/workspace-store';
import { Button } from '../../ui/Button';
import { useRetained } from '../../ui/use-retained';
import overlay from '../ShortcutOverlay.module.css';
import styles from './RevertDialog.module.css';

const close = () => useRevertDialogStore.setState({ documentId: null });

export function RevertDialog() {
  const documentId = useRevertDialogStore((s) => s.documentId);
  const [shown, release] = useRetained(documentId);
  return (
    <AlertDialog.Root
      open={documentId !== null}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      onOpenChangeComplete={(open) => {
        if (!open) release();
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className={overlay.backdrop} />
        {shown !== null ? <RevertBody documentId={shown} /> : null}
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

function RevertBody({ documentId }: { readonly documentId: DocumentId }) {
  const count = useWorkspaceStore((s) => changesSinceOpening(s.history, documentId));
  const revert = useRef<HTMLButtonElement>(null);
  return (
    <AlertDialog.Popup
      className={`${overlay.popup} ${styles.popup}`}
      initialFocus={revert}
      data-testid="revert-dialog"
    >
      <AlertDialog.Title className={styles.title}>{m.revert_title()}</AlertDialog.Title>
      <AlertDialog.Description className={styles.body}>
        {count > 0 ? m.revert_body({ count }) : m.revert_body_unknown()}
      </AlertDialog.Description>
      <div className={styles.actions}>
        <Button variant="standard" onClick={close}>
          {m.common_cancel()}
        </Button>
        <Button
          ref={revert}
          variant="danger"
          icon={<RotateCcw aria-hidden="true" />}
          onClick={() => {
            close();
            void revertDocument(documentId);
          }}
        >
          {m.revert_action()}
        </Button>
      </div>
    </AlertDialog.Popup>
  );
}
