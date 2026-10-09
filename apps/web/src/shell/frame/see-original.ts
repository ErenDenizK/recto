/**
 * See the original, phase 1a (docs/plan/v1/PLAN.md S2-1a; research ROADMAP S2): the title
 * menu's eye shows the pages without their marks, annotations and form fields, while it is
 * held or after a tap toggled it.
 *
 * - **Hold** (a press kept past `HOLD_MS`): the marks hide while the press lasts and come back
 *   on release, and always on `pointercancel` (a scroll, the system taking the touch), so a
 *   lost pointer can never leave the document looking stripped.
 * - **Tap** (or Enter, Space): toggles, and the strip's "Markup hidden" pill
 *   (`OriginalPill.tsx`) says so and brings them back. Closing or switching the document
 *   brings them back too.
 * - The pages render bare (`RenderRequest.bare`: PDFium without the annotation and widget
 *   passes) and the overlay layers that draw marks hide (`data-original` on the root, which
 *   their style sheets answer). Nothing in the document changes; no history entry.
 * - Announced "Showing the pages without markup" / "Markup shown again" (polite).
 */
import { create } from 'zustand';

import { m } from '../../i18n';
import { announce } from '../announcer';

/** How long a press is held before it peeks instead of toggling. */
export const HOLD_MS = 280;

interface OriginalState {
  /** A press is held on the eye. */
  readonly held: boolean;
  /** A tap turned it on. */
  readonly toggled: boolean;
}

export const useOriginalStore = create<OriginalState>()(() => ({ held: false, toggled: false }));

/** Whether the pages show without marks now (held or toggled). */
export const showingOriginal = (state: OriginalState = useOriginalStore.getState()): boolean =>
  state.held || state.toggled;

export const useShowingOriginal = (): boolean => useOriginalStore(showingOriginal);

function apply(next: OriginalState): void {
  const before = showingOriginal();
  useOriginalStore.setState(next);
  const after = showingOriginal(next);
  if (typeof document !== 'undefined') {
    if (after) document.documentElement.setAttribute('data-original', '');
    else document.documentElement.removeAttribute('data-original');
  }
  if (before !== after) announce(after ? m.original_announce_on() : m.original_announce_off());
}

/** A held press started peeking. */
export function holdOriginal(): void {
  apply({ ...useOriginalStore.getState(), held: true });
}

/** The held press ended (release or `pointercancel`): the marks come back unless toggled. */
export function releaseOriginal(): void {
  if (!useOriginalStore.getState().held) return;
  apply({ ...useOriginalStore.getState(), held: false });
}

/** A tap (or Enter, Space) on the eye. */
export function toggleOriginal(): void {
  const { toggled } = useOriginalStore.getState();
  apply({ held: false, toggled: !toggled });
}

/** Everything back (the pill's "Show marks", a document closed or switched). */
export function resetOriginal(): void {
  if (!showingOriginal()) return;
  apply({ held: false, toggled: false });
}
