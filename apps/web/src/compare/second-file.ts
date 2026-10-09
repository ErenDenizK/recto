/**
 * Compare's second file (spec recognize-and-compare §2.2 setup): a PDF dropped on, or opened
 * from, the Compare setup opens as a tab, becomes B, and is remembered in Recents like any
 * other opened file (craft §3.1; M8-i), with the file handle Save keeps where the browser
 * gave one.
 */
import { fileHandleOf, partitionFiles } from '../files/open-files';
import { recordRecent } from '../files/recents';
import { rememberDocumentHandle } from '../files/save';
import { m } from '../i18n';
import { announce } from '../shell/announcer';
import { useWorkspaceStore } from '../state/workspace-store';
import { useCompareStore } from './compare-store';

/**
 * Opens the first PDF of `files` as a tab and makes it B, keeping the active tab. Resolves
 * once the file is open (its Recents entry is written in the background).
 */
export async function addSecondFile(files: readonly File[]): Promise<void> {
  const { pdfs } = partitionFiles(files);
  const file = pdfs[0];
  if (!file) {
    announce(m.drop_no_pdfs());
    return;
  }
  const store = useWorkspaceStore.getState();
  const previous = store.workspace.activeDocument;
  const { opened, skipped } = await store.openFiles([file]);
  const added = opened[0];
  if (added) {
    const handle = fileHandleOf(file);
    // Save writes back through it (files/save.ts, ADR-0032 §2.1), as for any opened file.
    if (handle !== undefined) rememberDocumentHandle(added.documentId, handle);
    const pages = useWorkspaceStore.getState().workspace.documents[added.documentId]?.pages.length;
    void recordRecent({
      name: file.name,
      size: file.size,
      ...(pages === undefined ? {} : { pages }),
      ...(handle === undefined ? {} : { handle }),
    });
    useCompareStore.setState({ b: added.documentId });
    if (previous !== undefined && useWorkspaceStore.getState().workspace.documents[previous]) {
      useWorkspaceStore.getState().setActive(previous);
    }
    announce(m.compare_file_added({ name: added.name }));
  } else if (skipped[0]) {
    announce(m.compare_file_failed({ name: skipped[0].name }));
  }
}
