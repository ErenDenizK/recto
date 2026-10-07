/**
 * The capsule's *bar morph* (language.md §7.3; quality-bar Q-6; ADR-0026 §2 item 5;
 * `03-markup.md` MK-1 §7): how one glass element changes from one content to another.
 *
 * - **Shape by its own geometry.** The capsule's own `width` and `height` move on
 *   `--spring-smooth` through the motion core (`animateStyle`), inside `contain: layout style`,
 *   with the pill radius throughout. Backdrop, rim, inner light and shadow belong to that one
 *   element, so they follow by construction: no `clip-path`, no `scaleX` on glass, no second
 *   shadow element, and the filter never changes (X20: no lens on the capsule). At rest the
 *   inline size is removed, so the capsule is its content's size again (Q-2: nothing left on it).
 *   The capsule clips its contents to its own box as it moves (`overflow: clip`), so a piece
 *   beyond the moving edge is never drawn.
 * - **Contents stay put.** Each content is a layer centred in the capsule, which is centred in
 *   the dock band, so a layer keeps its place on screen however wide the capsule is mid-morph;
 *   the capsule's edge reveals or covers it. The leaving layer is laid over the incoming one and
 *   is `inert` from its first frame (A-13).
 * - **A fade through, never a double print.** The leaving layer fades out in place on
 *   `--ease-exit` in `LEAVE_MS`; only once it is gone does the arriving content fade in, so two
 *   contents are never drawn over each other (the V2 review saw "Pages" and the highlighter
 *   print as one word when the two fades overlapped). A reversal mid-morph keeps the rule: the
 *   content that is leaving now fades from the opacity it has, and the one asked back waits for
 *   it, then fades in from the opacity it had kept.
 * - **Pieces by FLIP.** Content marks its pieces `data-capsule-item="<key>"`. A piece seen
 *   before slides from where it was drawn to its new place, translate only, so a label is never
 *   scaled (Q-8): the same element (a morph inside one content), or the leaving content's piece
 *   with that key when the two look the same (the dock's Pages and More into Locked), whose
 *   leaving twin then hides at once. A twin that looks different (the dock's Markup and the
 *   palette's Done, Fill & sign and Sign) is not the same piece: it fades out with its content
 *   and the new one fades in at its own place, rather than one label turning into another in
 *   flight. A slide never passes over another piece: a leaving piece in its path is gone before
 *   the slide reaches it, and a new piece in its path fades in only once the slide has passed
 *   (both read from the slide's spring). New pieces fade in 12 ms apart for at most ten
 *   (MP rule: ≤ 10 × 12 ms). There are no clones.
 * - **Interruptible.** Every move retargets from where it is with its velocity (Q-10): a size
 *   in flight keeps its spring, a piece mid-slide is stopped where it is drawn and slides on
 *   from there, and a leaving content asked back fades in from its present opacity.
 * - **Reduced motion** (§7.5): no size travel and no slides; a change of content is the same
 *   fade through in `--duration-fast` (100 ms reduced): out in half of it, then in, all within
 *   150 ms (A-9); a change inside one content is instant.
 *
 * The snapshot is read before React changes the DOM (`Capsule.tsx`'s `MorphBoundary`), the
 * morph runs right after, before paint, so the first frame is already the start of the motion.
 */
import { animateStyle, type Motion, stopTransform } from '../../motion/animate';
import { reducedMotion } from '../../motion/reduced-motion';
import { solve, springs } from '../../motion/springs';
import { duration, EASE } from '../../motion/tokens';

/** The attribute that names a piece of content across morphs. */
export const CAPSULE_ITEM = 'data-capsule-item';
/** The attribute a content puts on the control that takes focus when it arrives. */
export const CAPSULE_FOCUS = 'data-capsule-focus';
/** The gap between new pieces fading in, and how many get one (MP rule: ≤ 10 × 12 ms). */
export const STAGGER_MS = 12;
export const STAGGER_STEPS = 10;
/** The capsule keeps this far from each side of the band (01-frame F10 §2: 16 px). */
export const CAPSULE_EDGE = 16;
/**
 * How long the leaving content takes to fade out, ms: quick, so the arriving content can follow
 * it at once (a fade through: the arriving content starts when this one is gone).
 */
