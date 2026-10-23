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
 * sheet grows on `glide` and the light answers once.
 *
 * Reduced motion keeps the transition but strips every name (`styles/motion.css`): a root
 * cross-fade cut at 150 ms; the clone is not used.
 */
import type { DocumentId } from '@pdf-editor/document-model';

import { animate, animateStyle } from '../motion/animate';
import { reducedMotion } from '../motion/reduced-motion';
import { VT_MS } from '../motion/tokens';
import { lerp, clamp } from '../motion/velocity';
import { viewTransition } from '../motion/view-transition';
import { useViewStore } from '../state/view-store';
import { useWorkspaceStore } from '../state/workspace-store';
import { ghostOf } from './card-motion';
import { homeFlagEnabled, OPEN_LIGHT_FLAG } from './home-flags';
import { lightPulse } from './open-light';
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
 * `?open=light` (R26 concept 2, DSN-64): `clone`, a copy of the leaving sheet laid over the
 * window before the view changes, grows into the reader's page on `glide` (a spring from the
 * motion core, so it takes the time its physics take). The reader's page stays out of sight
 * until the clone is most of the way there, then the two cross-dissolve as the sizes meet; the
 * page shows the same thumbnail from the cache, and the sharp render cross-fades over that
 * (`PageCanvas`). When the page is down, the light answers once, in the session's first open
 * (`open-light.ts`).
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
    const end = to.getBoundingClientRect();
    placeAt(clone, end);
    const [dx, dy] = [from.left - end.left, from.top - end.top];
    const [sx, sy] = [from.width / end.width, from.height / end.height];
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clone.remove();
      veil?.remove();
      to.style.opacity = '';
      void lightPulse(to);
    };
    const at = (p: number) => {
      clone.style.transform =
        `translate(${dx * (1 - p)}px,${dy * (1 - p)}px) ` +
        `scale(${lerp(sx, 1, p)},${lerp(sy, 1, p)})`;
      // The page stays out of sight until the sizes are within a few per cent, then the two
      // dissolve; the Library's copy is gone by the middle of the flight.
      const dissolve = clamp((p - 0.85) / 0.12, 0, 1);
      clone.style.opacity = String(1 - dissolve);
      to.style.opacity = String(dissolve);
      if (veil) veil.style.opacity = String(1 - clamp(p / 0.5, 0, 1));
    };
    at(0);
    void animate(0, 1, { spring: 'glide', onUpdate: at }).finished.then(finish);
    // A safety: a spring that never reports rest must not leave the page hidden.
    setTimeout(finish, SAFETY_MS);
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
  if (direction === 'open' && leaving && !reduced && homeFlagEnabled(OPEN_LIGHT_FLAG)) {
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

/** Back to the Library: the page shrinks into the active document's card (module header). */
export function backToLibraryMorph(show: () => void): void {
  const id = useWorkspaceStore.getState().workspace.activeDocument;
  change('back', readerPage(), show, () => (id === undefined ? null : cardSheet(id)));
}
