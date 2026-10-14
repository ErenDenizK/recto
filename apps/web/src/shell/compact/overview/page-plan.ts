/**
 * The phone overview's page acts as pure rules (MOB-3; `docs/research/phone-2026-10/pages.md`
 * §4.1): where Add inserts, where a dragged tile drops, how Split here cuts the document, and
 * the long press's timing. `page-actions.ts` runs them through the full edition's operations.
 */
import type { GridLayout } from './overview-layout';
import { pageAtPoint, slotBox } from './overview-layout';

/** A press held this long without moving selects (the gesture core's long press, 06 §2.4). */
export const LONG_PRESS_MS = 450;
/** A press that moves this far before the long press is a scroll, not a press, CSS px. */
export const PRESS_SLOP = 10;
/** After the long press, a move this far lifts the tile for a drag, CSS px. */
export const LIFT_SLOP = 8;
/** Within this distance of the grid's top or bottom edge a drag scrolls it, CSS px. */
export const EDGE_ZONE = 72;
/** The fastest edge autoscroll, CSS px per second. */
export const EDGE_SPEED = 900;

/**
 * Where Add puts new pages: after the last selected page, else after the page the overview
 * opened on, else at the end.
 */
export function insertionIndex(
  count: number,
  selected: readonly number[],
  anchor: number | undefined,
): number {
  if (selected.length > 0) return Math.min(count, Math.max(...selected) + 1);
  if (anchor !== undefined && anchor >= 0 && anchor < count) return anchor + 1;
  return count;
}

/**
 * The gap a drag at content point (x, y) drops into (0 = before the first page, `count` =
 * after the last): before the page under the point, or after it past its slot's middle.
 */
export function dropGap(layout: GridLayout, x: number, y: number): number {
  const index = pageAtPoint(layout, x, y);
  if (index < 0) return 0;
  const slot = slotBox(layout, index);
  return x > slot.left + slot.width / 2 ? index + 1 : index;
}

/** Whether dropping `moving` (page indexes) into `gap` would change the order. */
export function movesSomething(moving: readonly number[], gap: number): boolean {
  if (moving.length === 0) return false;
  const sorted = [...moving].sort((a, b) => a - b);
  const contiguous = sorted.every((value, i) => i === 0 || value === (sorted[i - 1] ?? 0) + 1);
  const first = sorted[0] ?? 0;
  const last = sorted[sorted.length - 1] ?? 0;
  return !(contiguous && gap >= first && gap <= last + 1);
}

/**
 * Split here (MOB-3): a new file starts at each selected page, so the cuts fall before them;
 * a part never stays empty. Ranges are [start, end) page indexes in order.
 */
export function splitRanges(count: number, starts: readonly number[]): [number, number][] {
  const cuts = [...new Set(starts.filter((i) => i > 0 && i < count))].sort((a, b) => a - b);
  const edges = [0, ...cuts, count];
  const ranges: [number, number][] = [];
  for (let i = 0; i + 1 < edges.length; i++) {
    const start = edges[i] ?? 0;
    const end = edges[i + 1] ?? count;
    if (end > start) ranges.push([start, end]);
  }
  return ranges;
}

/**
 * The edge autoscroll's speed for a finger at viewport height `y` in a grid `top`..`bottom`
 * tall (negative scrolls up): zero outside the edge zones, growing quadratically to
 * `EDGE_SPEED` at the edge.
 */
export function edgeSpeed(y: number, top: number, bottom: number): number {
  const into = (distance: number) => {
    const depth = Math.min(1, Math.max(0, (EDGE_ZONE - distance) / EDGE_ZONE));
    return depth * depth * EDGE_SPEED;
  };
  if (y < top + EDGE_ZONE) return -into(y - top);
  if (y > bottom - EDGE_ZONE) return into(bottom - y);
  return 0;
}

/** A part's file name: the document's title without `.pdf`, then ` (pages)` and `.pdf`. */
export function partName(title: string, pages: string): string {
  const base = title.trim().replace(/\.pdf$/i, '') || 'document';
  return `${base} (${pages}).pdf`;
}