export const LEAVE_MS = 90;
/** The opacity at or under which a piece reads as gone (a trace), for the overlap rule. */
export const TRACE_OPACITY = 0.1;
/** Moves and size changes smaller than this (CSS px) are not animated. */
const STILL = 0.5;
/** The id of an arriving fade, so a content that leaves mid-fade can hold it where it is. */
const ARRIVE = 'capsule-arrive';
/** How far ahead a slide's path is read (ms), and in what steps: past `--spring-smooth`'s 99 %. */
const PATH_MS = 600;
const PATH_STEP_MS = 8;

const LAYER = '[data-capsule-layer]';

/** A box in viewport coordinates. */
export interface Box {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** A piece as drawn in a snapshot. */
export interface SnapshotItem {
  readonly element: Element;
  readonly rect: DOMRect;
  /** What it shows (its text and icon), so a twin that looks different is not slid into. */
  readonly look: string;
}

/** What was on screen just before a commit changed the capsule. */
export interface CapsuleSnapshot {
  /** The capsule's drawn size (mid-morph, the size in flight). */
  readonly width: number;
  readonly height: number;
  /** Each piece as drawn, by key; a piece of the content showing wins over a leaving one. */
  readonly items: ReadonlyMap<string, SnapshotItem>;
  /** The piece that had focus, if focus was in the capsule. */
  readonly focused: string | null;
  readonly hadFocus: boolean;
}

/** A layer's content key (`data-capsule-layer`). */
const keyOf = (layer: Element): string => layer.getAttribute('data-capsule-layer') ?? '';

/** The layer showing now (the one not leaving), or null. */
export function currentLayer(capsule: Element): HTMLElement | null {
  return capsule.querySelector<HTMLElement>(`:scope > ${LAYER}:not([data-leaving])`);
}

/** What a piece shows: its text and its icons' drawing. Two pieces that look alike can slide. */
export function lookOf(element: Element): string {
  const icons = [...element.querySelectorAll('svg')].map((svg) => svg.innerHTML).join('');
  return `${(element.textContent ?? '').trim()}\u0000${icons}`;
}

/** Reads the capsule as drawn. */
export function snapshotCapsule(capsule: HTMLElement): CapsuleSnapshot {
  const box = capsule.getBoundingClientRect();
  const items = new Map<string, SnapshotItem>();
  for (const element of capsule.querySelectorAll(`:scope > ${LAYER} [${CAPSULE_ITEM}]`)) {
    const key = element.getAttribute(CAPSULE_ITEM) ?? '';
    const leaving = element.closest(LAYER)?.hasAttribute('data-leaving') ?? false;
    if (leaving && items.has(key)) continue;
    items.set(key, { element, rect: element.getBoundingClientRect(), look: lookOf(element) });
  }
  const active = capsule.ownerDocument.activeElement;
  const hadFocus = active !== null && capsule.contains(active);
  return {
    width: box.width,
    height: box.height,
    items,
    focused: hadFocus
      ? (active?.closest(`[${CAPSULE_ITEM}]`)?.getAttribute(CAPSULE_ITEM) ?? null)
      : null,
    hadFocus,
  };
}

/**
 * The size the capsule rests at with `layer` showing: the layer's own size plus the capsule's
 * border and padding, no wider than the band allows (`max-width` in `Capsule.module.css`).
 */
export function restingSize(
  layer: { readonly width: number; readonly height: number },
  chrome: { readonly x: number; readonly y: number },
  room: number,
): { width: number; height: number } {
  return {
    width: Math.min(layer.width + chrome.x, Math.max(0, room)),
    height: layer.height + chrome.y,
  };
}

/** The delay of the `index`-th new piece (MP rule: at most ten steps of 12 ms). */
export function staggerDelay(index: number): number {
  return Math.min(Math.max(0, index), STAGGER_STEPS - 1) * STAGGER_MS;
}

/** True when two boxes share more than a pixel each way. */
export function boxesOverlap(a: Box, b: Box): boolean {
  return (
    Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
    Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1
  );
}

/** A slide: the piece's resting ink box, and the offset and velocity it starts from. */
export interface SlidePath {
  readonly ink: Box;
  readonly dx: number;
  readonly dy: number;
  readonly vx: number;
  readonly vy: number;
}

/** Where a slide draws its piece `t` ms after it starts (`--spring-smooth`, as `animateStyle`). */
export function slideBoxAt(path: SlidePath, t: number): Box {
  const [x] = solve(springs.smooth, path.dx, path.vx, t / 1000);
  const [y] = solve(springs.smooth, path.dy, path.vy, t / 1000);
  const { ink } = path;
  return { left: ink.left + x, top: ink.top + y, right: ink.right + x, bottom: ink.bottom + y };
}

/** The first moment (ms) a slide reaches `box`, or null if it never does. */
export function firstContact(paths: readonly SlidePath[], box: Box): number | null {
  for (let t = 0; t <= PATH_MS; t += PATH_STEP_MS) {
    if (paths.some((path) => boxesOverlap(slideBoxAt(path, t), box))) return t;
  }
  return null;
}

/** The moment (ms) every slide has left `box` for good, 0 if none ever crosses it. */
export function lastContact(paths: readonly SlidePath[], box: Box): number {
  for (let t = PATH_MS; t >= 0; t -= PATH_STEP_MS) {
    if (paths.some((path) => boxesOverlap(slideBoxAt(path, t), box))) return t + PATH_STEP_MS;
  }
  return 0;
}

/** A piece's ink: its box less padding and border, where its icon and label are drawn. */
function inkOf(element: Element, rect: DOMRect = element.getBoundingClientRect()): Box {
  const s = getComputedStyle(element);
  const n = (v: string) => Number.parseFloat(v) || 0;
  const inset = (a: string, b: string) => n(a) + n(b);
  const left = rect.left + inset(s.paddingLeft, s.borderLeftWidth);
  const right = rect.right - inset(s.paddingRight, s.borderRightWidth);
  const top = rect.top + inset(s.paddingTop, s.borderTopWidth);
  const bottom = rect.bottom - inset(s.paddingBottom, s.borderBottomWidth);
  // A piece whose padding is most of it (a separator, an icon button) is its box.
  return right - left < 2 || bottom - top < 2
    ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }
    : { left, top, right, bottom };
}

