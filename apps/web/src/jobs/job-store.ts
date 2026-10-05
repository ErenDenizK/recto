/**
 * Background jobs (`08-feedback` FB5 §2, §4, §6, §9; language.md §8, F-12): work that takes
 * longer than 400 ms runs without blocking and shows where it is, once.
 *
 * A runner (OCR today; Save, Save a copy, Combine, compress, restore and batch as their
 * packages move onto it) calls `startJob()` and reports through the handle. The store decides
 * where the job shows:
 *
 * - **Nothing for 400 ms** (X-4, MC-33): a job that ends sooner shows and says nothing but its
 *   result.
 * - **In place** while the starting control is on screen (`inPlace`: a sheet's primary button,
 *   the OCR dialog's progress), else **a progress capsule in the toast stack**
 *   (`ui/Toast/ProgressCapsule.tsx`), one per job. Moving in and out of place (the OCR dialog
 *   closes) moves it between the two.
 * - **Cancel** stops at the runner's next safe point: the label reads "Stopping…" and Cancel
 *   is disabled until the runner finishes the job.
 * - **Spoken** (FB10 §5): the start (once the 400 ms gate passes), then each 25 % step no more
 *   often than every 10 s, keyed per job; the end is the runner's result toast.
 *
 * When the job finishes its capsule leaves; the runner shows the success or failure toast
 * (FB6), which says the outcome.
 */
import type { DocumentId } from '@pdf-editor/document-model';
import { create } from 'zustand';

import { m } from '../i18n';
import { announce } from '../shell/announcer';
import { dismissToast, pushToast } from '../ui/Toast/toast-store';

export interface Job {
  readonly id: string;
  /** "Recognizing text… 3 of 12 pages": a verb with an ellipsis, the count after it. */
  readonly label: string;
  /** 0–100, or null while the amount of work is unknown (indeterminate). */
  readonly progress: number | null;
  /** The document it works on: named in the capsule when it is not the active one. */
  readonly documentId?: DocumentId | undefined;
  /** Stops the job at its next safe point; absent when it cannot be stopped. */
  readonly cancel?: (() => void) | undefined;
  readonly cancelling: boolean;
  /** Opens the job's own surface (the OCR dialog) from the capsule body. */
  readonly open?: (() => void) | undefined;
  /** The starting control shows the progress itself. */
  readonly inPlace: boolean;
  /** Past the 400 ms gate. */
  readonly visible: boolean;
}

export interface JobOptions {
  readonly label: string;
  readonly progress?: number | null;
  readonly documentId?: DocumentId | undefined;
  readonly cancel?: (() => void) | undefined;
  readonly open?: (() => void) | undefined;
  readonly inPlace?: boolean;
}

export interface JobHandle {
  readonly id: string;
  /** New progress (and label); never moves backwards in what is spoken. */
  update(patch: { readonly progress?: number | null; readonly label?: string }): void;
  /** The starting control shows (true) or no longer shows (false) the progress. */
  setInPlace(inPlace: boolean): void;
  /** The job ended (done, failed or stopped); its capsule leaves. */
  finish(): void;
}

/** FB5 §4: nothing shows for a job shorter than this. */
export const JOB_GATE_MS = 400;
/** FB10 §5: progress is spoken at most this often. */
export const JOB_SPEAK_EVERY_MS = 10_000;

interface JobState {
  readonly jobs: Readonly<Record<string, Job>>;
}

export const useJobStore = create<JobState>()(() => ({ jobs: {} }));

/** Per job: the gate timer, its capsule toast, and what was last said. */
interface Runtime {
  gate: ReturnType<typeof setTimeout> | undefined;
  toast: string | undefined;
  spokenAt: number;
  spokenStep: number;
}

const runtimes = new Map<string, Runtime>();
let serial = 0;

const jobOf = (id: string) => useJobStore.getState().jobs[id];

function setJob(id: string, patch: Partial<Job>): void {
  const job = jobOf(id);
  if (!job) return;
  useJobStore.setState((s) => ({ jobs: { ...s.jobs, [id]: { ...job, ...patch } } }));
}

