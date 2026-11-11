/**
 * The page left, on the Library's Continue block (EDN-29): the open document's page drawn through
 * the shared thumbnail renderer, 132 px wide in its own proportions. A lazy chunk of
 * `CompactLibrary`, since the renderer brings the page canvas: the phone's first load carries
 * none of it, and the block holds a paper sheet of the same box until this arrives.
 */
import type { DocumentId } from '@pdf-editor/document-model';

import { PageThumb } from '../../home/PageThumb';
import { useWorkspaceStore } from '../../state/workspace-store';
import styles from './CompactLibrary.module.css';

/** The box the page fits, CSS px: 132 wide, as tall as a portrait page of the phone's shelf. */
export const CONTINUE_BOX = { width: 132, height: 200 } as const;

export default function ContinueCover({
  id,
  page,
}: {
  readonly id: DocumentId;
  /** 0-based index of the page left. */
  readonly page: number;
}) {
  const workspace = useWorkspaceStore((s) => s.workspace);
  const doc = workspace.documents[id];
  const target = doc?.pages[Math.min(page, (doc?.pages.length ?? 1) - 1)];
  if (!target) return <span className={styles.sheet} data-empty="" />;
  return (
    <PageThumb workspace={workspace} page={target} box={CONTINUE_BOX} className={styles.sheet} />
  );
}
