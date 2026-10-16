/**
 * The capsule and ✎ as one liquid body (DSN-43; the owner's "separate or joined, we can use
 * merge", DSN-37): while the reading capsule morphs into the edit island and back
 * (`capsule-morph.ts`), the capsule and the ✎ circle beside it stop drawing their own glass and
 * one glass layer under them takes the smooth union of the two (`liquid-mask.ts`: rounded-rect
 * SDF, smooth minimum, marching squares into a `mask-image`, GLS-3, GLS-4: a mask, never
 * `clip-path`). Entering, ✎ folds into the capsule's end as a shrinking drop on a neck that
 * swells in; leaving, it grows out of the end and pinches off as it comes to rest.
 *
 * - **Timing** is the morph's own: the capsule's width on `smooth`, ✎'s width, margin and fade
 *   on its CSS transitions (`CompactChrome.module.css`); this only follows the two boxes each
 *   frame while either moves, and ends with them. No timing token of its own.
 * - **The neck** follows how far ✎ has folded: none with ✎ at rest (so the union starts and
 *   ends as the two pieces at rest), the full fillet once it is a quarter folded.
 * - **The material** is the capsule's (`mat mat-bar s10`, its adaptive look's `data-theme`
 *   copied), its rim the union's outline stroked (`outlineRim`, DSN-42); the capsule keeps its
 *   drop shadow, both keep their content, which only fades (MOT-5). GPU glass leaves a piece with
 *   `data-liquid` to CSS+ for the run (GLS-19).
 * - **At rest** nothing is left: no layer, no attribute, no inline style (Q-2). Reduced motion
 *   never fuses: the morph is a fade there (`morphCapsule`).
 */
import {
  type LiquidRect,
  outlineMask,
  outlineRim,
  rimColorsOf,
  type RimColors,
  unionOutline,
} from '../liquid-mask';

/** The fillet between the capsule and ✎ at its fullest, CSS px (the menus' neck, DSN-39). */
export const DOCK_NECK = 24;
/** A run that never settles is let go after this, ms (long: a slowed review capture runs on). */
const LONGEST_MS = 10_000;
/** The folded share of ✎ at which the neck is whole. */
const NECK_AT = 0.25;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * ✎'s glass at a moment of the fold: a circle as wide as its box is now, centred in it, so it
 * shrinks into the capsule's end as a drop rather than as a sliver.
 */
export function dropShape(box: {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}): LiquidRect {
  const size = Math.max(0, Math.min(box.width, box.height));
  return {
    x: box.x + (box.width - size) / 2,
    y: box.y + (box.height - size) / 2,
    width: size,
    height: size,
    radius: size / 2,
  };
}

/** The neck for ✎ at `width` of its `rest` width: none at rest, whole once a quarter folded. */
export function neckFor(width: number, rest: number): number {
  if (rest <= 0) return 0;
  return DOCK_NECK * clamp01((1 - width / rest) / NECK_AT);
}

const capsuleShape = (r: DOMRect): LiquidRect => ({
  x: r.x,
  y: r.y,
  width: r.width,
  height: r.height,
  radius: r.height / 2,
});

let running: (() => void) | null = null;

/** ✎ beside `capsule` (its sibling in the dock row). */
function editOf(capsule: HTMLElement): HTMLElement | null {
  return capsule.parentElement?.querySelector<HTMLElement>('[data-testid="compact-edit"]') ?? null;
}

const moving = (el: Element) =>
  typeof el.getAnimations === 'function' &&
  el.getAnimations().some((a) => a.playState === 'running' || a.pending);

/**
 * Fuses `capsule` and ✎ for one morph; `restWidth` is ✎'s width at rest (56 px). Returns the
 * stop (also called by a newer run).
 */
export function fuseDock(capsule: HTMLElement, restWidth = 56): () => void {
  running?.();
  const edit = editOf(capsule);
  const dock = capsule.parentElement;
  if (!edit || !dock) return () => undefined;
  const layer = document.createElement('div');
  layer.className = 'mat mat-bar s10';
  layer.dataset.testid = 'compact-dock-liquid';
  layer.setAttribute('aria-hidden', 'true');
  const theme = capsule.getAttribute('data-theme');
  if (theme) layer.setAttribute('data-theme', theme);
  // Under the pieces and their content (the dock is their stacking context); its box follows
  // the union's, its border and shadows give way to the stroked rim.
  layer.style.cssText =
    'position:absolute;z-index:-1;margin:0;padding:0;border:0;border-radius:0;box-shadow:none;' +
    'pointer-events:none;mask-repeat:no-repeat;-webkit-mask-repeat:no-repeat;';
  const rimLayer = document.createElement('div');
  rimLayer.style.cssText =
    'position:absolute;inset:0;background-repeat:no-repeat;background-size:100% 100%;';
  layer.append(rimLayer);
  dock.prepend(layer);
  capsule.dataset.liquid = '';
  edit.dataset.liquid = '';
  let rim: RimColors | null = null;
  let frame = 0;
  let quiet = 0;
  const started = performance.now();

  const stop = () => {
    cancelAnimationFrame(frame);
    layer.remove();
    delete capsule.dataset.liquid;
    delete edit.dataset.liquid;
    if (running === stop) running = null;
  };

  const step = (now: number) => {
    if (!capsule.isConnected || !edit.isConnected) {
      stop();
      return;
    }
    const a = capsule.getBoundingClientRect();
    const b = edit.getBoundingClientRect();
    const host = dock.getBoundingClientRect();
    const drop = dropShape(b);
    const shapes = drop.width >= 1 ? [capsuleShape(a), drop] : [capsuleShape(a)];
    const left = Math.min(a.left, drop.width >= 1 ? drop.x : a.left);
    const right = Math.max(a.right, drop.width >= 1 ? drop.x + drop.width : a.right);
    const top = Math.min(a.top, b.top);
    const bottom = Math.max(a.bottom, b.bottom);
    const box = { x: left, y: top, width: right - left, height: bottom - top };
    const outline = unionOutline(box, shapes, neckFor(b.width, restWidth));
    layer.style.left = `${left - host.left}px`;
    layer.style.top = `${top - host.top}px`;
    layer.style.width = `${Math.ceil(box.width)}px`;
    layer.style.height = `${Math.ceil(box.height)}px`;
    const mask = outlineMask(outline);
    layer.style.setProperty('-webkit-mask-image', mask);
    layer.style.setProperty('mask-image', mask);
    rim ??= rimColorsOf(capsule);
    rimLayer.style.backgroundImage = outlineRim(outline, rim);
    // Ends with the morph: two still frames with nothing of the pair moving.
    quiet = moving(capsule) || moving(edit) ? 0 : quiet + 1;
    if (quiet >= 2 || now - started > LONGEST_MS) {
      stop();
      return;
    }
    frame = requestAnimationFrame(step);
  };
  running = stop;
  step(started);
  return stop;
}
