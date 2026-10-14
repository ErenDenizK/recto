/**
 * The overview morph (MOB-2; `docs/research/phone-2026-10/pinch-overview.md` §2.1, §3.2): the
 * page being read shrinks into its tile while the grid grows around it, and back.
 *
 * - **Layers, not layout.** Two layers move by `transform` (`morph-geometry.ts`): the grid's
 *   plane, scaled up at the start so the anchor's tile lies on the page, and the reader's stage,
 *   which ends with the page on its tile. The other tiles, the reader's other pages and the
 *   overview's bar fade by `opacity`. Nothing lays out during the move; the anchor's own tile
 *   is hidden while the reader's (sharp) page stands in for it.
 * - **Web Animations, scrubbed.** A pinch holds every animation paused and sets its
 *   `currentTime` from the fingers (progress × `SCRUB_MS`), so the gesture *is* the animation's
 *   clock (PRC-14). On release new animations run from where the fingers left them, on
 *   `smooth` with the release velocity (`springToLinear`, as the sheet's release, Q-7), to the
 *   grid when armed or back to the page. The button path (Pages) and the way back (a tile, Done,
 *   Esc, a spread) play the same move by themselves on `glide`.
 * - **At rest** no animation is left: the open grid and the reader are plain layout, untransformed
 *   (Q-2). The reader is hidden and inert while the overview is open.
 * - **Reduced motion** (MOT-2): no morph; the overview and the reader cross-fade in 150 ms.
 *
 * Focus lands on the current page's tile on the way in and back on the pages on the way out;
 * both are announced ("Pages grid. 12 pages. Page 3." / "Page 7 of 12", as the tablet's grid).
 */
import { flushSync } from 'react-dom';

import { m } from '../../../i18n';
import { reducedMotion } from '../../../motion/reduced-motion';
import { springToLinear } from '../../../motion/springs';
import { duration, EASE } from '../../../motion/tokens';
import { useViewStore } from '../../../state/view-store';
import { pagesPhrase } from '../../../state/workspace-store';
import { announce } from '../../announcer';
import { setOverview, useCompactStore } from '../compact-store';
import { overviewReader, type OverviewReader } from '../overview-host';
import {
  affineCss,
  type Affine,
  fall,
  fitOnto,
  IDENTITY,
  lerpAffine,
  type Point,
  project,
  rise,
  sample,
  type Track,
} from './morph-geometry';
import type { Box } from './overview-layout';

/** The scrub domain: progress p shows at `currentTime` p × this, ms. */
export const SCRUB_MS = 1000;
/** Samples of a bent (fading) track per move. */
const FADE_STEPS = 8;
/** The way back waits at most this many frames for the reader to mount the page. */
const MOUNT_FRAMES = 30;
/** The pinch chip sits this far above the fingers' midpoint (05-canvas §4). */
const CHIP_LIFT = 24;

/** What the overview lends the morph (`CompactOverview.tsx`). */
export interface OverviewDom {
  readonly root: HTMLElement;
  readonly scroller: HTMLElement;
  /** The layer every tile sits in; the morph scales it. */
  readonly plane: HTMLElement;
  /** The tiles but the anchor's, which fade in together. */
  readonly others: HTMLElement;
  readonly bar: HTMLElement;
  /** Page `index`'s tile (the page's own box) in the plane's coordinates. */
  tileBox(index: number): Box | null;
  /** The tile's button, once mounted. */
  tileButton(index: number): HTMLElement | null;
  /** The document's page count. */
  pageCount(): number;
}

let dom: OverviewDom | null = null;

/** Lends the overview's elements to the morph; returns the withdrawal. */
export function registerOverviewDom(next: OverviewDom): () => void {
  dom = next;
  return () => {
    if (dom === next) dom = null;
  };
}

/** The pinch chip, mounted whenever the chunk is (a reduced-motion pinch shows it too). */
export interface OverviewChip {
  /** The overview's root, which the chip is placed in. */
  readonly root: HTMLElement;
  readonly chip: HTMLElement;
  readonly text: HTMLElement;
}

