/**
 * Applies a My info fill plan (BM-4, form autofill). `planFill` (PRD-32) decides what goes
 * where; this writes it as ONE history entry "Fill from My info": the engine fields through
 * one `runAction` of `form.set-value` (`fillFields`), the created fields coalesced into the
 * same step by a shared `coalesceKey` (the `clearActiveForm` pattern), so one undo clears
 * them all and redo restores them. A `document` act: refused while the document is locked
 * (PRD-38). The preview (DSN-86) shows ghost values of a plan and applies that exact plan: it
 * is refused as `stale` when the document changed or a field no longer holds the text it held
 * when planned. It works for one field (suggestion on focus) as well as many.
 *
 * My info text lives only in the plan object and the field values written: never in logs,
 * snapshots, export metadata or the clipboard (PRD-37); the origin memory keeps no values.
 */
import type { DocumentId, FieldId, SourceId } from '@pdf-editor/document-model';
import { getActiveDocument } from '@pdf-editor/document-model';

import { m } from '../../i18n';
import { canChange } from '../../state/guard';
import { useWorkspaceStore } from '../../state/workspace-store';
import { fillFields } from '../actions';
import { createdFillsStale, fillCreatedFields } from '../create/field-actions';
import { markFieldOrigin } from './fill-origin';
import { myInfoGeneration, useMyInfo } from './my-info';
import type { FillRow } from './plan-fill';

/** One planned write: the field, the text, and the text it held when planned. */
export interface PlannedFill {
  readonly source?: SourceId;
  readonly fieldId?: FieldId;
  readonly name: string;
  readonly value: string;
  readonly current: string;
}

/** What the preview showed: apply it as is, or not at all. */
export interface FillPlan {
  /** Unique per plan, for the preview to match the result to its plan. */
  readonly id: string;
  readonly document: DocumentId;
  /**
   * The My info store when planned: Forget, a backend change, `lockNow` and any profile
   * change make the plan stale (PRD-37, PRD-38).
   */
  readonly epoch: { readonly generation: number; readonly profile: object };
  readonly items: readonly PlannedFill[];
}

/** `failed`: the write was planned but not committed (engine error, history moved, lock). */
export type FillStatus = 'filled' | 'locked' | 'stale' | 'nothing' | 'no-document' | 'failed';

export interface FillOutcome {
  readonly status: FillStatus;
  /** Fields changed (source and created). */
  readonly filled: number;
}

/**
 * The plan for `rows` of the active document: the ticked rows by default, or every row
 * passed with `ticked: false` (a single suggestion the person accepted). Undefined without an
 * active document or any row.
 */
export function createFillPlan(
  rows: readonly FillRow[],
  options: { readonly onlyTicked?: boolean } = {},
): FillPlan | undefined {
  const document = getActiveDocument(useWorkspaceStore.getState().workspace);
  if (!document) return undefined;
  const items = rows
    .filter((row) => options.onlyTicked === false || row.ticked)
    .map(
      (row): PlannedFill => ({
        ...(row.stop.source === undefined ? {} : { source: row.stop.source }),
        ...(row.stop.fieldId === undefined ? {} : { fieldId: row.stop.fieldId }),
        name: row.stop.name,
        value: row.value,
        current: row.current,
      }),
    );
  if (items.length === 0) return undefined;
  return {
    id: globalThis.crypto.randomUUID(),
    document: document.id,
    epoch: { generation: myInfoGeneration(), profile: useMyInfo.getState().profile },
    items,
  };
}

let fills = 0;

/**
 * Writes `plan` as one history entry. Refuses (`locked`, `stale`, `no-document`) before
 * changing anything; `nothing` when every field already holds its planned text.
 */
export async function applyFillPlan(plan: FillPlan): Promise<FillOutcome> {
  const none = (status: FillStatus): FillOutcome => ({ status, filled: 0 });
  const doc = getActiveDocument(useWorkspaceStore.getState().workspace);
  if (doc?.id !== plan.document) return none(doc ? 'stale' : 'no-document');
  if (!canChange(doc.id, 'document')) return none('locked');
  const info = useMyInfo.getState();
  if (info.status === 'locked') return none('locked');
  if (myInfoGeneration() !== plan.epoch.generation || info.profile !== plan.epoch.profile) {
    return none('stale');
  }

  const key = `forms-my-info-${++fills}`;
  const label = m.forms_fill_my_info_label();
  const engine = plan.items.flatMap((item) =>
    item.source === undefined || item.fieldId !== undefined
      ? []
      : [{ source: item.source, name: item.name, value: item.value, expected: item.current }],
  );
  const created = plan.items.flatMap((item) =>
    item.fieldId === undefined
      ? []
      : [{ id: item.fieldId, value: item.value, expected: item.current }],
  );

  // Created fields are checked inside the engine step (one step: checks and writes), and
  // again when written; engine fields are checked there against what the plan saw.
  const fromEngine = await fillFields(
    engine,
    label,
    key,
    () => !createdFillsStale(doc.id, created),
  );
  if (fromEngine.stale) return none('stale');
  if (fromEngine.failed) return none('failed');
  const fromModel = fillCreatedFields(
    doc.id,
    created,
    label,
    fromEngine.done.length > 0 ? key : undefined,
  );
  if (fromModel.stale) {
    // A created field moved after the engine step: take the whole fill back.
    if (fromEngine.done.length > 0) useWorkspaceStore.getState().undo();
    return none('stale');
  }

  markFieldOrigin(
    [
      ...fromEngine.done,
      ...fromModel.done.map((fieldId) => ({
        fieldId,
        name: plan.items.find((i) => i.fieldId === fieldId)?.name ?? '',
      })),
    ],
    'my-info',
    doc.id,
  );
  const filled = fromEngine.done.length + fromModel.done.length;
  return { status: filled === 0 ? 'nothing' : 'filled', filled };
}
