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
 *   it, then fades in from the opacity it had kept (never jumping back to whole).
 * - **From the piece pressed** (motion-2026-10 `library-capsule.md` §5). A morph asked from a
 *   piece (a dock item pressed or activated by key) reveals its new content outward from that
 *   piece rather than the capsule's centre: the stagger is ordered by distance from it, and each
 *   part comes out of its side of it, starting `FLOW_SHARE` of the way back toward it (at most
 *   24 px) and settling on `smooth`, so Markup visibly opens out of the Markup button.
 * - **The edge brings the content** (owner, "Animation!"). A piece is never drawn cut by the
 *   moving edge: each part of the arriving content fades in once the capsule's edge has passed
 *   it, read from the width's own spring, so a wider content spreads out from the centre with
 *   the glass instead of being uncovered like a strip under a wipe. With nothing sliding, the
 *   parts also go centre-out 12 ms apart, so even a narrower content (the palette back into
 *   the dock) arrives as one gesture from the middle rather than as a block.
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
 *   from there, and a leaving content asked back fades in from its present opacity; a content
 *   turned away before any of it showed is gone at once, so the one asked back never waits.
 * - **Reduced motion** (§7.5): no size travel and no slides; a change of content is the same
 *   fade through in `--duration-fast` (100 ms reduced): out in half of it, then in, all within
 *   150 ms (A-9); a change inside one content is instant.
 *
 * The snapshot is read before React changes the DOM (`Capsule.tsx`'s `MorphBoundary`), the
 * morph runs right after, before paint, so the first frame is already the start of the motion.
 */
import { animateStyle, type Motion, stopTransform } from '../../motion/animate';
import { reducedMotion } from '../../motion/reduced-motion';
import { solve, springs, springToLinear } from '../../motion/springs';
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
/**
 * How far an arriving part starts toward the piece pressed: this share of its distance from it,
 * at most `FLOW_MAX_PX` (the dock item's content flows out of it, not across the capsule).
 */
export const FLOW_SHARE = 0.18;
export const FLOW_MAX_PX = 24;
/** `smooth` as a CSS curve, for the flow's own keyframes (they wait for the part's turn). */
const SMOOTH = springToLinear('smooth');

/** The offset an arriving part starts at, toward the origin `offset` px from it. */
export function flowOffset(offset: number): number {
  return -Math.sign(offset) * Math.min(Math.abs(offset) * FLOW_SHARE, FLOW_MAX_PX);
}

/** Moves and size changes smaller than this (CSS px) are not animated. */
const STILL = 0.5;
/** The id of an arriving fade, so a content that leaves mid-fade can hold it where it is. */
const ARRIVE = 'capsule-arrive';
/** The id of an arriving part's flow out of the piece pressed (its transform). */
const FLOW = 'capsule-flow';
/** The id of a leaving piece's own early fade, undone when its content is asked back. */
const CLEAR = 'capsule-clear';
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
  /**
   * Where the change was asked from (viewport x): the centre of the piece just pressed (a dock
   * item opening Markup, Done closing it), else of the piece that had focus (a key); null when
   * the change came from elsewhere (a shortcut on the page, the lock engaging).
   */
  readonly origin: number | null;
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

/**
 * Reads the capsule as drawn; `pressed` is the key of the piece a pointer has just pressed, if
 * any (`Capsule.tsx`), the morph's origin.
 */
export function snapshotCapsule(
  capsule: HTMLElement,
  pressed: string | null = null,
): CapsuleSnapshot {
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
  const focused = hadFocus
    ? (active?.closest(`[${CAPSULE_ITEM}]`)?.getAttribute(CAPSULE_ITEM) ?? null)
    : null;
  const from = items.get(pressed ?? focused ?? '')?.rect;
  return {
    width: box.width,
    height: box.height,
    items,
    focused,
    hadFocus,
    origin: from ? from.left + from.width / 2 : null,
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

/**
 * The capsule's width as it moves: the resting width `to` and, as the morph starts, the
 * displacement `x` from it and the velocity `v` (px/s), on `--spring-smooth` as `animateStyle`
 * drives it; `centre` is the capsule's centre line (viewport x) and `pad` its rim and padding
 * on each side.
 */
export interface EdgePath {
  readonly to: number;
  readonly x: number;
  readonly v: number;
  readonly centre: number;
  readonly pad: number;
}

/**
 * The first moment (ms) the capsule's edges have passed the middle of `box`, 0 when they
 * already have: its fade starts there, so by the time it reads (a quarter of `--duration-base`
 * on `--ease-out`) the edge is past it and nothing legible is drawn cut by the clip, while the
 * content keeps pace with the glass rather than trailing its spring's slow tail. A box beyond
 * the resting capsule is never passed: it shows once the width has come to rest (`PATH_MS`).
 */
export function uncoverTime(edge: EdgePath, box: Box): number {
  const middle = Math.abs((box.left + box.right) / 2 - edge.centre);
  const reach = middle + (box.right - box.left) / 4 + edge.pad;
  for (let t = 0; t <= PATH_MS; t += PATH_STEP_MS) {
    const [x] = solve(springs.smooth, edge.x, edge.v, t / 1000);
    if ((edge.to + x) / 2 >= reach - STILL) return t;
  }
  return PATH_MS;
}

/**
 * The first moment (ms) a narrowing capsule's edges reach `box`, so a leaving piece there would
 * start to be drawn cut; null when they never do.
 */
export function coverTime(edge: EdgePath, box: Box): number | null {
  const reach = Math.max(edge.centre - box.left, box.right - edge.centre) + edge.pad;
  for (let t = 0; t <= PATH_MS; t += PATH_STEP_MS) {
    const [x] = solve(springs.smooth, edge.x, edge.v, t / 1000);
    if ((edge.to + x) / 2 < reach - STILL) return t;
  }
  return null;
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
  /** The parts of a content that arrives part by part, so leaving can read how much shows. */
  private readonly parts = new WeakMap<Element, readonly HTMLElement[]>();

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
    // A content asked back fades in from the opacity its fade had left it at: read before the
    // fade is cancelled, which would draw it whole at once.
    const kept = back ? Number(getComputedStyle(layer).opacity) : 1;
    this.fades.delete(layer);
    back?.fade.cancel();

    this.leave(capsule, reduced, now);
    // The arriving content waits until every leaving one is gone (a fade through).
    let gone = now;
    for (const { end } of this.fades.values()) gone = Math.max(gone, end);
    const wait = gone - now;

    const slides = planned.filter((p) => p.was);
    if (back) {
      this.comeBack(layer, kept, wait);
    } else if (newContent && reduced) {
      // Reduced motion: the new content fades in whole once the leaving one is gone (§7.5).
      layer.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: duration('fast'),
        easing: EASE.out,
        delay: wait,
        fill: 'backwards',
        id: ARRIVE,
      });
    }
    const edge = this.resize(capsule, layer, before, reduced);
    if (!reduced) {
      const paths = this.slide(slides);
      this.clearPaths(capsule, paths, now);
      if (edge) this.clearEdge(capsule, edge, now);
      // A new content arrives part by part behind the edge; inside one content only what is
      // new arrives (a group shown); a content asked back still has its own fades.
      if (!back && (newContent || before.items.size > 0)) {
        this.arrive(layer, planned, paths, newContent, wait, edge, before.origin);
      }
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
      for (const a of element.getAnimations()) if (a.id === FLOW) a.finish();
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
      // How much of it shows: a content still arriving part by part shows its most opaque part
      // (none while it waits behind the edge), so turning it away takes only what is seen.
      const parts = this.parts.get(leaving);
      const shown = parts
        ? from * Math.max(0, ...parts.map((part) => Number(getComputedStyle(part).opacity)))
        : from;
      for (const a of leaving.getAnimations()) if (a.id === ARRIVE) a.cancel();
      for (const a of leaving.getAnimations({ subtree: true }))
        if (a.id === ARRIVE || a.id === FLOW) a.pause();
      const length = (reduced ? duration('fast') / 2 : LEAVE_MS) * shown;
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

  /** A content asked back fades in from the opacity `from` it had kept, once the leaving go. */
  private comeBack(layer: HTMLElement, from: number, wait: number): void {
    for (const a of layer.getAnimations({ subtree: true })) {
      if ((a.id === ARRIVE || a.id === FLOW) && a.playState === 'paused') a.play();
      // A piece that had cleared out of an edge's or a slide's way comes back the way it went.
      if (a.id === CLEAR) {
        a.reverse();
        a.onfinish = () => a.cancel();
      }
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

  /**
   * The capsule's own width and height, from the size in flight to the new resting size;
   * returns the path its edges take (null under reduced motion, where the size is instant).
   */
  private resize(
    capsule: HTMLElement,
    layer: HTMLElement,
    before: CapsuleSnapshot,
    reduced: boolean,
  ): EdgePath | null {
    if (reduced) {
      // Instant: whatever is in flight stops, and the capsule is its content's size at once.
      for (const motion of [this.width, this.height]) motion?.stop();
      this.width = this.height = null;
      capsule.style.removeProperty('width');
      capsule.style.removeProperty('height');
      return null;
    }
    const box = layer.getBoundingClientRect();
    const room =
      (capsule.parentElement?.clientWidth ?? Number.POSITIVE_INFINITY) - 2 * CAPSULE_EDGE;
    const chrome = chromeOf(capsule);
    const to = restingSize(box, chrome, room);
    this.width = this.spring(capsule, 'width', this.width, before.width, to.width);
    this.height = this.spring(capsule, 'height', this.height, before.height, to.height);
    // The layer is centred in the capsule, itself centred in the band, so the two share a
    // centre line at every width; the edges start from the width drawn, with its velocity.
    const width = this.width;
    return {
      to: to.width,
      x: width ? width.value - to.width : 0,
      v: width ? width.velocity : 0,
      centre: box.left + box.width / 2,
      pad: chrome.x / 2,
    };
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
          id: CLEAR,
          fill: 'forwards',
        });
      }
    }
  }

  /**
   * The narrowing edge never cuts a leaving piece either: each part of a leaving content the
   * edge reaches before the content's fade ends fades out on its own, gone at that moment.
   */
  private clearEdge(capsule: HTMLElement, edge: EdgePath, now: number): void {
    if (edge.x <= STILL) return;
    for (const [leaving, { end }] of this.fades) {
      if (!capsule.contains(leaving) || !(leaving instanceof HTMLElement)) continue;
      const named = new Set<Element>(leaving.querySelectorAll(`[${CAPSULE_ITEM}]`));
      const parts = arrivingParts(leaving, named).filter(
        (part) => !part.hasAttribute('data-capsule-handed'),
      );
      // Read every box before the first fade is written.
      const contacts = parts.map((part) => coverTime(edge, inkOf(part)));
      parts.forEach((part, index) => {
        const contact = contacts[index];
        if (contact == null || now + contact >= end) return;
        const from = Number(getComputedStyle(part).opacity);
        part.animate([{ opacity: from }, { opacity: 0 }], {
          duration: Math.max(16, contact),
          easing: EASE.exit,
          id: CLEAR,
          fill: 'forwards',
        });
      });
    }
  }

  /**
   * New pieces, and the unnamed parts between them, fade in after the leaving content is gone,
   * each once the capsule's edge has passed it, 12 ms apart (centre-out when nothing slides,
   * in reading order beside slides); one in a slide's path waits until the slide has passed it.
   */
  private arrive(
    layer: HTMLElement,
    planned: readonly Planned[],
    paths: readonly SlidePath[],
    newContent: boolean,
    wait: number,
    edge: EdgePath | null,
    origin: number | null,
  ): void {
    const fresh = new Set<Element>(planned.filter((p) => !p.was).map((p) => p.element));
    const parts = newContent
      ? arrivingParts(layer, fresh)
      : planned
          .filter((p) => !p.was && !p.element.parentElement?.closest(`[${CAPSULE_ITEM}]`))
          .map((p) => p.element);
    // Read every box before the first fade is written.
    const inks = parts.map((part) => inkOf(part));
    const passed = inks.map((ink) => (paths.length > 0 ? lastContact(paths, ink) : 0));
    const uncovered = inks.map((ink) => (edge ? uncoverTime(edge, ink) : 0));
    const order = parts.map((_, index) => index);
    // The reveal spreads from the piece pressed (a dock item into its tool), else the centre.
    const from = origin ?? edge?.centre ?? null;
    const offset = (index: number) => {
      const ink = inks[index] as Box;
      return from === null ? 0 : (ink.left + ink.right) / 2 - from;
    };
    if (paths.length === 0 && edge) {
      const off = (index: number) => Math.abs(offset(index));
      [...order].sort((a, b) => off(a) - off(b)).forEach((index, step) => (order[index] = step));
    }
    const flow = newContent && paths.length === 0 && origin !== null;
    if (newContent && paths.length === 0) this.parts.set(layer, parts);
    parts.forEach((part, index) => {
      const delay = Math.max(
        wait + staggerDelay(order[index] ?? index),
        passed[index] ?? 0,
        uncovered[index] ?? 0,
      );
      part.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: duration('base'),
        easing: EASE.out,
        delay,
        fill: 'backwards',
        id: ARRIVE,
      });
      // Flowing from the piece pressed: each part comes out from its side of it, a short way.
      const dx = flowOffset(offset(index));
      if (flow && Math.abs(dx) >= STILL) {
        part.animate([{ transform: `translateX(${dx}px)` }, { transform: 'none' }], {
          duration: SMOOTH.duration,
          easing: SMOOTH.easing,
          delay,
          fill: 'backwards',
          id: FLOW,
        });
      }
    });
  }
}
