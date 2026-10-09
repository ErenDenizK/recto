/**
 * Lab: unfinished work behind a build-time flag (docs/plan/v1/editions.md §2, §4.4; PLAN ED-3),
 * such as R12's L-1 Liquid Glass union. `main.tsx` loads this module only `if (__LAB__)`, so a
 * build without `RECTO_LAB=1` (every deploy and release build) compiles none of it, and a lab
 * feature registers itself from here, never from shared code. A lab flag never stands in for a
 * capability.
 *
 * The marker below is in every lab build and in no other: tools/qa/bundle-budget.ts fails a
 * build whose files carry it.
 */
export const LAB_BUILD_MARKER = 'recto-lab-build';

/** Starts the lab features of this build (none yet) and marks the page as a lab build. */
export function startLab(): void {
  document.documentElement.dataset.lab = LAB_BUILD_MARKER;
}
