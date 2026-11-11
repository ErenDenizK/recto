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
 * reader waits out of sight; the cover keeps its size to within 2 px of the page until the spring
 * is at rest (`LANDED`), and only then do the two cross-fade over `CROSS_FADE` (the clone is
 * re-laid on the page's own rect first, so the fade changes the picture and never the place).
 * The page shows the same image (the thumbnail from the cache, or the desk's seed) and the sharp
 * render cross-fades over that (`PageCanvas`). `veil`, a still copy of the leaving view, fades
 * under the clone, and the reader's `chrome` (kept out of sight until now) fades in with the
 * flight, on the same spring. `done` runs once everything is at rest. Returns the function that
 * ends the flight now (the view changed again, a safety).
 */
function fly(
  from: DOMRect,
  clone: HTMLElement,
  veil: HTMLElement | null,
  first: HTMLElement,
  find: () => HTMLElement | null,
  done: () => void,
  chrome: readonly HTMLElement[] = [],
): () => void {
  // The page it flies to is followed live: the reader may lay the page out again (a resume's
  // nudge, a zoom) or remount while the cover is in the air, and the cover must still land on
  // the page that is there, not on where it was.
  let to = first;
  let hidden = to.closest<HTMLElement>('[data-read-viewport]') ?? to;
  let end = to.getBoundingClientRect();
  const follow = () => {
    const now = find();
    if (now?.isConnected && now !== to) {
      hidden.style.opacity = '';
      to = now;
      hidden = to.closest<HTMLElement>('[data-read-viewport]') ?? to;
    }
    end = to.getBoundingClientRect();
  };
  const fades: Animation[] = [];
  let crossing = false;
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    flight.stop();
    for (const fade of fades) fade.cancel();
    clone.remove();
    veil?.remove();
    hidden.style.opacity = '';
    for (const el of chrome) el.style.opacity = '';
    done();
  };
  /** The cross-fade from the cover to the page, the cover laid exactly on the page first. */
  const cross = () => {
    if (crossing || finished) return;
    follow();
    crossing = true;
    placeAt(clone, end);
    clone.style.transform = '';
    for (const el of chrome) el.style.opacity = '1';
    const options = {
      duration: duration('fast'),
      easing: EASE.standard,
      fill: 'forwards',
    } as const;
    fades.push(
      clone.animate([{ opacity: 1 }, { opacity: 0 }], options),
      hidden.animate([{ opacity: 0 }, { opacity: 1 }], options),
    );
    // The fade now holds the reader at its own opacity, so the opening's hold can go.
    document.documentElement.removeAttribute(HOLD);
    void Promise.all(fades.map((fade) => fade.finished)).then(finish, finish);
  };
  const at = (p: number) => {
    if (crossing) return;
    follow();
    placeAt(clone, end);
    clone.style.transform =
      `translate(${(from.left - end.left) * (1 - p)}px,${(from.top - end.top) * (1 - p)}px) ` +
      `scale(${lerp(from.width / end.width, 1, p)},${lerp(from.height / end.height, 1, p)})`;
    clone.style.opacity = '1';
    hidden.style.opacity = '0';
    // The Library's copy is gone by the middle of the flight; the reader's chrome follows it in.
    if (veil) veil.style.opacity = String(1 - clamp(p / 0.5, 0, 1));
    for (const el of chrome) el.style.opacity = String(clamp(p, 0, 1));
    if (p >= LANDED) cross();
  };
  at(0);
  const flight = animate(0, 1, { spring: 'glide', onUpdate: at });
  void flight.finished.then(cross);
  // A safety: a spring that never reports rest must not leave the page hidden.
  setTimeout(finish, SAFETY_MS);
  return finish;
}

/**
 * How far along the flight the cover must be before it cross-fades into the page: the size and
 * place left are then under 2 px of the page's at 1440 (the page is about 1300 px wide, so
 * 0.0015 of the travel is 2 px).
 */
const LANDED = 0.9985;

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
    fly(from, clone, veil, to, arriving, () => void lightPulse(to));
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

/**
 * The reader's chrome that the desk does not have (the strip's document pieces, the capsule, the
 * page pill): kept out of sight while the cover is held over the desk, then faded in with the
 * flight (`library-transition.css`). The ◆ piece is on both sides and stays.
 */
const HELD_CHROME =
  '[data-top-piece]:not([data-top-piece="home"]), [data-capsule], [data-region="pill"]';

/** Set on `<html>` while the arriving reader waits behind the desk's copy (see the stylesheet). */
const HOLD = 'data-open-hold';

/** Frees a seed's decoded cover (a bitmap holds memory until it is closed). */
function closeSeed(seed: OpenSeed | null): void {
  if (seed && 'close' in seed.image) seed.image.close();
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
 * Gives the SVG parts of `copy` back the ids `ghostOf` strips from every element: a drawing's
 * gradients and clips are found by id (`url(#…)`), and without them it paints without its fills
 * (the sample's cover loses its sky). HTML keeps no duplicate ids.
 */
function restoreSvgIds(from: Element, copy: Element): void {
  const live = from.querySelectorAll('*');
  const twins = copy.querySelectorAll('*');
  live.forEach((el, i) => {
    const twin = twins[i];
    if (el instanceof SVGElement && el.id !== '' && twin?.id === '') twin.id = el.id;
  });
}

/**
 * A copy of the pressed `sheet` to lift. Its pictures are copied into canvases, so the copy keeps
 * showing after the desk unmounts and revokes its object URLs (a cloned `<img>` would reload).
 */
function liftedCopy(sheet: HTMLElement): HTMLElement {
  const copy = ghostOf(sheet);
  restoreSvgIds(sheet, copy);
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
  restoreSvgIds(view, copy);
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
  const view = sheet.closest<HTMLElement>(LIBRARY_VIEW);
  if (!canLift(opening) || !openLightOn() || !view) {
    // Nothing will use the cover read for the seed: free it.
    void seed?.then(closeSeed);
    return;
  }
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
  let ring: HTMLElement | undefined;
  let frame = 0;
  let stable = 0;
  let lastBox = '';
  const offs: (() => void)[] = [];

  let ended = false;
  /** The page the seed is registered for (source and page index), to drop that very key. */
  let planted: { readonly source: string; readonly index: number } | undefined;
  void seed?.then((value) => {
    // An opening that ended before the cover was decoded has no use for it.
    if (ended) closeSeed(value);
    else land = value;
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
    planted = { source: ref.source, index: ref.index };
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
    // Says where the opening is (the end-to-end specs read it).
    if (copy) copy.dataset.openPhase = state.phase;
    for (const effect of result.effects) run(effect);
  };

  const settleBack = () => {
    veil?.remove();
    veil = null;
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
        // Over the lifted cover, or, with no copy (reduced motion), on the tile's own sheet as a
        // still glyph: a cue that is not only `aria-busy`.
        ring = document.createElement('span');
        ring.dataset.openBusy = '';
        ring.setAttribute('aria-hidden', 'true');
        (copy ?? sheet).append(ring);
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
        // Synchronously, before React takes the desk away (unless it was taken a step earlier).
        // The copy of the desk is see-through between its tiles, so the arriving reader waits
        // out of sight (`library-transition.css`) until the cover flies to it, or fades in under
        // the copy's fade (reduced motion).
        if (veil === null && view.isConnected) veil = stillCopy(view);
        document.documentElement.setAttribute(HOLD, '');
        break;
      case 'unveil':
        document.documentElement.removeAttribute(HOLD);
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
          // Reduced motion: the copy of the desk cross-fades away over the arrived page, and the
          // chrome fades in with it.
          for (const el of document.querySelectorAll<HTMLElement>(HELD_CHROME)) {
            el.animate([{ opacity: 0 }, { opacity: 1 }], {
              duration: duration('slow'),
              easing: EASE.standard,
            });
          }
          document.documentElement.removeAttribute(HOLD);
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
        flying = fly(
          box,
          copy,
          veil,
          to,
          () => landingPage(land),
          () => {
            void lightPulse(to);
            send({ type: 'landed' });
          },
          [...document.querySelectorAll<HTMLElement>(HELD_CHROME)],
        );
        // The hold stays until the cross-fade (`fly`): it is what keeps the reader out of sight
        // if anything else clears its inline opacity (an exact resume's release) mid-flight.
        break;
      }
      case 'dissolve': {
        for (const el of document.querySelectorAll<HTMLElement>(HELD_CHROME)) {
          el.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration: duration('base'),
            easing: EASE.out,
          });
        }
        document.documentElement.removeAttribute(HOLD);
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
        document.documentElement.removeAttribute(HOLD);
        flying?.();
        copy?.remove();
        veil?.remove();
        sheet.style.opacity = '';
        tile?.removeAttribute('aria-busy');
        for (const off of offs) off();
        cancelAnimationFrame(frame);
        // The open is over: the seed is dropped by the key it was stored under, and the decoded
        // cover freed, whether the open succeeded, was refused or hit the cap.
        ended = true;
        if (planted) dropSeed(planted.source, planted.index);
        closeSeed(land);
        ring?.remove();
        break;
      }
    }
  };

  // Home unmounting is the open's success; Home coming back during the flight ends it.
  const watch = () => {
    const shows = homeShows();
    if (!shows && state.phase === 'lifted') send({ type: 'left' });
    else if (shows && (state.phase === 'flying' || (state.phase === 'left' && state.worked)))
      send({ type: 'returned' });
  };
  // The open's first change to the workspace (a file loaded, a document added) re-renders the
  // desk a moment before the view changes (the sample's hero goes, an open card arrives). The
  // still copy is taken now, so it shows the desk as it was pressed, never that in-between.
  const freeze = () => {
    if (veil === null && state.phase === 'lifted' && view.isConnected) veil = stillCopy(view);
  };
  offs.push(
    useUiStore.subscribe(watch),
    useWorkspaceStore.subscribe(() => {
      freeze();
      watch();
    }),
  );

  // An open passes through states where the desk shows again (the document is there before its
  // view is chosen), so Home coming back counts only once the action has ended.
  const settled = () => {
    send({ type: 'worked' });
    if (state.phase === 'left' && homeShows()) send({ type: 'returned' });
  };
  void work?.then(settled, settled);

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
      else if (state.worked && !showsPage() && !homeShows()) send({ type: 'nowhere' });
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
  const card = document.querySelector<HTMLElement>(
    '[data-testid="continue-card"] [data-library-sheet]',
  );
  if (card && inView(card)) return card;
  return id === undefined ? null : cardSheet(id);
}

/** Back to the Library: the page shrinks into the active document's card (module header). */
export function backToLibraryMorph(show: () => void): void {
  const id = useWorkspaceStore.getState().workspace.activeDocument;
  change('back', readerPage(), show, () => backTarget(id));
}
