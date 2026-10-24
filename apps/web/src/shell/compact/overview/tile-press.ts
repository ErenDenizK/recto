/**
 * A finger on a tile (MOB-3; `docs/research/phone-2026-10/pages.md` §4.1, the Photos and
 * Files grammar): a tap is the tile's click; a press held `LONG_PRESS_MS` without moving
 * selects (the tile answers with a press tick) and swallows the click that follows; held and
 * then moved, it lifts the tile and drags it, with a drop bar in the gap under the finger and
 * the grid scrolling by itself near its top and bottom edges; letting go moves the page (or the
 * selection it belongs to) into that gap, one undo step (`moveTo`).
 *
 * One finger that moves before the long press is a scroll (native, `touch-action: pan-y`);
 * after it, the moves are the drag's (`preventDefault` on a non-passive listener). The tiles
 * under the finger stay mounted until it lifts (`hold`), whatever the drag scrolls away: a touch
 * whose target leaves the document stops reaching the grid. The long press's own menu and
 * callout are refused (`contextmenu`, `-webkit-touch-callout`). Moves only `transform`; the
 * keyboard and screen-reader path is the bar's ⋯ (Move to start, Move to end; WCAG 2.5.7).
 */
import type { PageId } from '@pdf-editor/document-model';

import { m } from '../../../i18n';
import { reducedMotion } from '../../../motion/reduced-motion';
import { springEasing } from '../../../motion/springs';
import { announce } from '../../announcer';
import { useCompactStore } from '../compact-store';
import { type GridLayout, slotBox, TILE_GAP } from './overview-layout';
import { moveTo } from './page-actions';
import {
  dropGap,
  edgeSpeed,
  LIFT_SLOP,
  LONG_PRESS_MS,
  movesSomething,
  PRESS_SLOP,
} from './page-plan';
import { setSelecting, togglePage, useOverviewSelection } from './selection';

/** The click after a long press or a drag is the gesture's, not a tap. */
let swallowClick = false;

/** Whether the click now ending is a long press's (it is then swallowed, once). */
export function takeSwallowedClick(): boolean {
  const swallowed = swallowClick;
  swallowClick = false;
  return swallowed;
}

export interface PressHost {
  readonly scroller: HTMLElement;
  readonly plane: HTMLElement;
  /** The drop bar the drag places in the gap. */
  readonly marker: HTMLElement;
  layout(): GridLayout;
  pageIds(): readonly PageId[];
  /** Keeps these tiles mounted (the finger's) until `hold([])`. */
  hold(indexes: readonly number[]): void;
}

interface Press {
  readonly index: number;
  readonly id: PageId;
  readonly tile: HTMLElement;
  readonly x: number;
  readonly y: number;
  readonly scroll: number;
  timer: number;
  long: boolean;
  lifted: boolean;
  moving: number[];
  gap: number;
  fingerX: number;
  fingerY: number;
}

/** A small press tick on the tile (a visual stand-in for a haptic). */
function tick(tile: HTMLElement): void {
  if (reducedMotion() || typeof tile.animate !== 'function') return;
  const curve = springEasing('press');
  tile.animate([{ scale: '0.94' }, { scale: '1' }], {
    duration: curve.duration,
    easing: curve.easing,
  });
}