function chromeOf(capsule: HTMLElement): { x: number; y: number } {
  const s = getComputedStyle(capsule);
  const n = (v: string) => Number.parseFloat(v) || 0;
  return {
    x: n(s.borderLeftWidth) + n(s.borderRightWidth) + n(s.paddingLeft) + n(s.paddingRight),
    y: n(s.borderTopWidth) + n(s.borderBottomWidth) + n(s.paddingTop) + n(s.paddingBottom),
  };
}

/** The control focus moves to when content arrives with focus in the capsule. */
function focusTarget(layer: HTMLElement, piece: string | null): HTMLElement | null {
  const marked = layer.querySelector<HTMLElement>(`[${CAPSULE_FOCUS}]`);
  if (marked) return marked;
  if (piece !== null) {
    const twin = layer.querySelector<HTMLElement>(`[${CAPSULE_ITEM}="${CSS.escape(piece)}"]`);
    const control = twin?.matches('button, [tabindex]')
      ? twin
      : twin?.querySelector<HTMLElement>('button, [tabindex]');
    if (control) return control;
  }
  return (
    layer.querySelector<HTMLElement>('[tabindex="0"]') ??
    layer.querySelector<HTMLElement>('button:not([disabled])')
  );
}

/**
 * The parts of `layer` that fade in one by one: its new named pieces (not inside another new
 * one) and, between them, every unnamed part that holds no named piece (a stepper, a group's
 * plate), so nothing of the arriving content is drawn before its turn.
 */
