/**
 * What both tool drawers share (`ToolDrawer.tsx`, the tiles; `ToolList.tsx`, the list,
 * EDN-16): the container transform out of the tool chip and back (`drawer-motion.ts`, MOT-5),
 * Esc, and the swipe down (`design/phone-2026-10/README.md` §3 "Closing").
 *
 * - Opening, the panel takes focus; closed (the motion's finish, never a timer), the chip takes
 *   the receive pulse, focus goes back to ▾ if it was inside, and `onClosed` unmounts it.
 * - The swipe: the panel follows the finger once a press has gone `DRAG_START_PX` down (more
 *   down than sideways), and a long or quick enough swipe closes it; a shorter one springs back.
 */
import { type PointerEvent, type RefObject, useEffect, useLayoutEffect, useRef } from 'react';

import { receivePulse } from '../../../motion/receive';
import { setDrawerOpen } from '../compact-store';
import { drawerMotion, type DrawerMotion, swipeCloses } from './drawer-motion';

/** A drag this far down (CSS px) takes the panel with the finger. */
const DRAG_START_PX = 6;

export const chipOf = (): Element | null => document.querySelector('[data-compact-tool-chip]');

export interface DrawerPanel {
  readonly panelRef: RefObject<HTMLDivElement | null>;
  readonly swipe: {
    readonly onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
    readonly onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
    readonly onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
    readonly onPointerCancel: () => void;
  };
}

export function useDrawerPanel(
  open: boolean,
  onClosed: () => void,
  covers?: () => HTMLElement | null,
): DrawerPanel {
  const panelRef = useRef<HTMLDivElement>(null);
  const motion = useRef<DrawerMotion | null>(null);
  const closed = useRef(onClosed);
  const covered = useRef(covers);
  useLayoutEffect(() => {
    closed.current = onClosed;
    covered.current = covers;
  });

  // Open and close by the container transform; closed, the chip takes the panel back.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    motion.current ??= drawerMotion(
      panel,
      chipOf,
      covered.current ? () => covered.current?.() ?? null : undefined,
    );
    if (open) {
      void motion.current.to(1);
      panel.focus({ preventScroll: true });
      return;
    }
    const hadFocus = panel.contains(document.activeElement);
    let live = true;
    void motion.current.to(0).then(() => {
      if (!live) return;
      const chip = chipOf();
      if (chip) void receivePulse(chip);
      if (hadFocus)
        document.querySelector<HTMLElement>('[data-testid="compact-tool-more"]')?.focus();
      closed.current();
    });
    return () => {
      live = false;
    };
  }, [open]);

  // Unmounted (editing left with the drawer open): what it covered is whole again.
  useEffect(() => () => motion.current?.dispose(), []);

  // Esc closes from anywhere while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Swipe down: the panel follows the finger, and a long or quick enough swipe closes it.
  const drag = useRef<{ id: number; x: number; y: number; t: number; on: boolean } | null>(null);
  const swipe: DrawerPanel['swipe'] = {
    onPointerDown: (event) => {
      if (!event.isPrimary || !open) return;
      drag.current = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        t: event.timeStamp,
        on: false,
      };
    },
    onPointerMove: (event) => {
      const d = drag.current;
      if (d?.id !== event.pointerId) return;
      const dy = event.clientY - d.y;
      if (!d.on) {
        if (dy < DRAG_START_PX || Math.abs(event.clientX - d.x) > dy) return;
        d.on = true;
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      motion.current?.drag(dy);
    },
    onPointerUp: (event) => {
      const d = drag.current;
      drag.current = null;
      if (!d?.on || d.id !== event.pointerId) return;
      const dy = event.clientY - d.y;
      const ms = Math.max(1, event.timeStamp - d.t);
      if (swipeCloses(dy, dy / ms)) setDrawerOpen(false);
      else motion.current?.release();
    },
    onPointerCancel: () => {
      drag.current = null;
      motion.current?.release();
    },
  };

  return { panelRef, swipe };
}
