/**
 * Make shape (motion-2026-10/ink-shapes.md §8): the lasso bar's action that turns the
 * selected ink strokes into the shapes they are, after the fact.
 *
 * - **Recognition.** Each selected path runs through the hold's recogniser
 *   (`pen/shapes.ts`) in CSS px of the page as shown, with its fit limits and handwriting gate,
 *   but no hold and no writing context. A path that fits nothing stays as it is.
 * - **Commit.** One history entry ("Make shapes"): every recognised path leaves its Ink (an
 *   Ink with nothing left goes) and its shape is created as the hold commits it
 *   (`pen/shape-commit.ts shapeDraft`: /Line, /Square, /Circle, /Polygon, or clean ink), in the
 *   Ink's colour, opacity and width. One undo brings the strokes back. The selection clears.
 * - **Nothing fits.** The bar says so in its notice line ("No shape in the selection"), as
 *   it says that stamps keep their orientation, and announces it; nothing changes.
 * - **Morph.** In the task where the page draws its bitmap with the shapes (`onPageBitmap`),
 *   an overlay hides each new outline under a band of page colour and draws the stroke as it
 *   was; the stroke then morphs into the outline on the `smooth` spring, as a held shape does
 *   (`morphTarget`), and the overlay goes when it lands on the bitmap's own line. Reduced
 *   motion: no overlay, the shapes simply appear with the bitmap.
 */
import type { EngineEdit } from '@pdf-editor/document-model';
import type { Annotation, InkAnnotation } from '@pdf-editor/engine';

import { getEngineService } from '../../engine/engine-service';
import { m } from '../../i18n';
import { animate } from '../../motion/animate';
import { reducedMotion } from '../../motion/reduced-motion';
import { announce } from '../../shell/announcer';
import { onPageBitmap } from '../../viewer/read-controller';
import {
  activePathSelection,
  type PageTarget,
  pageKey,
  useAnnotationStore,
} from '../annotation-store';
import { executeEdit, readAnnotations, runAction } from '../edit-runner';
import { type PageFrame, roundRect, userToCss } from '../geometry';
import { boundsOf, type Point } from '../ink';
import { mountedLayers } from '../layer-registry';
import { morphTarget, MORPH_POINTS } from '../pen/shape-hold';
import { type ShapeDraft, shapeDraft } from '../pen/shape-commit';
import { outline, recognizeShape, resample, type ShapeFit } from '../pen/shapes';
import { useLassoNotice } from './edits';

/** One selected path and the shape it is. */
export interface ShapePlan {
  readonly id: string;
  readonly index: number;
  /** The path as drawn, CSS px. */
  readonly css: readonly Point[];
  readonly fit: ShapeFit;
}

