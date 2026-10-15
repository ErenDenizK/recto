/**
 * The lab's one animation loop: it runs only while a task asks for frames (a drag, a spring, the
 * auto-scroll), so a lab at rest draws nothing (MOT-4), and the frame meter counts real frames.
 */
import { FrameMeter } from './meter';

/** A task returns true while it wants another frame. */
export type Task = (dt: number, now: number) => boolean;

const tasks = new Set<Task>();
const afterFrame = new Set<() => void>();
export const meter = new FrameMeter();
let frame = 0;
let last = 0;

function run(now: number): void {
  frame = 0;
  const dt = last === 0 ? 1 / 60 : Math.min(0.064, (now - last) / 1000);
  last = now;
  meter.tick(now);
  for (const task of [...tasks]) {
    if (!task(dt, now)) tasks.delete(task);
  }
  for (const fn of afterFrame) fn();
  if (tasks.size > 0) {
    frame = requestAnimationFrame(run);
  } else {
    last = 0;
    meter.pause();
  }
}

export function addTask(task: Task): void {
  tasks.add(task);
  if (frame === 0) frame = requestAnimationFrame(run);
}

export function removeTask(task: Task): void {
  tasks.delete(task);
}

/** Called after the tasks of every frame the loop runs (renderers redraw here). */
export function onFrame(fn: () => void): void {
  afterFrame.add(fn);
}
