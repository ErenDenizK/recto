/**
 * The "Apply redactions" sheet (S19, `ApplySheet.tsx`: the Marks filter's button and the
 * markup bar's Apply redactions…) and the apply it runs.
 *
 * The run lives here, not in the sheet: while it works the sheet refuses to close (Esc, the
 * scrim and every other close request are ignored), and its outcome (applied, blocked, error)
 * stays here while the sheet shows it. The next opening starts from a fresh form: a finished
 * outcome was seen, and `opened` counts the openings so the form's choices start afresh too.
 */
import { create } from 'zustand';

import { type ApplyChoices, type ApplyOutcome, applyTickedRedactions } from './apply';

export type ApplyRun =
  | { readonly kind: 'idle' }
  | { readonly kind: 'working' }
  | { readonly kind: 'done'; readonly outcome: ApplyOutcome };

const IDLE: ApplyRun = { kind: 'idle' };

interface ApplyDialogState {
  readonly open: boolean;
  readonly run: ApplyRun;
  /** How many times the sheet has opened: the form's key, so each opening starts afresh. */
  readonly opened: number;
  /** Opens or closes the sheet; closing is ignored while the apply runs. */
  setOpen: (open: boolean) => void;
}

export const useApplyDialogStore = create<ApplyDialogState>()((set) => ({
  open: false,
  run: IDLE,
  opened: 0,
  setOpen: (open) =>
    set((s) => {
      if (!open) return s.run.kind === 'working' ? s : { open: false };
      if (s.open) return s;
      // A finished outcome was seen when the sheet closed; the new opening shows the form.
      return { open: true, opened: s.opened + 1, run: s.run.kind === 'done' ? IDLE : s.run };
    }),
}));

/** Applies the ticked marks with `choices`, keeping the progress and the outcome here. */
export async function runApply(choices: ApplyChoices): Promise<ApplyOutcome | undefined> {
  if (useApplyDialogStore.getState().run.kind === 'working') return undefined;
  useApplyDialogStore.setState({ run: { kind: 'working' } });
  let outcome: ApplyOutcome;
  try {
    outcome = await applyTickedRedactions(choices);
  } catch (error) {
    // applyTickedRedactions never rejects; this keeps the dialog out of "working" forever.
    outcome = { kind: 'error', message: error instanceof Error ? error.message : String(error) };
  }
  useApplyDialogStore.setState({ run: { kind: 'done', outcome } });
  return outcome;
}

/** Forgets a finished run's outcome (its sheet was seen: Back, or the dialog closed). */
export function dismissApplyOutcome(): void {
  if (useApplyDialogStore.getState().run.kind === 'done') {
    useApplyDialogStore.setState({ run: IDLE });
  }
}

/** Tests: closed, nothing running. */
export function resetApplyDialog(): void {
  useApplyDialogStore.setState({ open: false, run: IDLE });
}
