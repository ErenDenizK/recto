/**
 * Library ⇄ document (`02-library` L1 §7; language.md §7.3 *view change*; motion-2026-10
 * `library-capsule.md` §1): opening a card, its first page grows into the page of the reader;
 * going back to the Library, the page shrinks back into its card.
 *
 * - **A shared element.** One View Transition through `motion/`'s `viewTransition` (240 ms on the
 *   view change's spring, cut there), in which the card's sheet and the reader's page share
 *   `library-sheet`, named just before the old view is captured and just after React has drawn
 *   the new one, as the Pages grid names its page and cell (`grid-transition.ts`). A side
 *   without its element on screen (a card scrolled away, a page not laid out) leaves the pair
 *   unnamed: the view then only cross-fades, never morphs from a wrong place.
 * - **A sharp landing when it is cheap.** A View Transition captures the new view as soon as the
 *   update resolves, and the arriving page's canvas may not have drawn yet. The update waits up
 *   to `DRAW_BUDGET_MS` for it. If it shows a bitmap in time (a preview or the render), the two
 *   images cross-fade from 60 % of the flight. If not, the old image travels alone and the live
 *   page takes over as it lands (`library-transition.css`).
 * - **Chrome on top.** The top pieces, the capsule and the page pill are named too (class
 *   `library-chrome`) and stacked above the travelling page, so it passes under them.
 * - **Without View Transitions** (Firefox before 144) a clone does it: `flipSheet` lays a copy
 *   of the leaving sheet, its bitmap copied, over the new view and moves it to the arriving
 *   element's box on `smooth`, by transform, fading as it lands; the arriving element shows
 *   under it.
 *
 * Behind `?open=light` (R26 concept 2, DSN-64) opening is `open-light.ts`'s instead: the card's
 * sheet grows on `glide` and the light answers once. On the desk (DSN-87, Masa) it is on by
 * default (`?open=0` turns it off), and a Recents reopen, Continue and the sample lift their
 * cover and hold it over the tile until the document is ready (`liftOpen`, `open-motion.ts`).
 *
 * Reduced motion keeps the transition but strips every name (`styles/motion.css`): a root
 * cross-fade cut at 150 ms; the clone is not used.
 */
import type { DocumentId } from '@pdf-editor/document-model';

import { m } from '../i18n';
import { getLocale } from '../i18n/locale';
import { animate, animateStyle, stopTransform } from '../motion/animate';
import { reducedMotion } from '../motion/reduced-motion';
import { duration, EASE, VT_MS } from '../motion/tokens';
import { lerp, clamp } from '../motion/velocity';
import { viewTransition } from '../motion/view-transition';
import {
  canTakeSeed,
  dropSeed,
  paintSeed,
  type SeedImage,
  seedOf,
  seedPage,
} from '../pages/placeholder';
import { SAMPLE_TITLES } from '../sample/sample-file';
import { announce } from '../shell/announcer';
import { stageView, useUiStore } from '../state/ui-store';
import { useViewStore } from '../state/view-store';
import { useWorkspaceStore } from '../state/workspace-store';
import { ghostOf } from './card-motion';
import { deskEnabled } from './desk-flag';
import { lightPulse, openLightOn } from './open-light';
import {
  canLift,
  LIFT_SCALE,
  lifted,
  type OpenEffect,
  type OpenEvent,
  type OpenState,
  step,
} from './open-motion';
import './library-transition.css';

/** The shared element's name on both sides. */
export const LIBRARY_SHEET = 'library-sheet';
/** Set on `<html>` while the view change runs: `open` or `back`. */
const ATTRIBUTE = 'data-vt-library';
/** Counts view changes, so one that ends does not take the styles of the next. */
let changes = 0;

function inView(element: Element): boolean {
  const box = element.getBoundingClientRect();
  return (
    box.width > 0 &&
    box.bottom > 0 &&
    box.right > 0 &&
    box.top < window.innerHeight &&
    box.left < window.innerWidth
  );
}

