/**
 * The History scrubber's opening (08-feedback FB7 §1, §6). ↶ opens it on a long press,
 * right-click, Shift+F10 or the Menu key; ⌘K's "Show history…" asks through here, and ↶
 * (which anchors it) renders it.
 *
 * An opening remembers the step it opened at and owns the preview session, so whichever way
 * it closes (a keep, Cancel, Esc, a press outside) settles it exactly once: a keep stays where
 * it is, everything else restores the opening step.
 */
import { create } from 'zustand';

import { useWorkspaceStore } from '../state/workspace-store';
import { keepStep, previewStep } from './actions';
import { createPreviewSession, crossesReplay, type PreviewSession } from './preview';

export interface ScrubberOpening {
  /** Tells openings apart (a React key). */
  readonly serial: number;
  /** The step (index into `historyEntries`) shown when it opened. */
  readonly start: number;
  readonly preview: PreviewSession;
}

interface ScrubberState {
  /** The open scrubber's opening, or null when closed. */
  readonly opening: ScrubberOpening | null;
  /** The last opening, kept after it closed so the popup can play its exit. */
  readonly last: ScrubberOpening | null;
}

export const useHistoryScrubber = create<ScrubberState>()(() => ({ opening: null, last: null }));

let serial = 0;

/** Whether `opening` is the open one (a closing popup ignores input). */
export function isOpenOpening(opening: ScrubberOpening): boolean {
  return useHistoryScrubber.getState().opening === opening;
}

const model = () => useWorkspaceStore.getState();

/** Opens the scrubber at the present step (no-op when open). */
export function openHistoryScrubber(): void {
  if (useHistoryScrubber.getState().opening !== null) return;
  const start = model().history.past.length;
  const preview = createPreviewSession({
    start,
    show: previewStep,
    waits: (from, to) => crossesReplay(model().history, from, to),
  });
  serial += 1;
  const opening = { serial, start, preview };
  useHistoryScrubber.setState({ opening, last: opening });
}

/** Closes it, settling the opening: `keep` an index, or restore the opening step. */
export function closeHistoryScrubber(keep?: number): void {
  const { opening } = useHistoryScrubber.getState();
  if (opening === null) return;
  useHistoryScrubber.setState({ opening: null });
  if (keep === undefined) {
    opening.preview.restore();
    return;
  }
  opening.preview.flush();
  keepStep(keep, opening.start);
}
