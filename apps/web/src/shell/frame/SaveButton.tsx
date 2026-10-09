/**
 * Save (01-frame F7; ADR-0032 §2.1; spec redesign D0-8): a neutral capsule in today's title bar
 * (D2 moves it to the top strip), never lime.
 *
 * - **Save** while the active document has changes that are not in its file (the saved mark,
 *   `state/saved-store.ts`): a standard fill.
 * - **Saved** when nothing is new: no fill, the secondary label, `aria-disabled` and still
 *   focusable, its reason "Everything is in report.pdf" as the description and tooltip. "Save"
 *   and "Saved" share one width (the labels are stacked), so the bar never reflows between them.
 * - **Saving… 40 %** while the save runs: the button is the progress (FB5 "in place"; the
 *   capsule takes over when the button is not on screen), with the processing ring on its
 *   border, after the 400 ms gate; it shows "40 %" at the pill's one width (system-audit-2026-10
 *   §4 Frame: an M button whose width never changes), and is named "Saving… 40 %". A press
 *   meanwhile is queued once.
 * - After a verified save the label returns to "Saved" with a check that pops and a bloom on
 *   the rim, once (FB6); the toast says "Saved · verified" over the save receipt (PLAN.md
 *   E13-u), which "Saved" keeps in its reason: "Everything is in report.pdf · Saved on this
 *   device", or "… · 3 areas removed · 0 matches remain".
 *
 * Motion (motion-2026-10 frame.md §5): while saving a light sweeps across the capsule (the
 * shimmer, over the ring); after a verified save the check draws in from its leading end,
 * holds `CHECK_HOLD_MS`, and the label settles to "Saved" with the cross-fade every label
 * change has. The receipt toast comes from Save's side (`origin`, `files/save.ts`).
 *
 * The questions a save asks (unapplied marks, Replace) are `ReplacePopover`, anchored here.
 */
import { useEffect, useId, useState } from 'react';

import { currentPlatform, parseShortcut, toAriaKeyShortcut } from '../../commands/shortcuts';
import { saveDocument, saveNameFor, setSaveButtonShown, useSaveStore } from '../../files/save';
import { formatPercent, m } from '../../i18n';
import { useJobStore } from '../../jobs/job-store';
import { useInFile } from '../../state/saved-store';
import { useWorkspaceStore } from '../../state/workspace-store';
import { Activity } from '../../ui/Activity';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Tooltip } from '../../ui/Tooltip';
import { useCommandShortcut } from '../use-command-shortcut';
import styles from './SaveButton.module.css';

export const SAVE_BUTTON_ID = 'save-button';

/** Mod+S, as `file.save` registers it (files/save-commands.ts). */
const SAVE_SHORTCUT = parseShortcut('Mod+S');

/**
 * How long "Saved ✓" holds its check after a verified save before it settles to "Saved"
 * (motion-2026-10 frame.md §5): the check has drawn in (`--spring-quick`) and been read.
 */
export const CHECK_HOLD_MS = 1600;

export type SaveButtonState = 'save' | 'saved' | 'saving';

/** What Save shows (unit-tested): saving wins, then the saved mark. */
export function saveButtonState(options: {
  readonly inFile: boolean;
  readonly saving: boolean;
}): SaveButtonState {
  if (options.saving) return 'saving';
  return options.inFile ? 'saved' : 'save';
}