/** A card's sheet (its first page), if it is drawn and on screen. */
export function cardSheet(id: DocumentId): HTMLElement | null {
  const sheet = document.querySelector<HTMLElement>(
    `[role="option"][data-document-id="${CSS.escape(id)}"] [data-library-sheet]`,
  );
  return sheet && inView(sheet) ? sheet : null;
}

/**
 * The reader's page the card becomes: the first page when it is on screen, else the current
 * page (a document opens where it was left), if it is laid out and on screen.
 */
export function readerPage(): HTMLElement | null {
  const pages = [
    ...document.querySelectorAll<HTMLElement>('[data-read-viewport] [data-page-index]'),
  ];
  const first = pages.find((page) => page.dataset.pageIndex === '0');
  if (first && inView(first)) return first;
  const current = String(useViewStore.getState().currentPage);
  const page = pages.find((p) => p.dataset.pageIndex === current);
  return page && inView(page) ? page : null;
}

function name(element: HTMLElement | null): void {
  if (element) element.style.viewTransitionName = LIBRARY_SHEET;
}

function unname(elements: readonly (HTMLElement | null)[]): void {
  for (const element of elements) {
    if (element?.style.viewTransitionName === LIBRARY_SHEET) element.style.viewTransitionName = '';
  }
}

/** The chrome that stays above the travelling page: the top pieces, the capsule, the pill. */
const CHROME = '[data-top-piece], [data-capsule], [data-region="pill"]';
/** The class of the chrome's groups, which `library-transition.css` stacks above the page. */
export const LIBRARY_CHROME = 'library-chrome';

/**
 * The chrome's own name in the view `phase`. The top strip's ◆ and tabs pieces (DSN-49) are in
 * both views and morph across (◆'s circle into the "◆ Library" capsule). Every other piece
 * belongs to one view: ▤ and the trailing pieces to the document, the Library's round ⋯ to the
 * Library, and the capsule and pill exist only beside a document. Those get a name per view,
 * so each fades in place, as the root does, rather than one stretching into the other.
 */
function chromeKey(element: HTMLElement, phase: 'old' | 'new'): string {
  const top = element.getAttribute('data-top-piece');
  if (top === 'home' || top === 'tabs') return `top-${top}`;
  const piece =
    top !== null ? `top-${top}` : element.hasAttribute('data-capsule') ? 'capsule' : 'pill';
  return `${piece}-${phase}`;
}

/**
 * Names the chrome on screen (`library-chrome-<key>`, class `library-chrome`), so it is
 * captured as groups of its own that `library-transition.css` draws above the travelling page:
 * the page passes under the top strip and the capsule, as the reader's page does at rest
 * (language.md §7.3 *view change*: chrome stays on top). Returns what it named.
 */
function nameChrome(phase: 'old' | 'new'): HTMLElement[] {
  const seen = new Set<string>();
  const named: HTMLElement[] = [];
  for (const element of document.querySelectorAll<HTMLElement>(CHROME)) {
    const key = chromeKey(element, phase);
    if (seen.has(key) || !inView(element)) continue;
    seen.add(key);
    element.style.viewTransitionName = `${LIBRARY_CHROME}-${key}`;
    // A piece of one view only fades as a whole group (`-out` or `-in`), its glass with it.
    const side = key.endsWith(`-${phase}`)
      ? ` ${LIBRARY_CHROME}-${phase === 'old' ? 'out' : 'in'}`
      : '';
    element.style.setProperty('view-transition-class', `${LIBRARY_CHROME}${side}`);
    named.push(element);
  }
  return named;
}

function unnameChrome(elements: readonly HTMLElement[]): void {
  for (const element of elements) {
    if (!element.style.viewTransitionName.startsWith(LIBRARY_CHROME)) continue;
    element.style.viewTransitionName = '';
    element.style.removeProperty('view-transition-class');
  }
}