function arrivingParts(layer: HTMLElement, fresh: ReadonlySet<Element>): HTMLElement[] {
  const parts: HTMLElement[] = [];
  // Inside a piece that slides, its own label and icon go with it: only new pieces fade there.
  const visit = (node: Element, sliding: boolean) => {
    for (const child of node.children) {
      if (!(child instanceof HTMLElement)) continue;
      const holdsPieces = child.querySelector(`[${CAPSULE_ITEM}]`) !== null;
      if (child.hasAttribute(CAPSULE_ITEM)) {
        if (fresh.has(child)) parts.push(child);
        else if (holdsPieces) visit(child, true);
      } else if (holdsPieces) {
        visit(child, sliding);
      } else if (!sliding) {
        parts.push(child);
      }
    }
  };
  visit(layer, false);
  return parts;
}

interface Planned {
  readonly element: HTMLElement;
  /** The leaving or earlier self it slides from; absent for a new piece. */
  readonly was?: SnapshotItem;
  readonly prior?: { value: readonly number[]; velocity: readonly number[] } | undefined;
  readonly now?: DOMRect;
}

/**
 * Runs the capsule's morphs. One per capsule; it keeps the size motions in flight and the
 * fades of leaving contents, so the next morph starts from them.
 */
export class CapsuleMorph {
  private width: Motion | null = null;
  private height: Motion | null = null;
  /** Each leaving content's fade, and when (performance.now()) it is gone. */
  private readonly fades = new Map<Element, { readonly fade: Animation; readonly end: number }>();

  /** @param left called with a leaving content's key once it has faded out. */
  constructor(private readonly left: (key: string) => void) {}

