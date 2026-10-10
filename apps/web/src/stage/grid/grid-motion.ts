/**
 * The Pages grid's motion (docs/design/motion-2026-10/pages.md: the cascade, the ripple, leave
 * and arrive, lift and settle, make way, the sheet's turn, the flight to a tab), not part of
 * the editor's first load (PLAN.md §2.3 V1-P2). The stage loads it as soon as a document is
 * open (`Stage.tsx`), long before the grid can be entered; callers take it with `now()` and,
 * should it not be here (offline before the precache filled), change the grid without motion.
 */
import { lazyModule } from '../../motion/lazy';

export const gridMotion = lazyModule(() => import('./grid-motion-impl'));
