/**
 * The find map's pointer (R26 concept 3; DSN-65, behind `?findmap=1`): hover or touch a hit tick
 * on the scroll bar and a card shows the page, its thumbnail and the hit's sentence; click or
 * tap and the reader jumps there and that page's hit becomes current. Loaded by
 * `search-ticks.ts` once Find has hits (the card, `find-map-card.tsx`, at the first hover).
 *
 * - **No node per tick** (DSN-62): the ticks stay on the one canvas; the pointer is tested against
 *   the hit pages (`tick-hit.ts`) using the canvas's last drawn geometry (`tickGeometry()`).
 * - **Mouse and pen** are heard on the document: the bar over the ticks is the reader's own and
 *   takes the pointer when hot, so a press that lands on a tick is claimed in the capture phase
 *   (a press beside a tick still jumps the scroll bar as before).
 * - **Touch** is heard on the canvas, which then takes touches (`touch-action: none`) on its rail
 *   (`ScrollTicks.map`): a finger scrubs from tick to tick with the card following, and lifting
 *   on a tick jumps there.
 * - **Keyboard:** stepping (Enter, F3, the list) lands the card at the current hit for a moment
 *   (not on a touch screen, where it would cover the found word, DSN-44), and every jump or step
 *   is announced ("Page 4, 3 matches"), since the card itself is
 *   `aria-hidden`; the ticks take no focus (the list and ‹ › are the keyboard's way, DSN-61).
 */
import { m } from '../i18n';
import { announce } from '../shell/announcer';
import type * as Card from './find-map-card';
import { type Motion, animate } from '../motion';
import {
  refreshScrollTicks,
  setTickPainter,
  type TickGeometry,
  type TickMark,
  tickGeometry,
} from '../ui/scroll-thumbs';
import { revealHit, selectHit, useSearchStore } from './search';
import { type TickPage, tickAt, tickPages } from './tick-hit';

/** How close a pointer must be to a tick, CSS px along the track. */
const REACH = 6;
const REACH_TOUCH = 18;
/** A stepped-to hit's card stays this long. */
const PEEK_MS = 1600;

let pages: readonly TickPage[] = [];
let card: typeof Card | undefined;
let loading: Promise<void> | undefined;
/** The page the card is wanted for, or -1. */
let wanted = -1;
let canvas: HTMLCanvasElement | null = null;
let installed = false;
let peekTimer = 0;
let unsubscribe: (() => void) | undefined;
let touching: number | null = null;
/** The current tick as drawn: it slides between hits on a spring. The tick the pointer is on. */
let shown: number | null = null;
let slide: Motion | null = null;
let hovered: number | null = null;

const paint = (mark: TickMark) => {
  if (hovered !== null) mark(hovered, 10, 4);
  if (shown !== null) mark(shown, 8, 4);
};

/** Where the current hit's page sits on the track, or null. */
function currentAt(): number | null {
  const { hits, current } = useSearchStore.getState();
  const page = hits[current]?.pageIndex;
  return pages.find((tick) => tick.pageIndex === page)?.at ?? null;
}

/** The current tick heads for the current hit's page: on `quick`, from where it is (Q-10). */
function follow(): void {
  const to = currentAt();
  const from = slide ? slide.stop().value : shown;
  slide = null;
  if (to === null || from === null || from === to) {
    shown = to;
    refreshScrollTicks(true);
    return;
  }
  shown = from;
  slide = animate(from, to, {
    spring: 'quick',
    onUpdate: (value) => {
      shown = value;
      refreshScrollTicks(true);
    },
  });
}

function setHover(at: number | null): void {
  if (at === hovered) return;
  hovered = at;
  refreshScrollTicks(true);
}

const fractionOf = (g: TickGeometry, y: number) => (y - g.top) / g.room;

function show(tick: TickPage, g: TickGeometry): void {
  wanted = tick.pageIndex;
  setHover(tick.at);
  const draw = () => {
    if (wanted === tick.pageIndex) card?.showCard(tick, g.left + g.width, g.top + tick.at * g.room);
  };
  if (card) draw();
  else {
    loading ??= import('./find-map-card').then((module) => {
      card = module;
    });
    void loading.then(draw);
  }
}

function hide(): void {
  wanted = -1;
  setHover(null);
  window.clearTimeout(peekTimer);
  card?.hideCard();
}

/** The hit page under a point of the track, within reach, or null. */
function under(x: number, y: number, reach: number, wide: number): TickPage | null {
  const g = tickGeometry();
  if (!g || x < g.left - wide || x > g.left + g.width + 2) return null;
  return tickAt(pages, fractionOf(g, y), reach / g.room);
}