let chipParts: OverviewChip | null = null;

/** Lends the pinch chip to the gestures; returns the withdrawal. */
export function registerOverviewChip(next: OverviewChip): () => void {
  chipParts = next;
  return () => {
    if (chipParts === next) chipParts = null;
  };
}

/** The viewport height the grid centres the anchor's tile on as it mounts (null: the middle). */
let entryY: number | null = null;

/** Where the grid should put the anchor's tile as it mounts for a morph, once. */
export function takeEntryY(): number | null {
  const y = entryY;
  entryY = null;
  return y;
}

/** A move is running (a settle or the way back): new gestures wait for it. */
let busy = false;

export function morphBusy(): boolean {
  return busy;
}

interface Part {
  readonly el: HTMLElement;
  readonly property: 'transform' | 'opacity';
  readonly track: Track<string | number>;
  /** A linear track needs two keyframes; a bent one is sampled. */
  readonly linear: boolean;
}

function origin(el: HTMLElement): Point {
  const rect = el.getBoundingClientRect();
  return { x: rect.left, y: rect.top };
}

/**
 * One morph between the reader's page `anchor` and its tile: the parts that move and their
 * tracks over the progress p (0 the page, 1 the grid).
 */
class Morph {
  private animations: Animation[] = [];
  private readonly parts: Part[];
  private readonly view: OverviewDom;

  constructor(
    readonly anchor: number,
    view: OverviewDom,
    port: OverviewReader,
  ) {
    this.view = view;
    const page = port.pageBox(anchor);
    const tile = view.tileBox(anchor);
    const parts: Part[] = [];
    if (page && tile) {
      const stageOrigin = origin(port.stage);
      const planeOrigin = origin(view.plane);
      const pageOnScreen = project(IDENTITY, stageOrigin, page);
      const tileOnScreen = project(IDENTITY, planeOrigin, tile);
      const planeFrom = fitOnto(tile, planeOrigin, pageOnScreen);
      const stageTo = fitOnto(page, stageOrigin, tileOnScreen);
      const transform = (from: Affine, to: Affine) => (p: number) =>
        affineCss(lerpAffine(from, to, p));
      parts.push(
        {
          el: view.plane,
          property: 'transform',
          track: transform(planeFrom, IDENTITY),
          linear: true,
        },
        {
          el: port.stage,
          property: 'transform',
          track: transform(IDENTITY, stageTo),
          linear: true,
        },
      );
      for (const el of port.stage.querySelectorAll<HTMLElement>(':scope > [data-page-index]')) {
        if (el.dataset.pageIndex === String(anchor)) continue;
        parts.push({ el, property: 'opacity', track: fall(0, 0.35), linear: false });
      }
    }
    parts.push(
      { el: view.others, property: 'opacity', track: rise(0.2, 0.8), linear: false },
      { el: view.bar, property: 'opacity', track: rise(0.5, 1), linear: false },
    );
    this.parts = parts;
  }

  /** Runs every part from progress `from` to `to` with `timing`; paused for a scrub. */
  private run(from: number, to: number, timing: KeyframeAnimationOptions, paused: boolean) {
    this.cancel();
    this.view.plane.setAttribute('data-hide-anchor', '');
    this.animations = this.parts.map((part) => {
      const frames = sample(part.track, from, to, part.linear ? 1 : FADE_STEPS).map(
        ({ offset, value }) => ({ offset, [part.property]: String(value) }),
      );
      const animation = part.el.animate(frames, { fill: 'both', ...timing });
      if (paused) animation.pause();
      return animation;
    });
  }

  /** Holds the morph at progress `p` (the pinch's frames). */
  scrub(p: number): void {
    if (this.animations.length === 0) {
      this.run(0, 1, { duration: SCRUB_MS, easing: 'linear' }, true);
    }
    for (const animation of this.animations) animation.currentTime = p * SCRUB_MS;
  }

