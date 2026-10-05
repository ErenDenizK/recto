/**
 * The progress capsule (`08-feedback` FB5): a job from `jobs/job-store.ts` in the toast stack,
 * when its starting control is not on screen. "Recognizing text… 3 of 12 pages  25 %  Cancel",
 * and for a job in a background document "agreement · Recognizing text… 3 of 12 pages".
 *
 * - Determinate: percentage (tabular, the locale places the sign) and a 2 px track filled by
 *   `scaleX` in 200 ms (*progress*); indeterminate: no percentage, no track.
 * - The processing ring turns on the border while the job runs (CSS only; a still rim under
 *   reduced motion, Reduce transparency, forced colours).
 * - Cancel stops at the job's next safe point: "Stopping…", Cancel disabled.
 * - The body opens the job's own surface where it has one (the OCR dialog).
 * - `role="progressbar"` with the label as its value text (FB5 §8); the ring is hidden.
 *
 * The toast around it (glass, stack place, F6) is `ToastRegion`'s; the job's start and
 * progress are spoken by the job store, never by this view.
 */
import { formatPercent, m } from '../../i18n';
import { cancelJob, useJobStore } from '../../jobs/job-store';
import { useWorkspaceStore } from '../../state/workspace-store';
import { Button } from '../Button';
import styles from './Toast.module.css';

export function ProgressCapsule({ jobId }: { readonly jobId: string }) {
  const job = useJobStore((s) => s.jobs[jobId]);
  const background = useWorkspaceStore((s) => {
    const id = job?.documentId;
    if (id === undefined || s.workspace.activeDocument === id) return undefined;
    return s.workspace.documents[id]?.title;
  });
  if (!job) return null;
  const label =
    background === undefined
      ? job.label
      : m.job_in_document({ name: background, label: job.label });
  const percent =
    job.progress === null ? null : Math.round(Math.min(100, Math.max(0, job.progress)));
  const open = job.open;
  return (
    <>
      <span className={styles.ring} aria-hidden="true" />
      {/* The body opens the job's surface for a pointer (FB5 §6); keyboards reach that surface
          through its own command, so the body is not a second Tab stop beside Cancel. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/interactive-supports-focus */}
      <div
        className={styles.capsule}
        data-opens={open ? '' : undefined}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? undefined}
        aria-valuetext={label}
        onClick={open}
      >
        <span className={styles.meter}>
          <span className={styles.line}>
            <span className={styles.label}>{label}</span>
            {percent === null ? null : (
              <span className={styles.percent}>{formatPercent(percent / 100)}</span>
            )}
          </span>
          {percent === null ? null : (
            <span className={styles.track}>
              <span className={styles.fill} style={{ transform: `scaleX(${percent / 100})` }} />
            </span>
          )}
        </span>
      </div>
      {job.cancel ? (
        <span className={styles.actions}>
          <Button
            variant="standard"
            className={styles.action}
            disabled={job.cancelling}
            reason={job.cancelling ? m.job_stopping() : undefined}
            onClick={() => cancelJob(jobId)}
          >
            {m.job_cancel()}
          </Button>
        </span>
      ) : null}
    </>
  );
}
