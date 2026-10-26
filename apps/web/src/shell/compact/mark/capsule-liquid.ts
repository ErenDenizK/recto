/**
 * The capsule and ✎ as one body while the reading capsule morphs into the edit island and back
 * (DSN-43, the owner's "separate or joined, we can use merge", DSN-37), on the compositor
 * (MOT-14; R22 brief C-5). The two pieces take their new boxes at once and stop drawing their
 * own glass for the run; under them a body of their tier's solid twin (MOT-12: no backdrop
 * filter and no soft shadow on a moving surface) moves from the old shape to the new one by
 * Web Animations of `transform` alone, and once it rests the pieces' glass fades back in over
 * it while it fades out. Until R22 one masked glass layer was traced every frame to the union
 * of the two boxes while the capsule's width and ✎'s fold ran as layout; on the owner's iPhone
 * that stuttered whenever the island's mount kept the main thread busy.
 *
 * - **The capsule's shape** is three parts that never distort: its two round ends, each a
 *   circle that only translates, and the straight middle between their centres, which
 *   translates and scales along x (a rectangle scaled sideways keeps its edges).
 * - **✎** (beside the capsule) is a drop under the capsule's shape: entering, it travels from its place into the
 *   capsule's trailing end and shrinks there, absorbed; leaving, it grows out of that end into
 *   its place. With no ✎ beside the capsule (the single capsule, EDN-24, holds it inside), only
 *   the three parts move. Solid on solid, the two read as one body where they meet.
 * - **Timing** is the morph's spring, `smooth` (Q-6); content only fades (MOT-5,
 *   `capsule-morph.ts`). The body is drawn under the pieces (the dock is their stacking
 *   context), so their content stays on top.
 * - **At rest** nothing is left: no layer, attribute or inline style (Q-2). Reduced motion never
 *   fuses: the morph is a fade there (`morphCapsule`). GPU glass leaves a piece with
 *   `data-liquid` to CSS+ for the run (GLS-19).
 */
import { animateStyle, type Motion } from '../../../motion/animate';
import { glassMoving, glassSettle } from '../../../ui/glass-moving';

/** A material class (`materials.css`): the base, a tier and its σ or coverage step. */
const MATERIAL_CLASS = /^(?:mat(?:-[a-z]+)?|[sc]\d+)$/;
/** How small ✎'s drop is at the capsule's end. */
export const DROP_SCALE = 0.3;
/** The parts' rim: the unblurred light of a moving surface (GLS-22's sheets), no outer edge. */
const PARTS_RIM = 'inset 0 1px 0 var(--mat-rim-top), inset 0 -1px 0 var(--mat-rim-bottom)';
/** The body's fade once the pieces' glass is back, ms (`--duration-fast`). */
const HANDOVER_MS = 120;

/** A box in the dock's own coordinates, px. */
export interface DockBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** One part of the body: its box at rest and the transform it starts from, `[x, y, sx, sy]`. */
export interface BodyPart {
  readonly box: DockBox;
  readonly radius: number;
  readonly from: readonly [number, number, number, number];
  /** Scaled about its left edge (the middle), else about its centre. */
  readonly fromLeft?: boolean;
}

const IDENTITY = [0, 0, 1, 1] as const;

/**
 * The capsule's three parts from its old box `a` to its new box `b` (same height): the two round
 * ends translate, the middle between their centres translates and scales along x.
 */
export function capsuleParts(a: DockBox, b: DockBox): readonly BodyPart[] {
  const h = b.height;
  const r = h / 2;
  const end = (x: number, fromX: number): BodyPart => ({
    box: { x, y: b.y, width: h, height: h },
    radius: r,
    from: [fromX - x, a.y - b.y, 1, 1],
  });
  const span = Math.max(1, b.width - h);
  return [
    end(b.x, a.x),
    end(b.x + b.width - h, a.x + a.width - h),
    {
      box: { x: b.x + r, y: b.y, width: span, height: h },
      radius: 0,
      from: [a.x - b.x, a.y - b.y, Math.max(0.01, a.width - h) / span, 1],
      fromLeft: true,
    },
  ];
}

/**
 * ✎'s drop: `edit` is its box where it rests (entering: before; leaving: after), `end` the
 * capsule's trailing end where it is absorbed (entering: the new capsule's; leaving: the old's).
 * Entering, it rests at `edit` and moves to the end (`to`); leaving, it starts at the end.
 */
export function dropPart(edit: DockBox, end: DockBox): { box: DockBox; at: readonly number[] } {
  const dx = end.x + end.width / 2 - (edit.x + edit.width / 2);
  const dy = end.y + end.height / 2 - (edit.y + edit.height / 2);
  return { box: edit, at: [dx, dy, DROP_SCALE, DROP_SCALE] };
}