/** The recognised paths among `picks` (ids → path indices) of `annotations`, through `frame`. */
export function planShapes(
  annotations: readonly Annotation[],
  picks: Readonly<Record<string, readonly number[]>>,
  frame: PageFrame,
): ShapePlan[] {
  const plans: ShapePlan[] = [];
  for (const [id, indices] of Object.entries(picks)) {
    const ink = annotations.find((a): a is InkAnnotation => a.id === id && a.kind === 'ink');
    if (!ink || ink.flags?.locked || ink.blendMode === 'multiply') continue;
    for (const index of indices) {
      const path = ink.paths[index];
      if (!path || path.length < 2) continue;
      const css = path.map((p) => userToCss(frame, p));
      const fit = recognizeShape(css).fits[0];
      if (fit) plans.push({ id, index, css, fit });
    }
  }
  return plans;
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

function stamped<T extends { author?: string; modified?: string }>(draft: T): T {
  const author = useAnnotationStore.getState().author.trim();
  return {
    ...draft,
    modified: new Date().toISOString(),
    ...(draft.author === undefined && author !== '' ? { author } : {}),
  };
}

/**
 * Commits `plans` on `target` as one history entry: the paths leave their Inks, the shapes
 * are created. Resolves to the number of shapes made, or undefined when nothing changed.
 */
export function commitShapes(
  target: PageTarget,
  plans: readonly ShapePlan[],
  frame: PageFrame,
): Promise<number | undefined> {
  return runAction(async (ctx) => {
    const engine = await import('@pdf-editor/engine/client');
    const list = await readAnnotations(target.source, target.pageIndex, ctx);
    const edits: EngineEdit[] = [];
    const drafts: ShapeDraft[] = [];
    const byInk = new Map<string, ShapePlan[]>();
    for (const plan of plans) byInk.set(plan.id, [...(byInk.get(plan.id) ?? []), plan]);
    for (const [id, taken] of byInk) {
      const ink = list.find((a): a is InkAnnotation => a.id === id && a.kind === 'ink');
      if (!ink || ink.flags?.locked) continue;
      const gone = new Set(taken.map((p) => p.index));
      const style = {
        color: ink.color ?? '#000000',
        opacity: ink.opacity ?? 1,
        strokeWidth: ink.strokeWidth,
      };
      for (const plan of taken) {
        drafts.push(shapeDraft(plan.fit.kind, plan.fit.geometry, frame, target.pageIndex, style));
      }
      const paths = ink.paths.filter((_, i) => !gone.has(i));
      if (paths.length === 0) {
        const done = await executeEdit(
          ctx,
          engineEdit('annotation.delete', target, { annotationId: id }),
        );
        edits.push(done.recorded);
        continue;
      }
      const widths = ink.widths?.filter((_, i) => !gone.has(i));
      const widest = Math.max(ink.strokeWidth, ...(widths?.flat() ?? []));
      const { widths: _old, ...rest } = ink;
      const kept: InkAnnotation = {
        ...rest,
        paths,
        ...(widths ? { widths } : {}),
        rect: roundRect(boundsOf(paths, widest / 2 + 1)),
      };
      const annotation = await engine.serializeAnnotation(stamped(kept));
      const done = await executeEdit(ctx, engineEdit('annotation.update', target, { annotation }));
      edits.push(done.recorded);
    }
    if (edits.length === 0) return undefined;
    for (const shape of drafts) {
      const annotation = await engine.serializeAnnotation(stamped(shape.draft));
      const done = await executeEdit(ctx, engineEdit('annotation.create', target, { annotation }));
      edits.push(done.recorded);
    }
    const label = m.lasso_history_shapes();
    announce(label);
    return { edits, label, value: drafts.length };
  });
}

const SVG = 'http://www.w3.org/2000/svg';

/**
 * The morph overlay (module comment): shown in the task of the first bitmap of revision
 * `revision` or later, each plan's stroke flowing into its outline, then gone.
 */
function morphOverlay(
  target: PageTarget,
  plans: readonly ShapePlan[],
  widths: readonly number[],
  colors: readonly string[],
  revision: number,
): void {
  const layer = mountedLayers.get(target.pageId);
  if (!layer || plans.length === 0) return;
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('data-shape-morph', '');
  Object.assign(svg.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    overflow: 'visible',
    pointerEvents: 'none',
    visibility: 'hidden',
  });
  const lines: { line: SVGPolylineElement; from: Point[]; to: Point[] }[] = [];
  plans.forEach((plan, i) => {
    const width = widths[i] ?? 2;
    const shape = outline(plan.fit.geometry);
    const mask = document.createElementNS(SVG, 'polyline');
    mask.setAttribute('points', shape.map((p) => `${p.x},${p.y}`).join(' '));
    mask.setAttribute('fill', 'none');
    mask.setAttribute('stroke', 'var(--page-background, #fff)');
    mask.setAttribute('stroke-width', String(width + 2));
    mask.setAttribute('stroke-linejoin', 'round');
    mask.setAttribute('stroke-linecap', 'round');
    const line = document.createElementNS(SVG, 'polyline');
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', colors[i] ?? '#000000');
    line.setAttribute('stroke-width', String(width));
    line.setAttribute('stroke-linejoin', 'round');
    line.setAttribute('stroke-linecap', 'round');
    const from = resample(plan.css, MORPH_POINTS);
    lines.push({ line, from, to: morphTarget(plan.fit.geometry, from) });
    svg.append(mask, line);
  });
  const draw = (t: number) => {
    for (const { line, from, to } of lines) {
      line.setAttribute(
        'points',
        from
          .map((p, i) => {
            const q = to[i] ?? p;
            return `${p.x + (q.x - p.x) * t},${p.y + (q.y - p.y) * t}`;
          })
          .join(' '),
      );
    }
  };
  draw(0);
  layer.element.appendChild(svg);
  let timer = 0;
  const stop = onPageBitmap((source, pageIndex, generation) => {
    if (source !== target.source || pageIndex !== target.pageIndex || generation < revision) {
      return;
    }
    stop();
    window.clearTimeout(timer);
    // The same task as the bitmap with the shapes: the strokes stand in, then morph onto them.
    svg.style.visibility = 'visible';
    animate(0, 1, {
      spring: 'smooth',
      onUpdate: draw,
      onComplete: () => svg.remove(),
    });
  });
  timer = window.setTimeout(() => {
    stop();
    svg.remove();
  }, 3000);
}

/**
 * The bar's Make shape: turns the recognised strokes of the lasso selection into shapes in
 * one history entry, with the morph; says so when none fits. Resolves to the shapes made.
 */
export async function makeShapes(): Promise<number> {
  const state = useAnnotationStore.getState();
  const selection = state.selection;
  const paths = activePathSelection(state);
  if (!selection || !paths) return 0;
  const layer = mountedLayers.get(selection.pageId);
  if (!layer) return 0;
  const target: PageTarget = {
    source: selection.source,
    pageIndex: selection.pageIndex,
    pageId: selection.pageId,
    position: selection.position,
  };
  const annotations = state.pages[pageKey(selection.source, selection.pageIndex)]?.annotations;
  const { frame } = layer;
  const plans = planShapes(annotations ?? [], paths.next ?? paths.paths, frame);
  if (plans.length === 0) {
    const message = m.lasso_no_shape();
    useLassoNotice.setState({ key: paths.key, message });
    announce(message);
    return 0;
  }
  const inks = new Map((annotations ?? []).map((a) => [a.id, a]));
  const widths = plans.map((p) => {
    const ink = inks.get(p.id);
    return (ink?.kind === 'ink' ? ink.strokeWidth : 1) * frame.scale;
  });
  const colors = plans.map((p) => inks.get(p.id)?.color ?? '#000000');
  const made = await commitShapes(target, plans, frame);
  if (made === undefined) return 0;
  useAnnotationStore.getState().select(null);
  if (!reducedMotion()) {
    const revision = getEngineService().pageRevision(target.source, target.pageIndex);
    morphOverlay(target, plans, widths, colors, revision);
  }
  return made;
}
