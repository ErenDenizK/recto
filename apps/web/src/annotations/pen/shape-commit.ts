/**
 * Committing a stroke held into a shape (motion-2026-10/ink-shapes.md §4): real PDF shapes
 * that Acrobat edits as such, two undo steps.
 *
 * - **Kinds.** A line is a /Line (an arrow a /Line with `/LE OpenArrow` at its end); a
 *   rectangle or square on the page's axes is a /Square; a circle, or an ellipse on the
 *   axes, a /Circle; any other polygon (a triangle, a rotated rectangle, a pentagon, a
 *   hexagon) a /Polygon. A rotated ellipse, which no PDF shape carries, is an Ink of the
 *   clean outline. All take the pen's colour, opacity and nominal width; a /Square's and a
 *   /Circle's /Rect is the outline's box grown by half the width, since their border is
 *   drawn inside it.
 * - **Undo.** The stroke as drawn is committed first (an Ink, its own history entry), then
 *   replaced by the shape in a second entry: one undo brings the raw stroke back, a second
 *   removes it. Both entries carry `ink-shape:` keys, which the dry ink layer treats as
 *   strokes (the page does not re-render between them, so the raw stroke never flashes).
 * - **The chip.** A tap on the lingering chip replaces the shape with the next-best fit
 *   inside the second entry (same key), so undo still returns to the raw stroke.
 * - **Drawing.** The outline settles into the dry ink layer at once (`drySettle`) and the
 *   page bitmap takes it over once the shape is committed.
 */
import type { EngineEdit } from '@pdf-editor/document-model';
import type { NewAnnotation } from '@pdf-editor/engine';

import { m } from '../../i18n';
import { presentError } from '../../errors/present';
import { announce } from '../../shell/announcer';
import { createAnnotations } from '../actions';
import { type PageTarget, type ToolStyle, useAnnotationStore } from '../annotation-store';
import { executeEdit, readAnnotations, runAction } from '../edit-runner';
import {
  cssPointToUser,
  type DisplayKind,
  type PageFrame,
  roundRect,
  userToCss,
} from '../geometry';
import { boundsOf, finishInkStroke, type Point } from '../ink';
import { createLabel } from '../labels';
import { closeBurst } from './bursts';
import { inkCommitted } from './dry-ink';
import type { InkShape, SettleInk } from './ink-input';
import { previewPath } from './ink-preview';
import { axisAligned, outline } from './shape-outline';
import type { ShapeGeometry, ShapeKind } from './shapes';

/** History keys of shape commits start with this (the dry ink layer reads it as a stroke). */
export const SHAPE_KEY_PREFIX = 'ink-shape:';

/** What a shape becomes in the file, and the kind its history label names. */
export interface ShapeDraft {
  readonly draft: NewAnnotation;
  readonly label: DisplayKind;
}

const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

/** The annotation a shape (CSS px through `frame`) commits as, in `style`. */
export function shapeDraft(
  kind: ShapeKind,
  g: ShapeGeometry,
  frame: PageFrame,
  pageIndex: number,
  style: Pick<ToolStyle, 'color' | 'opacity' | 'strokeWidth'>,
): ShapeDraft {
  const w = style.strokeWidth;
  const base = { pageIndex, color: style.color, opacity: style.opacity, strokeWidth: w };
  const user = (p: Point) => cssPointToUser(frame, p);
  if (g.type === 'line') {
    const vertices = [user(g.a), user(g.b)];
    return {
      draft: {
        ...base,
        kind: 'line',
        rect: roundRect(boundsOf([vertices], w / 2 + 6)),
        vertices,
        ...(g.arrow ? { lineEndings: { start: 'none', end: 'open-arrow' } } : {}),
      },
      label: g.arrow ? 'arrow' : 'line',
    };
  }
  const path = outline(g).map(user);
  if (g.type === 'polygon') {
    const vertices = g.vertices.map(user);
    if (axisAligned(vertices, 1e-3) && (kind === 'rectangle' || kind === 'square')) {
      return {
        draft: { ...base, kind: 'square', rect: roundRect(boundsOf([vertices], w / 2)) },
        label: 'square',
      };
    }
    return {
      draft: {
        ...base,
        kind: 'polygon',
        rect: roundRect(boundsOf([vertices], w / 2 + 1)),
        vertices,
      },
      label: 'polygon',
    };
  }
  // An ellipse on the page's axes (or a circle) is a /Circle; a turned one is clean ink.
  const onAxes = near(g.rx, g.ry) || near(Math.sin(2 * g.angle), 0);
  if (onAxes) {
    return {
      draft: { ...base, kind: 'circle', rect: roundRect(boundsOf([path], w / 2)) },
      label: 'circle',
    };
  }
  return {
    draft: {
      ...base,
      kind: 'ink',
      paths: [path],
      widths: [path.map(() => w)],
      rect: roundRect(boundsOf([path], w / 2 + 1)),
    },
    label: 'ink',
  };
}

