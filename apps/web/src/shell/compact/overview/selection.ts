/**
 * The overview's selection model (MOB-3's seam; MOB-2 builds none of its operations): the
 * pages picked in the overview, by stable page id, and whether the overview is selecting. A
 * tile's tap asks `tileTap` what it does, so the grid never assumes "tap = open"
 * (`docs/research/phone-2026-10/pinch-overview.md` §2.1 item 6): while selecting (MOB-3's long
 * press, DSN-10's Photos model) a tap toggles the page instead of opening it.
 *
 * The selection clears whenever the overview closes (06-navigation §1.1: selection belongs to
 * the surface that made it).
 */
import type { PageId } from '@pdf-editor/document-model';
import { create } from 'zustand';

export interface OverviewSelection {
  /** A long press started selecting; taps toggle pages until it ends. */
  readonly selecting: boolean;
  readonly selected: ReadonlySet<PageId>;
}

const EMPTY: OverviewSelection = { selecting: false, selected: new Set() };

export const useOverviewSelection = create<OverviewSelection>()(() => EMPTY);

/** Starts or ends selecting; ending clears the selection. */
export function setSelecting(selecting: boolean): void {
  useOverviewSelection.setState(selecting ? { selecting } : EMPTY);
}

/** Adds or removes one page. */
export function togglePage(id: PageId): void {
  const next = new Set(useOverviewSelection.getState().selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  useOverviewSelection.setState({ selected: next });
}

export function clearSelection(): void {
  useOverviewSelection.setState(EMPTY);
}

/** What a tap on a tile does now: open its page, or toggle it while selecting. */
export function tileTap(): 'open' | 'toggle' {
  return useOverviewSelection.getState().selecting ? 'toggle' : 'open';
}
