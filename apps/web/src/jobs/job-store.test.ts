/**
 * Background jobs (`08-feedback` FB5 §4, §6; FB10 §5): the 400 ms gate, in place versus the
 * capsule in the toast stack, Cancel ("Stopping…"), and the announcement cadence (start, each
 * 25 % no more often than every 10 s, nothing for a short job).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetAnnouncer, useAnnouncer } from '../shell/announcer';
import { resetToasts, useToastStore } from '../ui/Toast/toast-store';
import {
  cancelJob,
  JOB_GATE_MS,
  JOB_SPEAK_EVERY_MS,
  resetJobs,
  startJob,
  useJobStore,
} from './job-store';

const capsules = () => useToastStore.getState().shown.filter((t) => t.kind === 'progress');
const said = () => useAnnouncer.getState().message;
const tick = () => new Promise<void>((resolve) => queueMicrotask(resolve));

beforeEach(() => {
  vi.useFakeTimers();
  resetToasts();
  resetJobs();
  resetAnnouncer();
});
afterEach(() => {
  resetJobs();
  resetToasts();
  resetAnnouncer();
  vi.useRealTimers();
});

describe('jobs', () => {
  it('shows and says nothing for a job shorter than 400 ms', () => {
    const job = startJob({ label: 'Saving…' });
    vi.advanceTimersByTime(JOB_GATE_MS - 1);
    job.finish();
    vi.advanceTimersByTime(JOB_GATE_MS);
    expect(capsules()).toHaveLength(0);
    expect(useAnnouncer.getState().serial).toBe(0);
  });

  it('puts a capsule in the stack after 400 ms, says the start, and takes it away at the end', () => {
    const job = startJob({ label: 'Recognizing text: 0 of 12 pages', progress: 0 });
    vi.advanceTimersByTime(JOB_GATE_MS);
    expect(capsules()).toHaveLength(1);
    expect(capsules()[0]?.jobId).toBe(job.id);
    expect(said()).toBe('Recognizing text: 0 of 12 pages');
    job.finish();
    expect(capsules()).toHaveLength(0);
    expect(useJobStore.getState().jobs).toEqual({});
  });

  it('stays in place while the starting control shows it, and moves to the stack when it goes', () => {
    const job = startJob({ label: 'Recognizing text: 0 of 12 pages', inPlace: true });
    vi.advanceTimersByTime(JOB_GATE_MS);
    expect(capsules()).toHaveLength(0);
    job.setInPlace(false);
    expect(capsules()).toHaveLength(1);
    job.setInPlace(true);
    expect(capsules()).toHaveLength(0);
  });

  it('says progress at each 25 % step, no more often than every 10 s', async () => {
    const job = startJob({ label: 'Recognizing 0 of 12', progress: 0 });
    vi.advanceTimersByTime(JOB_GATE_MS);
    const start = useAnnouncer.getState().serial;
    await tick();
    job.update({ progress: 30, label: 'Recognizing 4 of 12' });
    // Under 10 s since the start was said: quiet.
    expect(useAnnouncer.getState().serial).toBe(start);
    vi.advanceTimersByTime(JOB_SPEAK_EVERY_MS);
    await tick();
    job.update({ progress: 40, label: 'Recognizing 5 of 12' });
    expect(said()).toBe('Recognizing 5 of 12');
    const quarter = useAnnouncer.getState().serial;
    vi.advanceTimersByTime(JOB_SPEAK_EVERY_MS);
    await tick();
    // Same 25 % step: quiet however long it has been.
    job.update({ progress: 45, label: 'Recognizing 6 of 12' });
    expect(useAnnouncer.getState().serial).toBe(quarter);
    job.update({ progress: 55, label: 'Recognizing 7 of 12' });
    expect(said()).toBe('Recognizing 7 of 12');
  });

  it('cancels: "Stopping…", asked once, and the label stays until the job ends', () => {
    let asked = 0;
    const job = startJob({ label: 'Recognizing 3 of 12', cancel: () => (asked += 1) });
    cancelJob(job.id);
    cancelJob(job.id);
    expect(asked).toBe(1);
    expect(useJobStore.getState().jobs[job.id]).toMatchObject({
      cancelling: true,
      label: 'Stopping…',
    });
    job.update({ label: 'Recognizing 4 of 12', progress: 33 });
    expect(useJobStore.getState().jobs[job.id]?.label).toBe('Stopping…');
  });
});
