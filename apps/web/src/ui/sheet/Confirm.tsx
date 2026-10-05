/**
 * S1, the one confirmation pattern (components/07-sheets.md §3): `confirm({ title, body,
 * action, danger, undoable })` (in `sheet-store.ts`) asks once before an act that cannot be
 * undone on the device, and resolves true for the action, false for Cancel or Esc. The host
 * renders it as a `confirmation` sheet: a centred 400 px `alertdialog`, or a compact modal
 * sheet, over a scrim that ignores presses so a stray tap cannot answer it (§3.6).
 *
 * Focus starts on the action when the act can be undone (a toast with Undo follows), else on
 * Cancel (§3.6). A destructive action is the danger label on the standard fill with its glyph,
 * never lime (§3.3, A-19). Mount `ConfirmHost` once in the shell.
 */
import { RotateCcw, Trash2 } from 'lucide-react';

import { useRetained } from '../use-retained';
import { Sheet } from './Sheet';
import { answerConfirm, type ConfirmRequest, useSheetStore } from './sheet-store';

export function ConfirmHost() {
  const request = useSheetStore((s) => s.confirm);
  // Keep the last question while the sheet animates closed.
  const [shown] = useRetained<ConfirmRequest>(request);
  if (!shown) return null;
  return (
    <Sheet
      id={`confirm-${shown.id}`}
      kind="confirmation"
      open={request !== null && request.id === shown.id}
      onClose={() => answerConfirm(shown.id, false)}
      title={shown.title}
      description={shown.body}
      primary={{
        label: shown.action,
        danger: shown.danger,
        // The danger label carries its glyph too: colour is never the only cue (§3.8, A-19).
        icon: shown.danger ? (
          shown.glyph === 'revert' ? (
            <RotateCcw aria-hidden="true" />
          ) : (
            <Trash2 aria-hidden="true" />
          )
        ) : undefined,
        onPress: () => answerConfirm(shown.id, true),
      }}
      initialFocus={shown.undoable ? 'primary' : 'cancel'}
      testId="confirm-sheet"
    />
  );
}
