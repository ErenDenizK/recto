/**
 * Pinch in the Pages grid (`components/06-navigation.md` PG1 §6; flows.md §7.1; `05-canvas`
 * §4's chip): two fingers step the cell size by one detent per ×1.4 of scale, live, and the
 * cells reflow by FLIP (`flip-cells.tsx`); past the largest size by a further 15 % the chip
 * "Release to open page 7" shows, and releasing there opens the page under the fingers'
 * midpoint (`leaveGrid`). Pinching back below the threshold hides the chip again.
 *
 * The recogniser is the gesture core's (`motion/gesture/pinch.ts`, spec X5) on the grid's
 * scroller, which keeps `touch-action: pan-x pan-y`, so one finger still scrolls natively and
 * the browser's own pinch zoom is off there; Safari's trackpad `gesture*` events drive it too.
 * Every gesture has its key or button (A-8, WCAG 2.5.1): the header's slider and Mod+wheel for
 * the size, Enter for opening.
 *
 * The chip is shown, placed and faded by attributes and `transform`, never by a render, so a
 * pinch's frames lay nothing out beyond the size steps themselves.
 */
import { findPageLocation, type PageId } from '@pdf-editor/document-model';
import { type Ref, type RefObject, useEffect } from 'react';

import { m } from '../../i18n';
import { attachPinch } from '../../motion/gesture/dom';
import { announce } from '../../shell/announcer';
import { ARRANGE_SIZES, useUiStore } from '../../state/ui-store';
import { useWorkspaceStore } from '../../state/workspace-store';
import { Icon } from '../../ui/Icon';
import chipStyles from '../PinchDetentChip.module.css';
import { gridSizeAnnouncement } from './GridPieces';
import { leaveGrid } from './grid-transition';

/** Scale per size detent (PG1 §6). */
export const GRID_PINCH_STEP = 1.4;
/** How far past the largest size a spread must go before release opens the page (×). */
export const GRID_PINCH_OPEN = 1.15;
/** The chip sits this far above the fingers' midpoint (CSS px; 05-canvas §4). */
const CHIP_LIFT = 24;

/** The size a pinch of `scale` reaches from `start`, and whether its release opens a page. */
export function pinchGridSize(
  start: number,
  scale: number,
  max: number = ARRANGE_SIZES.length - 1,
): { readonly size: number; readonly opens: boolean } {
  const safe = scale > 0 && Number.isFinite(scale) ? scale : 1;
  const steps = Math.log(safe) / Math.log(GRID_PINCH_STEP);
  const size = Math.min(max, Math.max(0, start + Math.trunc(steps + (steps < 0 ? -1e-9 : 1e-9))));
  const opens = safe >= GRID_PINCH_STEP ** (max - start) * GRID_PINCH_OPEN;
  return { size, opens };
}

/** The page whose cell is under a client point, if any. */
function pageAt(x: number, y: number): PageId | undefined {
  const cell = document
    .elementFromPoint(x, y)
    ?.closest<HTMLElement>('[data-grid-viewport] [role="gridcell"][data-page-id]');
  return (cell?.dataset.pageId as PageId | undefined) ?? undefined;
}

/** Wires the grid's pinch on `viewport`, showing `chip` while a release would open a page. */
export function useGridPinch(
  viewport: RefObject<HTMLElement | null>,
  chip: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    const target = viewport.current;
    if (!target) return;
    let start = useUiStore.getState().arrangeSize;
    let opening: PageId | undefined;
    const hideChip = () => {
      const el = chip.current;
      if (!el) return;
      el.removeAttribute('data-shown');
      el.hidden = true;
    };
    const showChip = (page: PageId, x: number, y: number) => {
      const el = chip.current;
      const frame = target.closest<HTMLElement>('[data-pages-grid]');
      if (!el || !frame) return;
      const ws = useWorkspaceStore.getState().workspace;
      const index = findPageLocation(ws, page)?.index ?? 0;
      const text = el.querySelector('[data-chip-text]');
      if (text) text.textContent = m.grid_pinch_open({ page: index + 1 });
      el.hidden = false;
      const box = frame.getBoundingClientRect();
      const left = Math.max(
        8,
        Math.min(box.width - el.offsetWidth - 8, x - box.left - el.offsetWidth / 2),
      );
      const top = Math.max(8, y - box.top - el.offsetHeight - CHIP_LIFT);
      el.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
      el.setAttribute('data-shown', '');
    };
    return attachPinch(target, {
      onStart: () => {
        start = useUiStore.getState().arrangeSize;
        opening = undefined;
      },
      onChange: (scale, origin) => {
        const { size, opens } = pinchGridSize(start, scale);
        const ui = useUiStore.getState();
        if (size !== ui.arrangeSize) {
          ui.setArrangeSize(size);
          announce(gridSizeAnnouncement(size));
        }
        opening = opens ? pageAt(origin.x, origin.y) : undefined;
        if (opening === undefined) hideChip();
        else showChip(opening, origin.x, origin.y);
      },
      onEnd: () => {
        hideChip();
        const page = opening;
        opening = undefined;
        if (page !== undefined) leaveGrid({ page });
      },
    });
  }, [viewport, chip]);
}

/** "Release to open page 7" (PG1 §6), decorative for assistive technology like its twin. */
export function GridPinchChip({ ref }: { readonly ref: Ref<HTMLDivElement> }) {
  return (
    <div ref={ref} className={chipStyles.chip} data-testid="grid-pinch-chip" aria-hidden hidden>
      <Icon name="arrows-out-simple" className={chipStyles.icon} />
      <span data-chip-text="" />
    </div>
  );
}