let running: (() => void) | null = null;

/** ✎ beside `capsule` (its sibling in the dock row). */
function editOf(capsule: HTMLElement): HTMLElement | null {
  return capsule.parentElement?.querySelector<HTMLElement>('[data-testid="compact-edit"]') ?? null;
}

/**
 * Fuses `capsule` and ✎ for one morph from the capsule's box before the change (`from`,
 * viewport px); both have their new boxes already. `restWidth` is ✎'s width at rest (56 px).
 * Returns the stop (also called by a newer run).
 */
export function fuseDock(capsule: HTMLElement, from: DOMRect, restWidth = 56): () => void {
  running?.();
  const edit = editOf(capsule);
  const dock = capsule.parentElement;
  if (!dock) return () => undefined;
  const host = dock.getBoundingClientRect();
  const local = (r: { x: number; y: number; width: number; height: number }): DockBox => ({
    x: r.x - host.x,
    y: r.y - host.y,
    width: r.width,
    height: r.height,
  });
  const a = local(from);
  const b = local(capsule.getBoundingClientRect());
  const entering = edit?.hasAttribute('data-away') ?? false;
  const gap = Number.parseFloat(getComputedStyle(dock).columnGap) || 0;
  // ✎ where it rests: entering, where it stood beside the old capsule; leaving, its new box.
  const editBox: DockBox | null = !edit
    ? null
    : entering
      ? {
          x: a.x + a.width + gap,
          y: a.y + (a.height - restWidth) / 2,
          width: restWidth,
          height: restWidth,
        }
      : local(edit.getBoundingClientRect());
  const oldEnd: DockBox = {
    x: a.x + a.width - a.height,
    y: a.y,
    width: a.height,
    height: a.height,
  };
  const newEnd: DockBox = {
    x: b.x + b.width - b.height,
    y: b.y,
    width: b.height,
    height: b.height,
  };
  const drop = editBox ? dropPart(editBox, entering ? newEnd : oldEnd) : null;

  const layer = document.createElement('div');
  layer.dataset.testid = 'compact-dock-liquid';
  layer.setAttribute('aria-hidden', 'true');
  // Under the pieces and their content (the dock is their stacking context).
  layer.style.cssText = 'position:absolute;inset:0;z-index:-1;pointer-events:none;';
  const material = [...capsule.classList].filter((name) => MATERIAL_CLASS.test(name)).join(' ');
  const part = (box: DockBox, radius: number, fromLeft = false) => {
    const el = document.createElement('div');
    el.className = material;
    // The tier's solid twin (MOT-12): nothing re-blurs while it moves. Its rim light only, no
    // outer edge, so the parts meet without a seam.
    glassMoving(el);
    el.style.cssText =
      `position:absolute;left:${box.x}px;top:${box.y}px;width:${box.width}px;` +
      `height:${box.height}px;margin:0;padding:0;border-radius:${radius}px;` +
      `--shadow-own:${PARTS_RIM};` +
      (fromLeft ? 'transform-origin:0 50%;' : '');
    layer.append(el);
    return el;
  };
  // ✎'s drop first, under the capsule's shape: it is absorbed into the end, and grows out of it.
  const motions: Motion<readonly number[]>[] = [];
  if (drop) {
    const dropEl = part(drop.box, drop.box.height / 2);
    motions.push(
      entering
        ? animateStyle(dropEl, 'transform', IDENTITY, drop.at, { spring: 'smooth', keep: true })
        : animateStyle(dropEl, 'transform', drop.at, IDENTITY, { spring: 'smooth' }),
    );
  }
  for (const p of capsuleParts(a, b)) {
    const el = part(p.box, p.radius, p.fromLeft);
    motions.push(animateStyle(el, 'transform', p.from, IDENTITY, { spring: 'smooth' }));
  }
  dock.prepend(layer);
  capsule.dataset.liquid = '';
  if (edit) edit.dataset.liquid = '';

  let stopped = false;
  let handover: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    stopped = true;
    clearTimeout(handover);
    for (const m of motions) m.stop();
    layer.remove();
    delete capsule.dataset.liquid;
    if (edit) delete edit.dataset.liquid;
    if (running === stop) running = null;
  };
  // At rest: the pieces' glass fades back in over the body, which fades out under it.
  void Promise.all(motions.map((m) => m.finished)).then(() => {
    if (stopped) return;
    for (const piece of edit ? [capsule, edit] : [capsule]) {
      delete piece.dataset.liquid;
      glassSettle(piece);
    }
    layer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: HANDOVER_MS, fill: 'forwards' });
    handover = setTimeout(stop, HANDOVER_MS);
  });
  running = stop;
  return stop;
}