/** The capsule is in the stack exactly while the job is visible and not in place. */
function placeCapsule(id: string): void {
  const job = jobOf(id);
  const rt = runtimes.get(id);
  if (!rt) return;
  const wanted = job !== undefined && job.visible && !job.inPlace;
  if (wanted && rt.toast === undefined) {
    rt.toast = pushToast({
      kind: 'progress',
      text: job.label,
      jobId: id,
      documentId: job.documentId,
      keepOnClose: true,
      testId: 'progress-capsule',
    });
  } else if (!wanted && rt.toast !== undefined) {
    const toast = rt.toast;
    rt.toast = undefined;
    dismissToast(toast, 'closed');
  }
}

/** Says the job's progress when it crosses a 25 % step and 10 s have passed (FB10 §5). */
function speakProgress(id: string): void {
  const job = jobOf(id);
  const rt = runtimes.get(id);
  if (!job || !rt || !job.visible || job.progress === null) return;
  const step = Math.floor(job.progress / 25);
  if (step <= rt.spokenStep || step >= 4) return;
  if (Date.now() - rt.spokenAt < JOB_SPEAK_EVERY_MS) return;
  rt.spokenStep = step;
  rt.spokenAt = Date.now();
  announce(job.label, { key: `job:${id}` });
}

/** Starts tracking a job; see the module comment for where it shows. */
export function startJob(options: JobOptions): JobHandle {
  serial += 1;
  const id = `job-${serial}`;
  const job: Job = {
    id,
    label: options.label,
    progress: options.progress ?? null,
    documentId: options.documentId,
    cancel: options.cancel,
    open: options.open,
    cancelling: false,
    inPlace: options.inPlace ?? false,
    visible: false,
  };
  useJobStore.setState((s) => ({ jobs: { ...s.jobs, [id]: job } }));
  const rt: Runtime = { gate: undefined, toast: undefined, spokenAt: 0, spokenStep: 0 };
  runtimes.set(id, rt);
  rt.gate = setTimeout(() => {
    rt.gate = undefined;
    setJob(id, { visible: true });
    const now = jobOf(id);
    if (now) {
      rt.spokenAt = Date.now();
      rt.spokenStep = now.progress === null ? 0 : Math.floor(now.progress / 25);
      announce(now.label, { key: `job:${id}` });
    }
    placeCapsule(id);
  }, JOB_GATE_MS);
  return {
    id,
    update(patch) {
      const current = jobOf(id);
      if (!current) return;
      setJob(id, {
        ...(patch.progress === undefined ? {} : { progress: patch.progress }),
        // A stopping job keeps saying so.
        ...(patch.label === undefined || current.cancelling ? {} : { label: patch.label }),
      });
      speakProgress(id);
    },
    setInPlace(inPlace) {
      if (jobOf(id)?.inPlace === inPlace) return;
      setJob(id, { inPlace });
      placeCapsule(id);
    },
    finish() {
      finishJob(id);
    },
  };
}

/** Ends a job: the gate is cancelled and its capsule leaves. */
export function finishJob(id: string): void {
  const rt = runtimes.get(id);
  if (rt?.gate !== undefined) clearTimeout(rt.gate);
  if (rt?.toast !== undefined) dismissToast(rt.toast, 'closed');
  runtimes.delete(id);
  if (!jobOf(id)) return;
  useJobStore.setState((s) => {
    const { [id]: _gone, ...jobs } = s.jobs;
    return { jobs };
  });
}

/** Cancel: "Stopping…", Cancel disabled, and the runner asked to stop (FB5 §4, §6). */
export function cancelJob(id: string): void {
  const job = jobOf(id);
  if (!job?.cancel || job.cancelling) return;
  setJob(id, { cancelling: true, label: m.job_stopping() });
  job.cancel();
}

/** Forgets every job (tests). */
export function resetJobs(): void {
  for (const id of [...runtimes.keys()]) finishJob(id);
  useJobStore.setState({ jobs: {} });
}