/**
 * The longest the update waits for the arriving page to show a bitmap (ms). If one shows in
 * time, the travelling image hands over to it at 60 % of the flight. If not, the old image
 * travels alone and the live page takes over as it lands (`library-transition.css`). On the
 * corpus (motion-2026-10 library-capsule.md §1) the reader's full-resolution render lands
 * 140–620 ms after the click, too late to wait for. A preview from the thumbnail cache
 * usually shows within the wait, so the hand-off is to that, and the render sharpens it in
 * place after the morph, as it would without one. The wait is capped at the 100 ms the morph
 * may cost.
 */
export const DRAW_BUDGET_MS = 100;
/** Set on `<html>` when the arriving page drew in time: the two images cross-fade. */
const CRISP = 'data-vt-library-crisp';

/** Resolves true once `element`'s page bitmap shows (a preview or the render), false at `ms`. */
async function drawnWithin(element: HTMLElement, ms: number): Promise<boolean> {
  const end = performance.now() + ms;
  for (;;) {
    const state = element.querySelector('canvas')?.dataset.state;
    if (state === 'preview' || state === 'rendered') return true;
    if (performance.now() >= end) return false;
    await new Promise((resolve) => setTimeout(resolve, 8));
  }
}

/**
 * The fallback where View Transitions are missing: a clone of `from` (captured before the
 * update) flies from its box to `to`'s on `smooth`, over the new view, and fades as it lands.
 */
export function flipSheet(clone: HTMLElement, from: DOMRect, to: HTMLElement): void {
  const end = to.getBoundingClientRect();
  if (end.width === 0 || from.width === 0) return;
  clone.style.cssText =
    `position:fixed;left:${end.left}px;top:${end.top}px;width:${end.width}px;` +
    `height:${end.height}px;margin:0;z-index:10;pointer-events:none;transform-origin:0 0;`;
  // The clone is drawn at the arriving box, its bitmap stretched to it; it starts at the
  // leaving box by transform and settles to none.
  for (const canvas of clone.querySelectorAll('canvas')) {
    canvas.style.width = '100%';
    canvas.style.height = '100%';
  }
  document.body.append(clone);
  const sx = from.width / end.width;
  const sy = from.height / end.height;
  const move = animateStyle(
    clone,
    'transform',
    [from.left - end.left, from.top - end.top, sx, sy],
    [0, 0, 1, 1],
    {
      spring: 'smooth',
    },
  );
  const fade = clone.animate([{ opacity: 1 }, { opacity: 1, offset: 0.6 }, { opacity: 0 }], {
    duration: VT_MS * 1.5,
    fill: 'forwards',
  });
  void move.finished.then(() => fade.finished).finally(() => clone.remove());
}

/** Lays `el` fixed over the window at `box`, scaling from its top-left corner. */
function placeAt(el: HTMLElement, box: DOMRect): void {
  Object.assign(el.style, {
    position: 'fixed',
    left: `${box.left}px`,
    top: `${box.top}px`,
    width: `${box.width}px`,
    height: `${box.height}px`,
    margin: '0',
    zIndex: '10',
    pointerEvents: 'none',
    transformOrigin: '0 0',
  });
  for (const canvas of el.querySelectorAll('canvas')) {
    canvas.style.width = '100%';
    canvas.style.height = '100%';
  }
}

/** The view the open leaves: a Library (full edition) or the phone's. */
const LIBRARY_VIEW = '[data-testid="home"], [data-testid="compact-library"]';

/**
 * The flight (DSN-64): `clone`, laid over the window at `from`, grows into `to`, the reader's
 * page, on `glide` (a spring from the motion core, so it takes the time its physics take). The
 * reader waits out of sight until the clone is most of the way there, then the two
 * cross-dissolve as the sizes meet; the page shows the same image (the thumbnail from the cache,
 * or the desk's seed) and the sharp render cross-fades over that (`PageCanvas`). `veil`, a still
 * copy of the leaving view, fades under the clone. `done` runs once at rest. Returns the
 * function that ends the flight now (the view changed again, a safety).
 */
