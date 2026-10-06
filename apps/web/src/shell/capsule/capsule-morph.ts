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
 * - **Contents stay put.** Each content is a layer centred in the capsule, which is centred in
 *   the dock band, so a layer keeps its place on screen however wide the capsule is mid-morph;
 *   the capsule's edge reveals or covers it. The leaving layer is laid over the incoming one,
 *   `inert` from its first frame (A-13), and fades out in place on `--ease-exit`.
 * - **Items by FLIP.** Content marks its pieces `data-capsule-item="<key>"`. A piece whose key
 *   was on screen before (the same element, or the leaving content's piece with that key, such
 *   as the dock's Pages in Locked) slides from where it was drawn to its new place, translate
 *   only, so a label is never scaled (Q-8); its leaving twin hides at once. New pieces fade in,
 *   12 ms apart for at most ten (MP rule: ≤ 10 × 12 ms), once most of the leaving content has
 *   faded (a fade through, `FADE_THROUGH_MS`), so two rows never print over each other. There
 *   are no clones.
 * - **Interruptible.** Every move retargets from where it is with its velocity (Q-10): a size
 *   in flight keeps its spring, a piece mid-slide is stopped where it is drawn and slides on
 *   from there, and a leaving content asked back fades in from its present opacity.
 * - **Reduced motion** (§7.5): no size travel and no slides; a change of content is a
 *   cross-fade of `--duration-fast` (100 ms reduced), a change inside one content is instant.
 *
 * The snapshot is read before React changes the DOM (`Capsule.tsx`'s `MorphBoundary`), the
 * morph runs right after, before paint, so the first frame is already the start of the motion.
 */
import { animateStyle, type Motion, stopTransform } from '../../motion/animate';
import { reducedMotion } from '../../motion/reduced-motion';
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
 * How long a new content waits before its pieces fade in: most of the leaving content's
 * `--duration-fast` fade, so the two never read as one double-printed row (a fade through).
 */
export const FADE_THROUGH_MS = 80;
/** Moves and size changes smaller than this (CSS px) are not animated. */
const STILL = 0.5;

const LAYER = '[data-capsule-layer]';

/** What was on screen just before a commit changed the capsule. */
export interface CapsuleSnapshot {
  /** The capsule's drawn size (mid-morph, the size in flight). */
  readonly width: number;
  readonly height: number;
  /** Each piece as drawn, by key; a piece of the content showing wins over a leaving one. */
  readonly items: ReadonlyMap<string, { readonly element: Element; readonly rect: DOMRect }>;
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

/** Reads the capsule as drawn. */
export function snapshotCapsule(capsule: HTMLElement): CapsuleSnapshot {
  const box = capsule.getBoundingClientRect();
  const items = new Map<string, { element: Element; rect: DOMRect }>();
  for (const element of capsule.querySelectorAll(`:scope > ${LAYER} [${CAPSULE_ITEM}]`)) {
    const key = element.getAttribute(CAPSULE_ITEM) ?? '';
    const leaving = element.closest(LAYER)?.hasAttribute('data-leaving') ?? false;
    if (leaving && items.has(key)) continue;
    items.set(key, { element, rect: element.getBoundingClientRect() });
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
 * Runs the capsule's morphs. One per capsule; it keeps the size motions in flight and the
 * fades of leaving contents, so the next morph starts from them.
 */
export class CapsuleMorph {
  private width: Motion | null = null;
  private height: Motion | null = null;
  private readonly fades = new Map<Element, Animation>();

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
    // A content asked back shows the pieces it had handed to the one that is now leaving.
    for (const handed of layer.querySelectorAll('[data-capsule-handed]')) {
      handed.removeAttribute('data-capsule-handed');
    }

    this.fadeLayers(capsule, layer, reduced, newContent);
    this.resize(capsule, layer, before, reduced);
    if (!reduced) this.slide(layer, before, newContent);

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
    for (const fade of this.fades.values()) fade.cancel();
    this.fades.clear();
  }

  /** Leaving contents fade out in place; a content asked back fades in from where it is. */
  private fadeLayers(
    capsule: HTMLElement,
    layer: HTMLElement,
    reduced: boolean,
    newContent: boolean,
  ): void {
    const back = this.fades.get(layer);
    if (back) {
      const from = Number(getComputedStyle(layer).opacity);
      back.cancel();
      this.fades.delete(layer);
      layer.animate([{ opacity: from }, { opacity: 1 }], {
        duration: duration('fast') * (1 - from),
        easing: EASE.out,
      });
    } else if (newContent && (reduced || !layer.querySelector(`[${CAPSULE_ITEM}]`))) {
      // A content with no named pieces, or any content under reduced motion (a plain
      // cross-fade), fades in whole.
      layer.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: duration(reduced ? 'fast' : 'base'),
        easing: EASE.out,
        delay: reduced ? 0 : FADE_THROUGH_MS,
        fill: 'backwards',
      });
    }
    for (const leaving of capsule.querySelectorAll<HTMLElement>(
      `:scope > ${LAYER}[data-leaving]`,
    )) {
      if (this.fades.has(leaving)) continue;
      const fade = leaving.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: duration('fast'),
        easing: EASE.exit,
        fill: 'forwards',
      });
      this.fades.set(leaving, fade);
      fade.onfinish = () => {
        if (this.fades.get(leaving) !== fade) return;
        this.fades.delete(leaving);
        this.left(keyOf(leaving));
      };
    }
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

  /** Pieces seen before slide from where they were drawn; new pieces fade in. */
  private slide(layer: HTMLElement, before: CapsuleSnapshot, newContent: boolean): void {
    const pieces = [...layer.querySelectorAll<HTMLElement>(`[${CAPSULE_ITEM}]`)];
    // Every read before the first write, so layout is computed once (flip.ts's rule).
    const moves = pieces.map((element) => {
      const was = before.items.get(element.getAttribute(CAPSULE_ITEM) ?? '');
      if (!was) return { element, was: undefined, prior: undefined, now: undefined };
      const prior = stopTransform(element);
      return { element, was, prior, now: element.getBoundingClientRect() };
    });
    let fresh = 0;
    for (const { element, was, prior, now } of moves) {
      if (!was || !now) {
        if (newContent || before.items.size > 0) {
          element.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration: duration('base'),
            easing: EASE.out,
            delay: (newContent ? FADE_THROUGH_MS : 0) + staggerDelay(fresh++),
            fill: 'backwards',
          });
        }
        continue;
      }
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
    }
  }
}