export function SaveButton() {
  const id = useWorkspaceStore((s) => s.workspace.activeDocument ?? null);
  const name = useWorkspaceStore((s) => (id === null ? '' : saveNameFor(id, s.workspace)));
  const inFile = useInFile(id);
  const jobId = useSaveStore((s) => (id === null ? undefined : s.jobs[id]));
  const job = useJobStore((s) => (jobId === undefined ? undefined : s.jobs[jobId]));
  const verifiedAt = useSaveStore((s) => (id === null ? undefined : s.verifiedAt[id]));
  const receipt = useSaveStore((s) => (id === null ? undefined : s.receipts[id]));
  const shortcut = useCommandShortcut('file.save') ?? SAVE_SHORTCUT;
  const reasonId = useId();
  // The verified save whose check has been shown and settled back to "Saved".
  const [settled, setSettled] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (verifiedAt === undefined) return undefined;
    const timer = window.setTimeout(() => setSettled(verifiedAt), CHECK_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [verifiedAt]);

  // The job shows here while this button is on screen (FB5 §4).
  useEffect(() => {
    setSaveButtonShown(true);
    return () => setSaveButtonShown(false);
  }, []);

  if (id === null) return null;
  // Saving shows only past the job's 400 ms gate (MC-33); a quick save changes nothing on screen.
  const state = saveButtonState({ inFile, saving: job?.visible === true });
  const percent =
    job?.progress === null || job?.progress === undefined
      ? undefined
      : Math.round(Math.min(100, Math.max(0, job.progress)));
  const savingLabel =
    percent === undefined
      ? m.save_label_saving_plain()
      : m.save_label_saving({ percent: formatPercent(percent / 100) });
  const verified = state === 'saved' && verifiedAt !== undefined && settled !== verifiedAt;
  const keys = toAriaKeyShortcut(shortcut, currentPlatform);

  // Each label is always in the cell; the one shown fades in over the one leaving, which fades
  // out behind it (an overlapping cross-fade: the two are never both clear). A label not shown
  // is out of the accessible name from the first frame.
  const label = (shown: boolean) =>
    ({
      className: styles.label,
      'data-shown': shown || undefined,
      'aria-hidden': shown ? undefined : true,
    }) as const;
  const labels = (
    <span className={styles.labels} data-state={state}>
      <span {...label(state === 'save')}>{m.save_label()}</span>
      {/* "Saved" and "Saved ✓" are one label, so the word never cross-fades with itself: the
          check hangs after it, the pair centred by a half-check shift while it shows; settling,
          the check fades and the word slides back to the centre (frame.md §5). */}
      <span {...label(state === 'saved')} data-check={verified || undefined}>
        <span className={styles.saved}>
          {m.save_label_saved()}
          <Icon name="check" className={styles.check} />
        </span>
      </span>
      {/* While saving the pill keeps its width (system-audit-2026-10 §4 Frame: the piece never
          resizes): the percentage alone, or the activity glyph before the first one, in the
          cell's room, which the widest percentage reserves below; the words stay for
          assistive technology. Once done it reads "100 %" while it fades out under "Saved". */}
      <span {...label(state === 'saving')}>
        {state !== 'saving' ? (
          <span aria-hidden="true">{formatPercent(1)}</span>
        ) : percent === undefined ? (
          <Activity delay={0} size="sm" />
        ) : (
          <span aria-hidden="true">{formatPercent(percent / 100)}</span>
        )}
        {state === 'saving' ? <span className="visually-hidden">{savingLabel}</span> : null}
      </span>
      <span className={styles.label} aria-hidden="true">
        {formatPercent(1)}
      </span>
      {/* The cell's room for "Saved ✓", which the label above draws centred over it. */}
      <span className={styles.label} aria-hidden="true">
        {m.save_label_saved()}
        <span className={styles.checkRoom} />
      </span>
    </span>
  );

  // "Saved" says why, then what the last save proved (the receipt, E13-u).
  const reason =
    state === 'saved'
      ? [m.save_everything_in({ name }), receipt].filter(Boolean).join(' · ')
      : undefined;
  return (
    <span className={styles.wrap}>
      {/* One tree in every state, so focus stays on Save while it turns into "Saved" (F7 §6).
          "Saved" is aria-disabled but pressable: a press says why, as Mod+S does. */}
      <Tooltip
        label={reason ?? (state === 'saving' ? savingLabel : m.save_label())}
        shortcut={shortcut}
      >
        <Button
          id={SAVE_BUTTON_ID}
          variant={state === 'saved' ? 'quiet' : 'standard'}
          className={styles.save}
          data-state={state}
          data-testid="save-button"
          aria-keyshortcuts={keys}
          aria-busy={state === 'saving' || undefined}
          aria-disabled={state === 'saved' || undefined}
          aria-describedby={reasonId}
          onClick={() => void saveDocument(id)}
        >
          {labels}
        </Button>
      </Tooltip>
      <span id={reasonId} className="visually-hidden">
        {reason}
      </span>
      {state === 'saving' ? <span className={styles.ring} aria-hidden="true" /> : null}
      {state === 'saving' ? <span className={styles.shimmer} aria-hidden="true" /> : null}
      {verified ? <span key={verifiedAt} className={styles.bloom} aria-hidden="true" /> : null}
    </span>
  );
}