function fly(
  from: DOMRect,
  clone: HTMLElement,
  veil: HTMLElement | null,
  to: HTMLElement,
  done: () => void,
): () => void {
  const end = to.getBoundingClientRect();
  placeAt(clone, end);
  clone.style.opacity = '';
  const [dx, dy] = [from.left - end.left, from.top - end.top];
  const [sx, sy] = [from.width / end.width, from.height / end.height];
  // The whole reader waits, so no neighbouring page shows beside the flying sheet.
  const hidden = to.closest<HTMLElement>('[data-read-viewport]') ?? to;
  const at = (p: number) => {
    clone.style.transform =
      `translate(${dx * (1 - p)}px,${dy * (1 - p)}px) ` +
      `scale(${lerp(sx, 1, p)},${lerp(sy, 1, p)})`;
    // The page stays out of sight until the sizes are within a few per cent, then the two
    // dissolve; the Library's copy is gone by the middle of the flight.
    const dissolve = clamp((p - 0.85) / 0.12, 0, 1);
    clone.style.opacity = String(1 - dissolve);
    hidden.style.opacity = String(dissolve);
    if (veil) veil.style.opacity = String(1 - clamp(p / 0.5, 0, 1));
  };
  at(0);
  let finished = false;
  const flight = animate(0, 1, { spring: 'glide', onUpdate: at });
  const finish = () => {
    if (finished) return;
    finished = true;
    flight.stop();
    clone.remove();
    veil?.remove();
    hidden.style.opacity = '';
    done();
  };
  void flight.finished.then(finish);
  // A safety: a spring that never reports rest must not leave the page hidden.
  setTimeout(finish, SAFETY_MS);
  return finish;
}

/**
 * `?open=light` (R26 concept 2, DSN-64): `clone`, a copy of the leaving sheet laid over the
 * window before the view changes, grows into the reader's page (`fly`). When the page is down,
 * the light answers once, in the session's first open (`open-light.ts`).
 */
function growInto(
  from: DOMRect,
  clone: HTMLElement,
  apply: () => void,
  arriving: () => HTMLElement | null,
  leavingView: Element | null,
): void {
  placeAt(clone, from);
  clone.dataset.openGrow = '';
  document.body.append(clone);
  // The Library goes as a copy that fades under the flying sheet, not as a cut.
  const view = leavingView instanceof HTMLElement ? leavingView : null;
  const veil = view ? ghostOf(view) : null;
  if (view && veil) {
    placeAt(veil, view.getBoundingClientRect());
    veil.style.zIndex = '9';
    document.body.append(veil);
  }
  apply();
  let tries = 0;
  const land = () => {
    const to = arriving();
    if (!to) {
      if (++tries < 30) requestAnimationFrame(land);
      else {
        clone.remove();
        veil?.remove();
      }
      return;
    }
    fly(from, clone, veil, to, () => void lightPulse(to));
  };
  requestAnimationFrame(land);
}

/** The longest the grow may hold the page out of sight (ms), whatever the spring reports. */
const SAFETY_MS = 3000;

/** The reader's page once it is laid out (at most about half a second of frames), else null. */
function pageWhenLaidOut(): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    let tries = 0;
    const look = () => {
      const page = readerPage();
      if (page || ++tries >= 30) resolve(page);
      else requestAnimationFrame(look);
    };
    look();
  });
}

/** A sheet of paper, for an open that has no thumbnail to grow (a phone's row). */
function paperSheet(): HTMLElement {
  const sheet = document.createElement('div');
  sheet.setAttribute('aria-hidden', 'true');
  sheet.style.background = 'var(--page-background)';
  sheet.style.boxShadow = 'var(--page-shadow)';
  return sheet;
}

/**
 * The phone's open (`?open=light`, DSN-64): a Library row has no thumbnail, so a sheet of paper
 * grows out of its glyph into the page (`row` given), then the light answers once. Without a
 * row (a file just picked, the sample) the page only arrives and the light answers.
 */
export function openRowMorph(row: HTMLElement | null, open: () => void): void {
  const glyph = row?.firstElementChild;
  if (glyph instanceof HTMLElement && !reducedMotion()) {
    growInto(
      glyph.getBoundingClientRect(),
      paperSheet(),
      open,
      readerPage,
      row?.closest(LIBRARY_VIEW) ?? null,
    );
    return;
  }
  open();
  void pageWhenLaidOut().then((page) => page && lightPulse(page));
}