  /**
   * Morphs from `before` to what the capsule holds now. `newContent` is true when the content
   * changed (a layer left), false for a morph inside one content.
   */
  run(capsule: HTMLElement, before: CapsuleSnapshot, newContent: boolean): void {
    const layer = currentLayer(capsule);
    if (!layer) return;
    const reduced = reducedMotion();
    const now = performance.now();
    // A content asked back shows the pieces it had handed to the one that is now leaving.
    for (const handed of layer.querySelectorAll('[data-capsule-handed]')) {
      handed.removeAttribute('data-capsule-handed');
    }
    // Every read before the first write, so layout is computed once (flip.ts's rule).
    const planned = reduced ? [] : this.plan(layer, before);
    const back = this.fades.get(layer);
    this.fades.delete(layer);
    back?.fade.cancel();

    this.leave(capsule, reduced, now);
    // The arriving content waits until every leaving one is gone (a fade through).
    let gone = now;
    for (const { end } of this.fades.values()) gone = Math.max(gone, end);
    const wait = gone - now;

    const slides = planned.filter((p) => p.was);
    if (back) {
      this.comeBack(layer, wait);
    } else if (newContent && (reduced || slides.length === 0)) {
      // Nothing slides from the leaving content: the new one fades in whole once it is gone.
      layer.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: duration(reduced ? 'fast' : 'base'),
        easing: EASE.out,
        delay: wait,
        fill: 'backwards',
        id: ARRIVE,
      });
    }
    this.resize(capsule, layer, before, reduced);
    if (!reduced) {
      const paths = this.slide(slides);
      this.clearPaths(capsule, paths, now);
      // Pieces fade in one by one when some slide (they must wait for the slides to pass) or
      // inside one content (a group shown); a content that fades in whole has done so above.
      const oneByOne = !back && (newContent ? slides.length > 0 : before.items.size > 0);
      if (oneByOne) this.arrive(layer, planned, paths, newContent, wait);
    }

    // Focus that was in the capsule stays in it (MK-1 §6): on the arriving content's marked
    // control, the twin of the piece that had it, or its Tab stop.
    const active = capsule.ownerDocument.activeElement;
    const lost = before.hadFocus && (active === null || !layer.contains(active));
    if (lost) focusTarget(layer, before.focused)?.focus({ preventScroll: true });
  }

  /** Stops everything where it is (unmount). */
  dispose(): void {
    this.width?.stop();
    this.height?.stop();
    this.width = null;
    this.height = null;
    for (const { fade } of this.fades.values()) fade.cancel();
    this.fades.clear();
  }

  /**
   * Each named piece of the arriving content with what it slides from: the same element, or a
   * twin that looks the same; a piece with neither is new. Pieces in flight are stopped where
   * they are drawn and measured at their places.
   */
  private plan(layer: HTMLElement, before: CapsuleSnapshot): Planned[] {
    return [...layer.querySelectorAll<HTMLElement>(`[${CAPSULE_ITEM}]`)].map((element) => {
      const was = before.items.get(element.getAttribute(CAPSULE_ITEM) ?? '');
      if (!was || (was.element !== element && was.look !== lookOf(element))) return { element };
      const prior = stopTransform(element);
      return { element, was, prior, now: element.getBoundingClientRect() };
    });
  }

  /**
   * Leaving contents fade out in place from the opacity they have; a content that leaves while
   * it is still arriving holds its pieces' fades where they are.
   */
  private leave(capsule: HTMLElement, reduced: boolean, now: number): void {
    for (const leaving of capsule.querySelectorAll<HTMLElement>(
      `:scope > ${LAYER}[data-leaving]`,
    )) {
      if (this.fades.has(leaving)) continue;
      const from = Number(getComputedStyle(leaving).opacity);
      for (const a of leaving.getAnimations()) if (a.id === ARRIVE) a.cancel();
      for (const a of leaving.getAnimations({ subtree: true })) if (a.id === ARRIVE) a.pause();
      const length = (reduced ? duration('fast') / 2 : LEAVE_MS) * from;
      const fade = leaving.animate([{ opacity: from }, { opacity: 0 }], {
        duration: length,
        easing: EASE.exit,
        fill: 'forwards',
      });
      this.fades.set(leaving, { fade, end: now + length });
      fade.onfinish = () => {
        if (this.fades.get(leaving)?.fade !== fade) return;
        this.fades.delete(leaving);
        this.left(keyOf(leaving));
      };
    }
  }

  /** A content asked back fades in from the opacity it has, once the leaving ones are gone. */
  private comeBack(layer: HTMLElement, wait: number): void {
    const from = Number(getComputedStyle(layer).opacity);
    for (const a of layer.getAnimations({ subtree: true })) {
      if (a.id === ARRIVE && a.playState === 'paused') a.play();
    }
    if (from >= 1) return;
    layer.animate([{ opacity: from }, { opacity: 1 }], {
      duration: duration('fast') * (1 - from),
      easing: EASE.out,
      delay: wait,
      fill: 'backwards',
      id: ARRIVE,
    });
  }

  /** The capsule's own width and height, from the size in flight to the new resting size. */
  private resize(
    capsule: HTMLElement,
    layer: HTMLElement,
    before: CapsuleSnapshot,
    reduced: boolean,
  ): void {
    if (reduced) {
      // Instant: whatever is in flight stops, and the capsule is its content's size at once.
      for (const motion of [this.width, this.height]) motion?.stop();
      this.width = this.height = null;
      capsule.style.removeProperty('width');
      capsule.style.removeProperty('height');
      return;
    }
    const box = layer.getBoundingClientRect();
    const room =
      (capsule.parentElement?.clientWidth ?? Number.POSITIVE_INFINITY) - 2 * CAPSULE_EDGE;
    const to = restingSize(box, chromeOf(capsule), room);
    this.width = this.spring(capsule, 'width', this.width, before.width, to.width);
    this.height = this.spring(capsule, 'height', this.height, before.height, to.height);
  }

  private spring(
    capsule: HTMLElement,
    prop: 'width' | 'height',
    running: Motion | null,
    from: number,
    to: number,
  ): Motion | null {
    if (running) {
      running.retarget(to);
      return running;
    }
    if (Math.abs(from - to) < STILL) return null;
    const motion = animateStyle(capsule, prop, from, to, { spring: 'smooth' });
    void motion.finished.then(() => {
      if (prop === 'width' && this.width === motion) this.width = null;
      if (prop === 'height' && this.height === motion) this.height = null;
    });
    return motion;
  }

  /** Pieces seen before slide from where they were drawn; returns the paths they take. */
  private slide(slides: readonly Planned[]): SlidePath[] {
    const paths: SlidePath[] = [];
    for (const { element, was, prior, now } of slides) {
      if (!was || !now) continue;
      // The leaving twin hides at once: this piece is it, on its way.
      if (was.element !== element) was.element.setAttribute('data-capsule-handed', '');
      const dx = was.rect.left + was.rect.width / 2 - (now.left + now.width / 2);
      const dy = was.rect.top + was.rect.height / 2 - (now.top + now.height / 2);
      const [vx = 0, vy = 0] = prior?.velocity ?? [];
      if (Math.abs(dx) < STILL && Math.abs(dy) < STILL && Math.abs(vx) + Math.abs(vy) < STILL) {
        continue;
      }
      animateStyle(element, 'transform', [dx, dy], [0, 0], {
        spring: 'smooth',
        velocity: [vx, vy],
      });
      paths.push({ ink: inkOf(element, now), dx, dy, vx, vy });
    }
    return paths;
  }

  /**
   * A leaving piece a slide will pass over is gone before the slide reaches it: it fades out
   * on its own, ending at the moment of contact, if its content would still show by then.
   */
  private clearPaths(capsule: HTMLElement, paths: readonly SlidePath[], now: number): void {
    if (paths.length === 0) return;
    for (const [leaving, { end }] of this.fades) {
      if (!capsule.contains(leaving)) continue;
      for (const piece of leaving.querySelectorAll<HTMLElement>(`[${CAPSULE_ITEM}]`)) {
        if (piece.hasAttribute('data-capsule-handed') || piece.querySelector(`[${CAPSULE_ITEM}]`)) {
          continue;
        }
        const contact = firstContact(paths, inkOf(piece));
        if (contact === null || now + contact >= end) continue;
        piece.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: Math.max(16, contact),
          easing: 'linear',
          fill: 'forwards',
        });
      }
    }
  }

  /**
   * New pieces, and the unnamed parts between them, fade in after the leaving content is gone,
   * 12 ms apart; one in a slide's path waits until the slide has passed it.
   */
  private arrive(
    layer: HTMLElement,
    planned: readonly Planned[],
    paths: readonly SlidePath[],
    newContent: boolean,
    wait: number,
  ): void {
    const fresh = new Set<Element>(planned.filter((p) => !p.was).map((p) => p.element));
    const parts = newContent
      ? arrivingParts(layer, fresh)
      : planned
          .filter((p) => !p.was && !p.element.parentElement?.closest(`[${CAPSULE_ITEM}]`))
          .map((p) => p.element);
    // Read every box before the first fade is written.
    const passed = parts.map((part) => (paths.length > 0 ? lastContact(paths, inkOf(part)) : 0));
    parts.forEach((part, index) => {
      part.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: duration('base'),
        easing: EASE.out,
        delay: Math.max(wait + staggerDelay(index), passed[index] ?? 0),
        fill: 'backwards',
        id: ARRIVE,
      });
    });
  }
}
