/**
 * Undo, Redo and history jumps as the user makes them (01-frame F3 §6, 08-feedback FB7 §6;
 * ADR-0032 §2.8): each moves the workspace history, says what it did ("Undid highlight on
 * page 3", polite) and reveals the change (`reveal.ts`). ↶ ↷, Mod+Z, Mod+Shift+Z, Mod+Y and
 * the History scrubber all come through here.
 *
 * History jumps bypass `commit()`: they are allowed in Read mode and, from D1, while a
 * document is locked (flows.md §2.5 rule 4); the bytes change only as history says, through
 * the edit runner's replay of the engine edits between the two steps.
 */
import { type HistoryEntry, historyEntries } from '@pdf-editor/document-model';

import { undoBurstStroke } from '../annotations/pen/bursts';
import { m } from '../i18n';
import { announce } from '../shell/announcer';
import { useUiStore } from '../state/ui-store';
import { useWorkspaceStore } from '../state/workspace-store';
import { toast } from '../ui/Toast';
import { inOtherDocument, stepPhrase } from './labels';
import { revealStep, type StepChange } from './reveal';

const model = () => useWorkspaceStore.getState();

/**
 * Says and reveals `step` after the history moved over it. A step in another open document
 * is not revealed where the user is looking: a toast names it ("Undid highlight in
 * agreement · Show", flows.md §5.3) and the tabs stay as they are until Show.
 */
function report(step: HistoryEntry, message: (phrase: string) => string, change: StepChange): void {
  const { workspace } = model();
  const text = message(stepPhrase(step, { workspace, fallbacks: [step.workspace] }));
  const id = step.meta?.documentId;
  if (id !== undefined && inOtherDocument(step, workspace)) {
    toast.action(
      text,
      {
        label: m.history_show(),
        run: () => {
          // As a tab click (home-actions' showTab, not imported: it imports the commands).
          if (model().workspace.documents[id] === undefined) return;
          model().setActive(id);
          if (useUiStore.getState().destination === 'home') useUiStore.getState().showDocument(id);
          void revealStep(step.meta, model().workspace);
        },
      },
      { documentId: id, key: 'history-other-document' },
    );
    return;
  }
  announce(text);
  void revealStep(step.meta, workspace, change);
}

/**
 * One step back. Inside an open pen burst, its last stroke only (pen spec §6.4), as Mod+Z.
 * Returns whether anything was undone.
 */
export function undoStep(): boolean {
  if (undoBurstStroke()) return true;
  const step = model().history.present;
  const before = model().workspace;
  if (model().undo() === undefined) return false;
  report(step, (label) => m.announce_undid({ label }), { before, direction: 'undo' });
  return true;
}

/** One step forward. Returns whether anything was redone. */
export function redoStep(): boolean {
  const step = model().history.future[0];
  const before = model().workspace;
  if (step === undefined || model().redo() === undefined) return false;
  report(step, (label) => m.announce_redid({ label }), { before, direction: 'redo' });
  return true;
}

/**
 * Moves the history to entry `index` of `historyEntries` without saying anything (the
 * scrubber's preview). Returns whether the history moved.
 */
export function previewStep(index: number): boolean {
  const before = model().history;
  model().jumpTo(index);
  return model().history !== before;
}

/**
 * Keeps entry `index` (FB7 §6): moves there if the preview has not, announces "Now at step
 * 12 of 20: pen on page 4" and reveals the change between `from` (the step the scrubber
 * opened at) and `index`: going back, the first step undone; going forward, the step reached.
 */
export function keepStep(index: number, from: number): void {
  previewStep(index);
  const { history, workspace } = model();
  const entries = [...history.past, history.present, ...history.future];
  const target = entries[index];
  if (target === undefined) return;
  const count = historyEntries(history).length;
  announce(
    m.announce_history_jump({
      index: index + 1,
      count,
      step: stepPhrase(target, { workspace, fallbacks: [target.workspace] }),
    }),
  );
  if (index === from) return;
  const changed = index < from ? entries[index + 1] : target;
  const before = entries[from]?.workspace;
  void revealStep(
    changed?.meta,
    workspace,
    before === undefined ? undefined : { before, direction: index < from ? 'undo' : 'redo' },
  );
}