// ---------------------------------------------------------------------------
// The desk's opening (DSN-87, `masa.md` §2.7)
// ---------------------------------------------------------------------------

/** What the arriving page is seeded with: the cover's pixels and the page they show (0-based). */
export interface OpenSeed {
  readonly page: number;
  readonly image: SeedImage;
}

/** The opening that runs now, if any: one at a time (`canLift`). */
let opening: OpenState | null = null;

/** Whether the Library (full edition) is what the stage shows: no document, or its Home view. */
function homeShows(): boolean {
  const ws = useWorkspaceStore.getState().workspace;
  return (
    ws.documentOrder.length === 0 || stageView(useUiStore.getState(), ws.activeDocument) === 'home'
  );
}

/**
 * A copy of the pressed `sheet` to lift. Its pictures are copied into canvases, so the copy keeps
 * showing after the desk unmounts and revokes its object URLs (a cloned `<img>` would reload).
 */
function liftedCopy(sheet: HTMLElement): HTMLElement {
  const copy = ghostOf(sheet);
  const sources = sheet.querySelectorAll('img');
  copy.querySelectorAll('img').forEach((img, i) => {
    const source = sources[i];
    if (!source || !source.complete || source.naturalWidth === 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = source.naturalWidth;
    canvas.height = source.naturalHeight;
    canvas.getContext('2d')?.drawImage(source, 0, 0);
    canvas.className = img.className;
    img.replaceWith(canvas);
  });
  return copy;
}

/** A still copy of `view` laid over it, scrolled where it is; the desk fades as a copy. */
function stillCopy(view: HTMLElement): HTMLElement {
  const copy = ghostOf(view);
  placeAt(copy, view.getBoundingClientRect());
  copy.style.zIndex = '9';
  document.body.append(copy);
  // A clone starts scrolled to the top: put each scroller back where the desk had it.
  const live = view.querySelectorAll<HTMLElement>('*');
  const clones = copy.querySelectorAll<HTMLElement>('*');
  live.forEach((el, i) => {
    const twin = clones[i];
    if (twin && (el.scrollTop > 0 || el.scrollLeft > 0)) {
      twin.scrollTop = el.scrollTop;
      twin.scrollLeft = el.scrollLeft;
    }
  });
  return copy;
}

/** The reader's page the cover becomes: the one it shows when that is on screen, else the usual. */
function landingPage(seed: OpenSeed | null): HTMLElement | null {
  if (seed) {
    const own = document.querySelector<HTMLElement>(
      `[data-read-viewport] [data-page-index="${seed.page}"]`,
    );
    if (own && inView(own)) return own;
  }
  return readerPage();
}

/**
 * The reader's page once it can be flown to: laid out, in view, and not held out of sight by an
 * exact resume (`session/resume-view.ts` holds the viewport at opacity 0 until the offset has
 * held for four frames).
 */
function settledPage(seed: OpenSeed | null): HTMLElement | null {
  const viewport = document.querySelector<HTMLElement>('[data-read-viewport]');
  if (!viewport || viewport.style.opacity === '0') return null;
  return landingPage(seed);
}

/** Whether the stage shows a page view (not the Pages grid, Compare or the Library). */
function showsPage(): boolean {
  const ws = useWorkspaceStore.getState().workspace;
  return stageView(useUiStore.getState(), ws.activeDocument) === 'page';
}

/**
 * The sample's cover drawn once as pixels (it is an SVG, `SampleCover`), so the arriving page of
 * the sample first shows the same picture the hero shows (page 0, twice the hero's size).
 */
async function svgSeed(sheet: HTMLElement): Promise<OpenSeed | null> {
  const svg = sheet.querySelector('svg');
  if (!svg) return null;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const width = 420;
  const height = Math.round((width * 297) / 210);
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  const url = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }),
  );
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')?.drawImage(image, 0, 0, width, height);
    return { page: 0, image: canvas };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** The sample hero or tile was pressed (its own button opens the sample): lift its cover. */
