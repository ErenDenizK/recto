/**
 * What the export needs to know about applied redactions (spec redaction §5.3): which
 * sources carry them (`redaction.apply` engine edits), and their plans mapped from source
 * pages to output pages for `verifyRedactedOutput`.
 *
 * Areas stay valid through the assembler's page copy, rotation and crop (user space is
 * unchanged); areas on a page that is resized are not mapped (its content is transformed)
 * and are counted in `unmappedAreas`, while their strings are still checked document-wide.
 * Each plan carries the annotations created after its apply (`laterMarks`, RED-1).
 */

import type {
  EngineEdit,
  Rect,
  SourceId,
  VirtualDocument,
  Workspace,
} from '@pdf-editor/document-model';

import type { RedactionApplyPayload, RedactionArea, RedactionPlan } from '../types';

/** Redactions in an export (`ExportPlan.redaction`). */
export interface RedactionExportPlan {
  /**
   * Sources with applied redactions. Their bytes must be the redacted ones
   * (`ApplyRedactionsResult.bytes`), never the bytes kept at open, and the output is always
   * a full rewrite: no incremental save, no byte-preserving passthrough.
   */
  readonly sources: readonly SourceId[];
  /** One plan per applied redaction, areas in output page indices. */
  readonly plans: readonly RedactionPlan[];
  /** Areas on exported pages that could not be mapped (resized pages). */
  readonly unmappedAreas: number;
  /**
   * Whether a later mark (`RedactionPlan.laterMarks`, RED-1) lies on one of its redaction's
   * areas, by the bounds its create edit gives (/Rect, else its points grown by half the
   * stroke width): what tells the export a flattened mark is why the pixel check failed.
   */
  readonly laterMarksInAreas: boolean;
}

function isArea(value: unknown): value is RedactionArea {
  const a = value as Partial<RedactionArea> | null;
  const r = a?.rect as Partial<RedactionArea['rect']> | undefined;
  return (
    typeof a?.pageIndex === 'number' &&
    [r?.x, r?.y, r?.width, r?.height].every((n) => typeof n === 'number')
  );
}

/** The plan of a `redaction.apply` edit, when its payload is a `RedactionApplyPayload`. */
export function redactionPlanOf(edit: EngineEdit): RedactionPlan | undefined {
  if (edit.kind !== 'redaction.apply') return undefined;
  const plan = (edit.payload as Partial<RedactionApplyPayload> | null)?.plan;
  if (
    !plan ||
    !Array.isArray(plan.areas) ||
    !Array.isArray(plan.strings) ||
    !plan.areas.every(isArea) ||
    !plan.strings.every((s) => typeof s === 'string')
  ) {
    return undefined;
  }
  return plan;
}

/**
 * Ids (/NM) of the annotations `edits` create on `source`: marks made after a redaction's
 * apply (RED-1), which its area checks ignore. A /Redact mark among them is still refused by
 * the check.
 */
function createdAnnotations(edits: readonly EngineEdit[], source: SourceId): LaterMark[] {
  const marks: LaterMark[] = [];
  for (const edit of edits) {
    if (edit.kind !== 'annotation.create' || edit.source !== source) continue;
    const annotation = (edit.payload as { annotation?: unknown } | null)?.annotation;
    const id = (annotation as { id?: unknown } | undefined)?.id;
    if (typeof id !== 'string' || id === '') continue;
    const bounds = boundsOfSerialized(annotation);
    marks.push({ id, pageIndex: edit.pageIndex, ...(bounds ? { bounds } : {}) });
  }
  return marks;
}

interface LaterMark {
  readonly id: string;
  /** Source page index. */
  readonly pageIndex: number;
  readonly bounds?: Rect;
}

const isPoint = (p: unknown): p is { x: number; y: number } =>
  typeof (p as { x?: unknown } | null)?.x === 'number' &&
  typeof (p as { y?: unknown } | null)?.y === 'number';

/** Bounds of a serialized annotation: its /Rect when it has an area, else its points. */
function boundsOfSerialized(annotation: unknown): Rect | undefined {
  const a = (annotation ?? {}) as {
    rect?: Partial<Rect>;
    paths?: unknown;
    vertices?: unknown;
    strokeWidth?: unknown;
  };
  const r = a.rect;
  if (
    r &&
    [r.x, r.y, r.width, r.height].every((n) => typeof n === 'number') &&
    (r.width ?? 0) > 0 &&
    (r.height ?? 0) > 0
  ) {
    return r as Rect;
  }
  const lists: unknown[] = [...(Array.isArray(a.paths) ? (a.paths as unknown[]) : []), a.vertices];
  const points = lists.flatMap((list) => (Array.isArray(list) ? list.filter(isPoint) : []));
  if (points.length === 0) return undefined;
  const pad = typeof a.strokeWidth === 'number' ? a.strokeWidth / 2 : 0;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const [x, y] = [Math.min(...xs) - pad, Math.min(...ys) - pad];
  return { x, y, width: Math.max(...xs) + pad - x, height: Math.max(...ys) + pad - y };
}

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x <= b.x + b.width && b.x <= a.x + a.width && a.y <= b.y + b.height && b.y <= a.y + a.height;

/** The redactions of `doc` for its export, or undefined when none of its sources has any. */
export function redactionExportPlan(
  ws: Workspace,
  doc: VirtualDocument,
): RedactionExportPlan | undefined {
  const bySource = new Map<SourceId, RedactionPlan[]>();
  /** Per plan (by identity): whether one of its later marks lies on one of its areas. */
  const marked = new Set<RedactionPlan>();
  ws.engineEdits.forEach((edit, index) => {
    const plan = redactionPlanOf(edit);
    if (!plan) return;
    const marks = createdAnnotations(ws.engineEdits.slice(index + 1), edit.source);
    const laterMarks = marks.map((mark) => mark.id);
    const withMarks = laterMarks.length > 0 ? { ...plan, laterMarks } : plan;
    const onArea = marks.some(
      ({ pageIndex, bounds }) =>
        bounds !== undefined &&
        plan.areas.some((a) => a.pageIndex === pageIndex && overlaps(a.rect, bounds)),
    );
    if (onArea) marked.add(withMarks);
    bySource.set(edit.source, [...(bySource.get(edit.source) ?? []), withMarks]);
  });
  const used = new Set<SourceId>();
  for (const page of doc.pages) {
    if (page.ref.kind === 'source' && bySource.has(page.ref.source)) used.add(page.ref.source);
  }
  if (used.size === 0) return undefined;
  let unmappedAreas = 0;
  let laterMarksInAreas = false;
  const plans: RedactionPlan[] = [];
  for (const source of used) {
    for (const plan of bySource.get(source) ?? []) {
      if (marked.has(plan)) laterMarksInAreas = true;
      const areas: RedactionArea[] = [];
      doc.pages.forEach((page, outputIndex) => {
        if (page.ref.kind !== 'source' || page.ref.source !== source) return;
        const index = page.ref.index;
        const mine = plan.areas.filter((a) => a.pageIndex === index);
        if ((page as { readonly resize?: unknown }).resize !== undefined) {
          unmappedAreas += mine.length;
          return;
        }
        for (const area of mine) areas.push({ ...area, pageIndex: outputIndex });
      });
      plans.push({ ...plan, areas });
    }
  }
  return { sources: [...used], plans, unmappedAreas, laterMarksInAreas };
}