/** Jumps to a hit page: the current hit if it is there, else the page's first. */
function pick(tick: TickPage): void {
  const { current } = useSearchStore.getState();
  const index = current >= tick.first && current < tick.first + tick.count ? current : tick.first;
  revealHit(selectHit(index));
}

function say(tick: TickPage): void {
  announce(
    `${m.search_page({ number: tick.pageIndex + 1 })}, ${m.findmap_matches({ count: tick.count })}`,
    { key: 'find-map' },
  );
}

const onMove = (event: PointerEvent) => {
  if (event.pointerType === 'touch') return;
  window.clearTimeout(peekTimer);
  const g = tickGeometry();
  const tick = g ? under(event.clientX, event.clientY, REACH, 4) : null;
  if (tick && g) show(tick, g);
  else if (wanted >= 0) hide();
};

const onDown = (event: PointerEvent) => {
  if (event.pointerType === 'touch' || event.button !== 0) return;
  const tick = under(event.clientX, event.clientY, REACH, 4);
  if (!tick) return;
  event.preventDefault();
  event.stopPropagation();
  pick(tick);
  say(tick);
};

const onOut = (event: PointerEvent) => {
  if (event.relatedTarget === null && event.pointerType !== 'touch') hide();
};

/** A finger on the rail: the card follows it; lifting on a tick jumps there. */
const touchAt = (event: PointerEvent) => {
  const g = tickGeometry();
  const tick = g ? tickAt(pages, fractionOf(g, event.clientY), REACH_TOUCH / g.room) : null;
  if (tick && g) show(tick, g);
  else hide();
  return tick;
};
const onTouchDown = (event: PointerEvent) => {
  if (event.pointerType !== 'touch') return;
  touching = event.pointerId;
  canvas?.setPointerCapture(event.pointerId);
  touchAt(event);
};
const onTouchMove = (event: PointerEvent) => {
  if (event.pointerId === touching) touchAt(event);
};
const onTouchUp = (event: PointerEvent) => {
  if (event.pointerId !== touching) return;
  touching = null;
  const tick = touchAt(event);
  hide();
  if (tick) {
    pick(tick);
    say(tick);
  }
};
const onTouchCancel = (event: PointerEvent) => {
  if (event.pointerId !== touching) return;
  touching = null;
  hide();
};

/** A step lands the card at the current hit for a moment, unless a pointer is using it. */
function peek(): void {
  const { hits, current, currentChosen } = useSearchStore.getState();
  const hit = hits[current];
  const g = tickGeometry();
  // Not on a touch screen: a card left on the page would cover the found word (DSN-44).
  if (!currentChosen || !hit || !g || touching !== null || matchMedia('(pointer: coarse)').matches)
    return;
  const tick = pages.find((page) => page.pageIndex === hit.pageIndex);
  if (!tick) return;
  show(tick, g);
  say(tick);
  window.clearTimeout(peekTimer);
  peekTimer = window.setTimeout(hide, PEEK_MS);
}

function install(): void {
  installed = true;
  canvas = document.querySelector<HTMLCanvasElement>('canvas[data-scroll-ticks]');
  document.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerdown', onDown, { capture: true });
  document.addEventListener('pointerout', onOut, { passive: true });
  if (canvas && matchMedia('(pointer: coarse)').matches) {
    canvas.style.pointerEvents = 'auto';
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', onTouchDown);
    canvas.addEventListener('pointermove', onTouchMove);
    canvas.addEventListener('pointerup', onTouchUp);
    canvas.addEventListener('pointercancel', onTouchCancel);
  }
  shown = currentAt();
  setTickPainter(paint);
  unsubscribe = useSearchStore.subscribe((state, previous) => {
    if (state.current !== previous.current && state.currentChosen) peek();
  });
}

function uninstall(): void {
  installed = false;
  hide();
  document.removeEventListener('pointermove', onMove);
  document.removeEventListener('pointerdown', onDown, { capture: true });
  document.removeEventListener('pointerout', onOut);
  if (canvas) {
    canvas.style.pointerEvents = '';
    canvas.style.touchAction = '';
    canvas.removeEventListener('pointerdown', onTouchDown);
    canvas.removeEventListener('pointermove', onTouchMove);
    canvas.removeEventListener('pointerup', onTouchUp);
    canvas.removeEventListener('pointercancel', onTouchCancel);
    canvas = null;
  }
  unsubscribe?.();
  unsubscribe = undefined;
  touching = null;
  slide?.stop();
  slide = null;
  shown = hovered = null;
  setTickPainter(null);
}

/** The hits along the track now, of a document of `count` pages; none turns the map off. */
export function setTickPages(hits: readonly { readonly pageIndex: number }[], count: number): void {
  pages = tickPages(hits, count);
  if (pages.length === 0) {
    if (installed) uninstall();
  } else {
    if (!installed) install();
    follow();
  }
}