export function liftSample(sheet: HTMLElement): void {
  const locale = getLocale() === 'tr' ? 'tr' : 'en';
  liftOpen(sheet, undefined, SAMPLE_TITLES[locale], svgSeed(sheet));
}

/** Frames the page must stay put for before the clone flies to it. */
const SETTLED_FRAMES = 3;
/** Press → the longest the work may be missing before a press without an action settles (ms). */
const NO_ACTION_SETTLE_MS = 2000;

/**
 * The desk's opening (DSN-87, `masa.md` §2.7; DSN-64): `sheet`, the pressed tile's cover, is
 * lifted over it as a copy (`LIFT_SCALE` on `quick`) and held there while the document is not
 * ready; the desk stays live underneath, the tile busy after `BUSY_MS` (a ring, and "Opening
 * report-v2.pdf" announced). When the desk unmounts (the open succeeded) a still copy of it takes
 * its place, and once the reader's page is laid out and any resume has settled, the copy of the
 * cover grows into it on `glide` (`fly`) and dissolves into the page at the end, which already
 * shows the same image (the `seed`, `placeholder.ts`). If the open ends with the desk still
 * showing (cancelled, refused, several files) or fails, the copy settles back into its tile on
 * `smooth`. `work` is the open action; without it (the sample's own button) the press settles
 * when nothing is opening after `NO_ACTION_SETTLE_MS`. Reduced motion: no copy and no lift; the
 * still copy of the desk cross-fades away (150 ms), and the seed still applies.
 */
