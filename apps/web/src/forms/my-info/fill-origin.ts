/**
 * Who filled a field (BM-4, DSN-86): `my-info` for the Fill from My info action, `manual` for a
 * value typed or picked by hand. The "save to My info?" chip offers a hand-filled field only.
 * Session memory keyed by field, never persisted; it holds no value and no profile data
 * (PRD-37). It says how a field was filled, not whether it still holds that text: callers
 * read the field's current value too (an undo empties it).
 */
import type { DocumentId, FieldId, SourceId } from '@pdf-editor/document-model';
import { create } from 'zustand';

import { useWorkspaceStore } from '../../state/workspace-store';

export type FillOrigin = 'my-info' | 'manual';

/** Identifies a field: a source field by source and name, a created one by its id. */
export interface FieldRef {
  readonly source?: SourceId | undefined;
  readonly fieldId?: FieldId | undefined;
  readonly name: string;
}

export const fieldOriginKey = (document: DocumentId, ref: FieldRef): string =>
  `${document}|${ref.fieldId ?? ''}|${ref.source ?? ''}|${ref.name}`;

export const useFillOrigins = create<{ readonly byKey: Readonly<Record<string, FillOrigin>> }>()(
  () => ({ byKey: {} }),
);

/** Records how `refs` of `document` (default: the active one) were just filled. */
export function markFieldOrigin(
  refs: FieldRef | readonly FieldRef[],
  origin: FillOrigin,
  document: DocumentId | undefined = useWorkspaceStore.getState().workspace.activeDocument,
): void {
  if (document === undefined) return;
  const list = 'name' in refs ? [refs] : refs;
  useFillOrigins.setState((s) => {
    const byKey = { ...s.byKey };
    for (const ref of list) byKey[fieldOriginKey(document, ref)] = origin;
    return { byKey };
  });
}

/** How the field was last filled this session; undefined when untouched. */
export function originOf(document: DocumentId, ref: FieldRef): FillOrigin | undefined {
  return useFillOrigins.getState().byKey[fieldOriginKey(document, ref)];
}

/** Tests and "Forget": drop the memory. */
export function resetFillOrigins(): void {
  useFillOrigins.setState({ byKey: {} });
}