  /** Springs from progress `from` to `to` on `smooth` (or `glide`) with `velocity`. */
  settle(from: number, to: 0 | 1, velocity: number, token: 'smooth' | 'glide'): Promise<void> {
    const curve = springToLinear(token, velocity);
    this.run(from, to, { duration: curve.duration, easing: curve.easing }, false);
    return Promise.all(this.animations.map((a) => a.finished)).then(
      () => undefined,
      () => undefined,
    );
  }

  /** Drops every animation: what rests is the layout as it is. */
  cancel(): void {
    for (const animation of this.animations) animation.cancel();
    this.animations = [];
    this.view.plane.removeAttribute('data-hide-anchor');
  }
}

/** Shows the pinch chip `text` above the fingers' midpoint, or hides it (null). */
export function showChip(text: string | null, centre?: Point): void {
  const view = chipParts;
  if (!view) return;
  const chip = view.chip;
  if (text === null || !centre) {
    chip.removeAttribute('data-shown');
    chip.hidden = true;
    return;
  }
  if (view.text.textContent !== text) view.text.textContent = text;
  chip.hidden = false;
  const width = chip.offsetWidth;
  const height = chip.offsetHeight;
  const root = view.root.getBoundingClientRect();
  const x = Math.min(
    Math.max(8, centre.x - root.left - width / 2),
    Math.max(8, root.width - width - 8),
  );
  const y = Math.max(8, centre.y - root.top - CHIP_LIFT - height);
  chip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  chip.setAttribute('data-shown', '');
}

/** Says the overview opened and puts the focus on the anchor's tile. */
function arrived(anchor: number): void {
  const count = dom?.pageCount() ?? 0;
  dom?.tileButton(anchor)?.focus({ preventScroll: true });
  announce(m.grid_announce_enter({ pages: pagesPhrase(count), page: anchor + 1 }));
}

/** Says the reader is back and puts the focus on its pages. */
function left(port: OverviewReader, index: number, count: number): void {
  port.scroller.focus({ preventScroll: true });
  announce(m.grid_announce_leave({ page: index + 1, count }));
}

/** Cross-fades the overview in or out over the reader (reduced motion), ms ≤ 150. */
function crossFade(view: OverviewDom, port: OverviewReader, open: boolean): Promise<void> {
  const time = duration('base');
  const shown = [{ opacity: 0 }, { opacity: 1 }];
  const hidden = [{ opacity: 1 }, { opacity: 0 }];
  const options = { duration: time, easing: EASE.out, fill: 'both' as const };
  const fades = [
    view.root.animate(open ? shown : hidden, options),
    port.scroller.animate(open ? hidden : shown, options),
  ];
  return Promise.all(fades.map((f) => f.finished)).then(
    () => {
      for (const fade of fades) fade.cancel();
    },
    () => undefined,
  );
}

/** The grid's anchor height for a page the reader shows at `box` (viewport): its middle. */
function entryHeight(port: OverviewReader, box: Box | null): number {
  const view = port.scroller.getBoundingClientRect();
  if (!box) return view.top + view.height / 2;
  const origin = port.stage.getBoundingClientRect();
  const top = Math.max(view.top, origin.top + box.top);
  const bottom = Math.min(view.bottom, origin.top + box.top + box.height);
  const middle = bottom > top ? (top + bottom) / 2 : view.top + view.height / 2;
  return Math.min(view.top + view.height * 0.7, Math.max(view.top + view.height * 0.3, middle));
}

/** Mounts the grid for a morph anchored on page `anchor`; null when it cannot run. */
function mount(anchor: number, port: OverviewReader): OverviewDom | null {
  port.settle();
  entryY = entryHeight(port, port.pageBox(anchor));
  flushSync(() => setOverview('morph', anchor));
  entryY = null;
  if (!dom) {
    flushSync(() => setOverview('closed'));
    return null;
  }
  return dom;
}

