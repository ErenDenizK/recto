/**
 * Entry `@pdf-editor/engine/constants`: plain values the app needs synchronously, on a subpath
 * that imports nothing. A value import of the `@pdf-editor/engine` barrel would put the whole
 * engine and pdf-lib on the editor's initial path (docs/plan/v1/PLAN.md PF-1), so the app takes
 * values from here and only types from the barrel (the lint guard in eslint.config.js).
 */

/** Shrink-to-fit floor (spec §2.5): the replacement may shrink to 75% of the run's size. */
export const TEXT_EDIT_SHRINK_FLOOR = 0.75;