/** Wires the presses on `host`'s tiles; returns the stop. */
export function watchTilePresses(host: PressHost): () => void {
  const { scroller, plane, marker } = host;
  let press: Press | null = null;
  let frame = 0;
  let last = 0;

  const placeMarker = (gap: number) => {
    const layout = host.layout();
    const count = layout.count;
    if (count === 0) return;
    const at = Math.min(gap, count - 1);
    const slot = slotBox(layout, at);
    const left = gap >= count ? slot.left + slot.width + TILE_GAP / 2 : slot.left - TILE_GAP / 2;
    marker.style.transform = `translate(${Math.round(left - 1.5)}px, ${Math.round(slot.top)}px)`;
    marker.style.height = `${slot.height}px`;
    marker.hidden = false;
  };

  const follow = () => {
    const p = press;
    if (!p?.lifted) return;
    const rect = plane.getBoundingClientRect();
    const dx = p.fingerX - p.x;
    const dy = p.fingerY - p.y + (scroller.scrollTop - p.scroll);
    p.tile.style.transform = `translate(${dx}px, ${dy}px) scale(1.06)`;
    p.gap = dropGap(host.layout(), p.fingerX - rect.left, p.fingerY - rect.top);
    placeMarker(p.gap);
  };

  // Near an edge the grid scrolls by itself while the finger rests there.
  const autoscroll = (time: number) => {
    frame = 0;
    const p = press;
    if (!p?.lifted) return;
    const view = scroller.getBoundingClientRect();
    const speed = edgeSpeed(p.fingerY, view.top, view.bottom);
    const dt = last === 0 ? 0 : Math.min(0.05, (time - last) / 1000);
    last = time;
    if (speed !== 0 && dt > 0) {
      scroller.scrollTop += speed * dt;
      follow();
    }
    frame = requestAnimationFrame(autoscroll);
  };

  const end = (drop: boolean) => {
    const p = press;
    press = null;
    if (frame !== 0) cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
    if (!p) return;
    window.clearTimeout(p.timer);
    marker.hidden = true;
    plane.removeAttribute('data-dragging');
    if (!p.lifted) return;
    p.tile.style.transform = '';
    p.tile.removeAttribute('data-lifted');
    const ids = host.pageIds();
    const moving = p.moving.flatMap((i) => (ids[i] === undefined ? [] : [ids[i]]));
    if (drop && movesSomething(p.moving, p.gap)) moveTo(moving, p.gap);
    host.hold([]);
  };

  const onTouchStart = (event: TouchEvent) => {
    if (event.touches.length !== 1) {
      end(false);
      return;
    }
    if (useCompactStore.getState().overview !== 'open') return;
    const touch = event.touches[0];
    const target = touch?.target instanceof Element ? touch.target : null;
    const button = target?.closest<HTMLElement>('button[data-tile-index]');
    const tile = button?.closest<HTMLElement>('[role="listitem"]');
    if (!touch || !button || !tile) return;
    const index = Number(button.dataset.tileIndex);
    const id = button.dataset.tilePageId as PageId | undefined;
    if (id === undefined || !Number.isInteger(index)) return;
    swallowClick = false;
    const p: Press = {
      index,
      id,
      tile,
      x: touch.clientX,
      y: touch.clientY,
      scroll: scroller.scrollTop,
      timer: 0,
      long: false,
      lifted: false,
      moving: [index],
      gap: index,
      fingerX: touch.clientX,
      fingerY: touch.clientY,
    };
    p.timer = window.setTimeout(() => {
      if (press !== p) return;
      p.long = true;
      swallowClick = true;
      tick(tile);
      const selection = useOverviewSelection.getState();
      if (!selection.selecting) setSelecting(true);
      if (!useOverviewSelection.getState().selected.has(id)) togglePage(id);
      const count = useOverviewSelection.getState().selected.size;
      announce(m.compact_overview_selecting({ count }));
    }, LONG_PRESS_MS);
    press = p;
    host.hold([index]);
  };

  const onTouchMove = (event: TouchEvent) => {
    const p = press;
    const touch = event.touches[0];
    if (!p || !touch || event.touches.length !== 1) return;
    p.fingerX = touch.clientX;
    p.fingerY = touch.clientY;
    const distance = Math.hypot(touch.clientX - p.x, touch.clientY - p.y);
    if (!p.long) {
      // Moved first: a scroll, never a press.
      if (distance > PRESS_SLOP) end(false);
      return;
    }
    event.preventDefault();
    if (!p.lifted) {
      if (distance < LIFT_SLOP) return;
      p.lifted = true;
      const ids = host.pageIds();
      const selected = useOverviewSelection.getState().selected;
      const chosen = ids.flatMap((pageId, i) => (selected.has(pageId) ? [i] : []));
      p.moving = chosen.includes(p.index) ? chosen : [p.index];
      host.hold(p.moving.includes(p.index) ? p.moving : [p.index, ...p.moving]);
      p.tile.setAttribute('data-lifted', '');
      plane.setAttribute('data-dragging', '');
      announce(m.compact_overview_lifted({ number: p.index + 1 }));
      frame = requestAnimationFrame(autoscroll);
    }
    follow();
  };

  const onTouchEnd = (event: TouchEvent) => {
    if (!press || event.touches.length > 0) return;
    const p = press;
    if (!p.lifted && !p.long) {
      window.clearTimeout(p.timer);
      press = null;
      host.hold([]);
      return;
    }
    end(event.type === 'touchend');
  };

  // The long press's own menu (Android) and selection never show.
  const onContextMenu = (event: Event) => {
    if ((event.target as Element | null)?.closest?.('button[data-tile-index]')) {
      event.preventDefault();
    }
  };

  scroller.addEventListener('touchstart', onTouchStart, { passive: true });
  scroller.addEventListener('touchmove', onTouchMove, { passive: false });
  scroller.addEventListener('touchend', onTouchEnd);
  scroller.addEventListener('touchcancel', onTouchEnd);
  scroller.addEventListener('contextmenu', onContextMenu);
  return () => {
    end(false);
    scroller.removeEventListener('touchstart', onTouchStart);
    scroller.removeEventListener('touchmove', onTouchMove);
    scroller.removeEventListener('touchend', onTouchEnd);
    scroller.removeEventListener('touchcancel', onTouchEnd);
    scroller.removeEventListener('contextmenu', onContextMenu);
  };
}