/** A pinch below fit width driving the morph (`CompactReader.tsx`). */
export interface PinchMorph {
  /** The morph at progress `p` (0 the page, 1 the grid); the chip while `armed`. */
  scrub(p: number, armed: boolean, centre: Point): void;
  /** The fingers lifted: to the grid if `open`, else back; `velocity` toward that end. */
  release(open: boolean, velocity: number): void;
  /** Back to the page at once (the pinch turned into a zoom). */
  cancel(): void;
}

/**
 * Starts a pinch's morph anchored on the reader's page `anchor`, or null when it cannot run
 * (no reader, reduced motion, already open or moving): the reader then rubber-bands.
 */
export function beginPinchMorph(anchor: number): PinchMorph | null {
  const port = overviewReader();
  if (!port || busy || reducedMotion() || useCompactStore.getState().overview !== 'closed') {
    return null;
  }
  const view = mount(anchor, port);
  if (!view) return null;
  const morph = new Morph(anchor, view, port);
  let progress = 0;
  morph.scrub(0);
  let done = false;
  return {
    scrub(p, armed, centre) {
      if (done) return;
      progress = p;
      morph.scrub(p);
      showChip(armed ? m.zoom_grid_chip() : null, centre);
    },
    release(open, velocity) {
      if (done) return;
      done = true;
      showChip(null);
      busy = true;
      void morph.settle(progress, open ? 1 : 0, velocity, 'smooth').then(() => {
        busy = false;
        flushSync(() => setOverview(open ? 'open' : 'closed'));
        morph.cancel();
        if (open) arrived(anchor);
      });
    },
    cancel() {
      if (done) return;
      done = true;
      showChip(null);
      flushSync(() => setOverview('closed'));
      morph.cancel();
    },
  };
}

/** Pages (MOB-2's button path): the same morph from the page being read, by itself. */
export function openOverview(): void {
  const port = overviewReader();
  if (!port || busy || useCompactStore.getState().overview !== 'closed') return;
  const anchor = useViewStore.getState().currentPage;
  const view = mount(anchor, port);
  if (!view) return;
  busy = true;
  // The morph's layers come off in the same task as the phase changes, before the focus moves
  // (a tile under `data-hide-anchor` is hidden, so not focusable).
  let morph: Morph | null = null;
  const finish = () => {
    busy = false;
    flushSync(() => setOverview('open'));
    morph?.cancel();
    arrived(anchor);
  };
  if (reducedMotion()) {
    void crossFade(view, port, true).then(finish);
    return;
  }
  morph = new Morph(anchor, view, port);
  morph.scrub(0);
  void morph.settle(0, 1, 0, 'glide').then(finish);
}

/** Resolves once the reader has mounted page `index` (or after `MOUNT_FRAMES` frames). */
function whenMounted(port: OverviewReader, index: number): Promise<void> {
  return new Promise((resolve) => {
    let frames = 0;
    const check = () => {
      const mounted = port.stage.querySelector(`:scope > [data-page-index="${index}"]`) !== null;
      if (mounted || frames++ >= MOUNT_FRAMES) resolve();
      else requestAnimationFrame(check);
    };
    check();
  });
}

/**
 * Back to the reader on page `index` (a tile, Done, Esc, a spread; MOB-2): the reader jumps
 * there while hidden, and the page grows out of its tile as the grid gathers into it.
 */
export function closeOverview(index?: number): void {
  const port = overviewReader();
  const state = useCompactStore.getState();
  if (!port || busy || state.overview !== 'open') return;
  const target = index ?? state.overviewAnchor;
  busy = true;
  port.reveal(target);
  void whenMounted(port, target).then(() => {
    const view = dom;
    const count = view?.pageCount() ?? 0;
    flushSync(() => setOverview('morph', target));
    let morph: Morph | null = null;
    const finish = () => {
      busy = false;
      flushSync(() => setOverview('closed'));
      morph?.cancel();
      left(port, target, count);
    };
    if (!view || reducedMotion()) {
      if (view) void crossFade(view, port, false).then(finish);
      else finish();
      return;
    }
    morph = new Morph(target, view, port);
    morph.scrub(1);
    void morph.settle(1, 0, 0, 'glide').then(finish);
  });
}
