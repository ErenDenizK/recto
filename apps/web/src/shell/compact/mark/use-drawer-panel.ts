/**
 * What both tool drawers share (`ToolDrawer.tsx`, the tiles; `ToolList.tsx`, the list,
 * EDN-16), the phone sheet's stays-open form (DSN-53): the rise from below and back
 * (`drawer-motion.ts`, MOT-12), Esc and Android's back (a close watcher where the browser has
 * one), the swipe down and the press outside (`design/phone-2026-10/README.md` §3 "Closing";
 * EDN-18, `drawer-close.ts`).
 *
 * - Opening, the panel takes focus; closed (the motion's finish, never a timer), the chip takes
 *   the receive pulse, focus goes back to ▾ if it was inside and nothing has taken it since (a
 *   press that went through to the page may have opened a text box), and `onClosed` unmounts it.
 * - `through`: while the armed tool's next step is a tap on the page, the scrim lets presses
 *   through and a press outside closes the drawer as it goes on to the page (EDN-18).
 * - The swipe: the panel follows the finger once a press has gone `DRAG_START_PX` down (more
 *   down than sideways), and a long or quick enough swipe closes it; a shorter one springs back.
 *   A press in a list that has scrolled from its top scrolls it instead, so the swipe never
 *   fights the rows (iOS Safari): from the head, or from rows at their top.
 */
import { type PointerEvent, type RefObject, useEffect, useLayoutEffect, useRef } from 'react';

import { receivePulse } from '../../../motion/receive';
import { useToolStore } from '../../../viewer/tool-store';
import { setDrawerOpen } from '../compact-store';
import { closeOnOutsidePress, pressGoesThrough } from './drawer-close';
import { drawerMotion, type DrawerMotion, swipeCloses } from './drawer-motion';

/** The browser's close watcher (Android's back), where it has one. */
interface CloseWatcherLike {
  onclose: (() => void) | null;
  destroy(): void;
}

/** A drag this far down (CSS px) takes the panel with the finger. */
const DRAG_START_PX = 6;

export const chipOf = (): Element | null => document.querySelector('[data-compact-tool-chip]');

export interface DrawerPanel {
  readonly panelRef: RefObject<HTMLDivElement | null>;
  /** A press outside goes on to the page (the scrim lets it through), EDN-18. */
  readonly through: boolean;
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
      const now = document.activeElement;
      const free = now === null || now === document.body || panel.contains(now);
      if (hadFocus && free)
        document.querySelector<HTMLElement>('[data-testid="compact-tool-more"]')?.focus();
      closed.current();
    });
    return () => {
      live = false;
    };
  }, [open]);

  // Unmounted (editing left with the drawer open): what it covered is whole again.
  useEffect(() => () => motion.current?.dispose(), []);

  // A press outside, while the armed tool's next step is on the page: closes and goes on.
  const through = useToolStore((s) => pressGoesThrough(s.mode));
  useEffect(() => {
    if (!open || !through) return;
    return closeOnOutsidePress(() => panelRef.current);
  }, [open, through]);

  // Esc closes from anywhere while open; so does Android's back, through a close watcher.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const Watcher = (window as unknown as { CloseWatcher?: new () => CloseWatcherLike })
      .CloseWatcher;
    let watcher: CloseWatcherLike | undefined;
    try {
      watcher = Watcher ? new Watcher() : undefined;
    } catch {
      // Without a user activation a browser may refuse one: Esc and the rest still close it.
    }
    if (watcher) watcher.onclose = () => setDrawerOpen(false);
    return () => {
      window.removeEventListener('keydown', onKey);
      watcher?.destroy();
    };
  }, [open]);

  // Swipe down: the panel follows the finger, and a long or quick enough swipe closes it.
  const drag = useRef<{ id: number; x: number; y: number; t: number; on: boolean } | null>(null);
  const swipe: DrawerPanel['swipe'] = {
    onPointerDown: (event) => {
      if (!event.isPrimary || !open) return;
      // Rows scrolled from their top take the press as a scroll, never as the swipe.
      const scroller = (event.target as Element).closest?.('[data-scrolls]');
      if (scroller && scroller.scrollTop > 0) return;
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

  return { panelRef, through, swipe };
}
