/**
 * What a stroke held into a shape needs (motion-2026-10/ink-shapes.md §2–§4): the recogniser
 * (`shapes.ts`) and the morph and chip (`shape-hold.ts`); the commit (`shape-commit.ts`) draws
 * with `shape-outline.ts`.
 * They are not part of the editor's first load (docs/plan/v1/PLAN.md §2.3 V1-P2): `ink-input.ts`
 * starts loading them when the pen arms and again at each press, long before a hold can be due
 * (500 ms at the earliest), so the morph never starts late.
 */
import { lazyModule } from '../../motion/lazy';

export const shapeKit = lazyModule(() => import('./shape-kit-impl'));