export function liftOpen(
  sheet: HTMLElement,
  work: Promise<unknown> | undefined,
  name: string,
  seed?: Promise<OpenSeed | null>,
): void {
  if (!canLift(opening) || !openLightOn()) return;
  const view = sheet.closest<HTMLElement>(LIBRARY_VIEW);
  if (!view) return;
  const reduced = reducedMotion();
  const tile = sheet.closest<HTMLElement>('button, [role="button"]');
  const from = sheet.getBoundingClientRect();
  const copy = !reduced && from.width > 0 ? liftedCopy(sheet) : null;
  const started = performance.now();
  let state: OpenState = lifted;
  opening = state;
  let veil: HTMLElement | null = null;
  let land: OpenSeed | null = null;
  let seeded = false;
  let flying: (() => void) | undefined;
  let frame = 0;
  let stable = 0;
  let lastBox = '';
  const offs: (() => void)[] = [];

  void seed?.then((value) => {
    land = value;
  });

  if (copy) {
    placeAt(copy, from);
    copy.dataset.openGrow = '';
    copy.style.transformOrigin = '50% 50%';
    document.body.append(copy);
    // The tile's own cover goes under the copy; it comes back if the copy settles.
    sheet.style.opacity = '0';
    animateStyle(copy, 'transform', [0, 0, 1], [0, 0, LIFT_SCALE], { spring: 'quick', keep: true });
  }
  tile?.setAttribute('aria-busy', 'true');

  /** Paints the seed onto the arriving page's canvas once its component has set it up. */
  const plant = () => {
    if (seeded || !land) return;
    const ws = useWorkspaceStore.getState().workspace;
    const doc = ws.activeDocument === undefined ? undefined : ws.documents[ws.activeDocument];
    const ref = doc?.pages[land.page]?.ref;
    if (ref?.kind !== 'source') return;
    seedPage(ref.source, ref.index, land.image);
    const canvas = document
      .querySelector<HTMLElement>(`[data-read-viewport] [data-page-index="${land.page}"]`)
      ?.querySelector<HTMLCanvasElement>('canvas[data-layer="page"]');
    if (canvas?.dataset.revision === undefined) return;
    const image = seedOf(ref.source, ref.index);
    if (image && canTakeSeed(canvas)) paintSeed(canvas, image);
    seeded = true;
  };

  const send = (event: OpenEvent) => {
    const result = step(state, event);
    state = result.state;
    opening = state;
    for (const effect of result.effects) run(effect);
  };

  const settleBack = () => {
    if (!copy) {
      send({ type: 'landed' });
      return;
    }
    // From wherever the lift is (it may still be springing), back to the tile's own size.
    const from = stopTransform(copy)?.value ?? [0, 0, LIFT_SCALE];
    void animateStyle(copy, 'transform', from, [0, 0, 1], { spring: 'smooth' }).finished.then(() =>
      send({ type: 'landed' }),
    );
  };

  const run = (effect: OpenEffect) => {
    switch (effect) {
      case 'ring': {
        if (!copy) break;
        const ring = document.createElement('span');
        ring.dataset.openBusy = '';
        ring.setAttribute('aria-hidden', 'true');
        copy.append(ring);
        ring.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: duration('base'),
          easing: EASE.out,
          fill: 'forwards',
        });
        break;
      }
      case 'announce':
        announce(m.desk_opening({ name }));
        break;
      case 'veil':
        // Synchronously, before React takes the desk away.
        if (view.isConnected) veil = stillCopy(view);
        break;
      case 'unveil':
        veil?.remove();
        veil = null;
        break;
      case 'settle':
        settleBack();
        break;
      case 'fly': {
        const to = settledPage(land);
        if (!to) {
          send({ type: 'landed' });
          break;
        }
        plant();
        copy?.querySelector('[data-open-busy]')?.remove();
        if (!copy) {
          // Reduced motion: the copy of the desk cross-fades away over the arrived page.
          const fade = veil?.animate([{ opacity: 1 }, { opacity: 0 }], {
            duration: duration('slow'),
            easing: EASE.standard,
            fill: 'forwards',
          });
          void (fade?.finished ?? Promise.resolve()).then(() => send({ type: 'landed' }));
          break;
        }
        // From the lifted cover as it is drawn now (the lift may still be springing).
        const box = copy.getBoundingClientRect();
        stopTransform(copy);
        copy.style.transform = '';
        copy.style.transformOrigin = '0 0';
        flying = fly(box, copy, veil, to, () => {
          void lightPulse(to);
          send({ type: 'landed' });
        });
        break;
      }
      case 'dissolve': {
        const out = [copy, veil].filter((el): el is HTMLElement => el !== null);
        const fades = out.map(
          (el) =>
            el.animate([{ opacity: 1 }, { opacity: 0 }], {
              duration: duration('base'),
              easing: EASE.exit,
              fill: 'forwards',
            }).finished,
        );
        void Promise.all(fades).then(() => send({ type: 'landed' }));
        break;
      }
      case 'finish': {
        flying?.();
        copy?.remove();
        veil?.remove();
        sheet.style.opacity = '';
        tile?.removeAttribute('aria-busy');
        for (const off of offs) off();
        cancelAnimationFrame(frame);
        // A real render has landed or the open is over: the seeds are not needed.
        const ws = useWorkspaceStore.getState().workspace;
        const doc = ws.activeDocument === undefined ? undefined : ws.documents[ws.activeDocument];
        const ref = land === null ? undefined : doc?.pages[land.page]?.ref;
        if (ref?.kind === 'source') dropSeed(ref.source, ref.index);
        break;
      }
    }
  };

  // Home unmounting is the open's success; Home coming back during the flight ends it.
  const watch = () => {
    const shows = homeShows();
    if (!shows && state.phase === 'lifted') send({ type: 'left' });
    else if (shows && (state.phase === 'left' || state.phase === 'flying'))
      send({ type: 'returned' });
  };
  offs.push(useUiStore.subscribe(watch), useWorkspaceStore.subscribe(watch));

  void work?.then(
    () => send({ type: 'worked' }),
    () => send({ type: 'worked' }),
  );

  // One frame loop for the whole opening: time events, the seed, and the landing page's settling.
  const tick = () => {
    if (state.phase === 'done' || state.phase === 'flying' || state.phase === 'settling') return;
    const ms = performance.now() - started;
    send({ type: 'time', ms });
    if (state.phase === 'lifted' && work === undefined && ms >= NO_ACTION_SETTLE_MS) {
      if (useWorkspaceStore.getState().opening === 0) send({ type: 'worked' });
    }
    if (state.phase === 'left') {
      // Without an action to wait on, the open is done once Home is gone.
      if (work === undefined && !state.worked) send({ type: 'worked' });
      plant();
      const page = settledPage(land);
      const box = page ? JSON.stringify(page.getBoundingClientRect()) : '';
      stable = page && box === lastBox ? stable + 1 : 0;
      lastBox = box;
      if (stable >= SETTLED_FRAMES) send({ type: 'ready' });
      else if (!showsPage()) send({ type: 'nowhere' });
    }
    if (state.phase === 'lifted' || state.phase === 'left') frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
}