function stamped<T extends { author?: string; modified?: string }>(draft: T): T {
  const author = useAnnotationStore.getState().author.trim();
  return {
    ...draft,
    modified: new Date().toISOString(),
    ...(draft.author === undefined && author !== '' ? { author } : {}),
  };
}

function engineEdit(kind: EngineEdit['kind'], target: PageTarget, payload: unknown): EngineEdit {
  return {
    id: globalThis.crypto.randomUUID(),
    source: target.source,
    pageIndex: target.pageIndex,
    kind,
    payload,
  };
}

/**
 * Replaces annotation `id` (the raw stroke, or the shape a chip tap replaces) with `draft`,
 * as one history entry keyed `coalesceKey`. Resolves to the new annotation's id.
 */
export function replaceWithShape(
  target: PageTarget,
  id: string,
  shape: ShapeDraft,
  coalesceKey: string,
): Promise<string | undefined> {
  return runAction(async (ctx) => {
    const list = await readAnnotations(target.source, target.pageIndex, ctx);
    const current = list.find((a) => a.id === id);
    if (!current || current.flags?.locked) return undefined;
    const engine = await import('@pdf-editor/engine/client');
    const removed = await executeEdit(
      ctx,
      engineEdit('annotation.delete', target, { annotationId: id }),
    );
    const created = await executeEdit(
      ctx,
      engineEdit('annotation.create', target, {
        annotation: await engine.serializeAnnotation(stamped(shape.draft)),
      }),
    );
    const label = createLabel(shape.label, target.position);
    announce(label);
    return {
      edits: [removed.recorded, created.recorded],
      label,
      value: created.annotation?.id,
      coalesceKey,
      coalesceWindowMs: Number.POSITIVE_INFINITY,
    };
  });
}

/**
 * Commits a stroke held into a shape (see the module comment): the outline settles into the
 * dry ink, the raw stroke is committed, then replaced by the shape; the chip's later fits
 * replace the shape within the same entry.
 */
export async function commitShapeStroke(
  shape: InkShape,
  settle: SettleInk,
  frame: PageFrame,
  target: PageTarget,
  style: ToolStyle,
): Promise<void> {
  // A shape is never part of a pen burst (and nothing may append to its raw stroke).
  closeBurst();
  const nominal = style.strokeWidth;
  const first = shapeDraft(shape.kind, shape.geometry, frame, target.pageIndex, style);
  const line = outline(shape.geometry).map((p) => cssPointToUser(frame, p));
  const release = settle(
    previewPath(
      line.map((p) => userToCss(frame, p)),
      line.map(() => nominal * frame.scale),
    ),
  );
  const raw = finishInkStroke(
    shape.raw.points.map((p, i) => ({
      ...cssPointToUser(frame, p),
      w: shape.raw.widths[i] ?? nominal,
    })),
  );
  const widest = Math.max(nominal, ...raw.widths);
  const key = `${SHAPE_KEY_PREFIX}${globalThis.crypto.randomUUID()}`;
  let shapeId: string | undefined;
  try {
    const created = await createAnnotations(
      target,
      [
        {
          kind: 'ink',
          pageIndex: target.pageIndex,
          opacity: style.opacity,
          color: style.color,
          strokeWidth: nominal,
          paths: [raw.points],
          widths: [raw.widths],
          rect: roundRect(boundsOf([raw.points], widest / 2 + 1)),
        },
      ],
      { select: false, coalesceKey: `${SHAPE_KEY_PREFIX}raw:${globalThis.crypto.randomUUID()}` },
    );
    const rawId = created?.[0]?.id;
    if (rawId !== undefined) shapeId = await replaceWithShape(target, rawId, first, key);
  } catch (error) {
    console.warn('Saving the shape failed', error);
  }
  if (shapeId === undefined) {
    presentError({ kind: 'message', text: m.annot_stroke_not_saved(), blocking: true });
    release();
    shape.onNext(null);
    return;
  }
  await inkCommitted(release, target.source, target.pageIndex);
  release();
  let current = shapeId;
  shape.onNext((kind, geometry) => {
    void replaceWithShape(
      target,
      current,
      shapeDraft(kind, geometry, frame, target.pageIndex, style),
      key,
    ).then((id) => {
      if (id !== undefined) current = id;
    });
  });
}
