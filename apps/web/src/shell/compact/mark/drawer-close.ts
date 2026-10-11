/**
 * The drawer's close after an arming press (`design/phone-2026-10/README.md` §3 "Feel": the
 * arming tile answers with the receive pulse, then the drawer goes back into the chip). The
 * close waits on the pulse's crest (`receivePulse` resolves there, from an animation on the
 * same timeline), never on a timer: under reduced motion, or with no animation, it closes at
 * once. If the drawer closed or opened again meanwhile (the chip, a swipe, Esc), the late close
 * is dropped, so it can never shut a drawer opened after the press.
 */
import { setDrawerOpen, useCompactStore } from '../compact-store';

/** Closes the drawer once `crest` resolves, unless it has closed or reopened since. */
export function closeDrawerAfter(crest: Promise<void>): void {
  let moved = false;
  const stop = useCompactStore.subscribe((state, previous) => {
    if (state.drawerOpen !== previous.drawerOpen) moved = true;
  });
  void crest.then(() => {
    stop();
    if (!moved && useCompactStore.getState().drawerOpen) setDrawerOpen(false);
  });
}