/**
 * Runs `apply` as the Library's view change, with `leaving` named in the old view and what
 * `arriving` returns named in the new one.
 */
function change(
  direction: 'open' | 'back',
  leaving: HTMLElement | null,
  apply: () => void,
  arriving: () => HTMLElement | null,
): void {
  const root = document.documentElement;
  const generation = ++changes;
  const reduced = reducedMotion();
  // `?open=light` (DSN-64): the card's thumbnail grows on a spring and the light answers.
  if (direction === 'open' && leaving && !reduced && openLightOn()) {
    growInto(
      leaving.getBoundingClientRect(),
      ghostOf(leaving),
      apply,
      arriving,
      leaving.closest(LIBRARY_VIEW),
    );
    return;
  }
  if (typeof document.startViewTransition !== 'function') {
    // The clone's way: copy the leaving sheet before the update takes it away.
    const from = leaving?.getBoundingClientRect();
    const clone = leaving && !reduced ? ghostOf(leaving) : null;
    apply();
    requestAnimationFrame(() => {
      const to = arriving();
      if (clone && from && to) flipSheet(clone, from, to);
    });
    return;
  }
  name(leaving);
  const chrome = leaving ? nameChrome('old') : [];
  root.setAttribute(ATTRIBUTE, direction);
  root.removeAttribute(CRISP);
  let arrived: HTMLElement | null = null;
  void viewTransition(
    async () => {
      // The old view's chrome is captured by now; the new view names its own.
      unnameChrome(chrome);
      apply();
      // The updates its effects scheduled synchronously settle before the new view is read.
      await Promise.resolve();
      arrived = arriving();
      // Half a pair would fly in from the root's corner: both sides, or neither.
      if (leaving && arrived) {
        name(arrived);
        chrome.push(...nameChrome('new'));
        // Reduced motion keeps no names (motion.css §4): nothing to wait for.
        if (!reduced && (await drawnWithin(arrived, DRAW_BUDGET_MS))) root.setAttribute(CRISP, '');
      } else unname([leaving]);
    },
    {
      name: `library-${direction}`,
      finished: () => {
        unname([leaving, arrived]);
        unnameChrome(chrome);
        if (generation !== changes) return;
        root.removeAttribute(ATTRIBUTE);
        root.removeAttribute(CRISP);
      },
    },
  ).catch(() => undefined);
}

/** Opens a card: its first page grows into the reader's page (module header). */
export function openCardMorph(id: DocumentId, open: (id: DocumentId) => void): void {
  change('open', cardSheet(id), () => open(id), readerPage);
}

/**
 * The sheet the page shrinks into on the way back to the desk (DSN-87, `masa.md` §2.7 step 7):
 * the Continue card's page when it shows (the document just left is the one read last), else
 * the document's open card.
 */
export function backTarget(id: DocumentId | undefined): HTMLElement | null {
  if (deskEnabled()) {
    const card = document.querySelector<HTMLElement>(
      '[data-testid="continue-card"] [data-library-sheet]',
    );
    if (card && inView(card)) return card;
  }
  return id === undefined ? null : cardSheet(id);
}

/** Back to the Library: the page shrinks into the active document's card (module header). */
export function backToLibraryMorph(show: () => void): void {
  const id = useWorkspaceStore.getState().workspace.activeDocument;
  change('back', readerPage(), show, () => backTarget(id));
}
