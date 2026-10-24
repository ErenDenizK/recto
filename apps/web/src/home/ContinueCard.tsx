/**
 * The Continue card for the document read last that is still open (R26 concept 4, DSN-66): both
 * editions' source, with the page left drawn from the open document (`PageThumb`) and the changes
 * not saved read from the session (`isDocumentChanged`). Signature fields and comments waiting
 * come from the review list, which the phone's chunk does not carry: `ContinueDesk` adds them.
 * `onResume` is the edition's way back to the page view (`resumeDocument`, the phone's
 * `resumeCompact`). Loaded only behind `?home=continue`.
 */
import type { DocumentId } from '@pdf-editor/document-model';

import { type ResumePoint, useResumeStore } from '../session/resume';
import { isDocumentChanged } from '../session/session';
import { useWorkspaceStore } from '../state/workspace-store';
import { THUMB, type ContinueSource, ContinueView, type ContinueVariant } from './ContinueView';
import styles from './ContinueCard.module.css';
import { PageThumb } from './PageThumb';

/** The open document last read, as the card shows it; undefined: none has a place yet. */
export function useOpenSource(
  variant: ContinueVariant,
  onResume: (id: DocumentId, point: ResumePoint) => void,
): ContinueSource | undefined {
  const workspace = useWorkspaceStore((s) => s.workspace);
  const points = useResumeStore((s) => s.points);
  const last = useResumeStore((s) => s.last);
  const id =
    last !== null && workspace.documents[last] !== undefined
      ? last
      : (workspace.activeDocument ?? undefined);
  const doc = id === undefined ? undefined : workspace.documents[id];
  const point = id === undefined ? undefined : points[id];
  if (doc === undefined || point === undefined) return undefined;
  const page = doc.pages[Math.min(point.page, doc.pages.length - 1)];
  return {
    id: doc.id,
    title: doc.title,
    point,
    pending: { unsaved: isDocumentChanged(doc.id), signatures: 0, comments: 0 },
    thumb: page ? (
      <PageThumb workspace={workspace} page={page} box={THUMB[variant]} className={styles.sheet} />
    ) : null,
    resume: () => onResume(doc.id, point),
  };
}

export default function ContinueCard({
  variant = 'desk',
  onResume,
}: {
  readonly variant?: ContinueVariant;
  readonly onResume: (id: DocumentId, point: ResumePoint) => void;
}) {
  const source = useOpenSource(variant, onResume);
  return source === undefined ? null : <ContinueView variant={variant} source={source} />;
}
