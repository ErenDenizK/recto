/**
 * Live-region announcements (DESIGN.md §5, experience-redesign §10; `08-feedback` FB10, A-14):
 * opened files, closed tabs, mode changes, the tool bar's group, the armed preset, a closed
 * burst, a lasso count, and every toast (toasts never speak themselves; `ui/Toast/toast.ts`
 * says each one once, here). The `LiveRegion` component renders the latest message of each
 * politeness.
 *
 * Messages said in the same task are joined, in order and once each, so a change that
 * causes another (a tool change closes a burst: "Pen: 5 strokes on page 1. Lasso tool") is
 * said whole rather than the last word only. A message with a `key` replaces an earlier
 * one with the same key in that task: the armed preset ("Blue pen, 1.5 pt") says what the
 * generic tool name ("Pen tool") would, so only the preset is said.
 *
 * FB10 §6 adds three timing rules:
 * - **Key window.** A keyed message said within 250 ms of the last one of its key (in a later
 *   task) replaces it in place: the live region's text changes without a new announcement
 *   node, so a key held down or a burst of progress reads as one changing message rather
 *   than a queue of them. It is written at once, so what is said never lags the screen.
 * - **Debounce.** `debounceMs` holds a keyed message until that long after the last call with
 *   its key (the palette's result count, 500 ms after the last key press); the newest wins.
 * - **Clear.** Polite text clears 10 s after it was said, so a later identical message is a
 *   change the screen reader reads again.
 *
 * Polite by default; `assertive` is only for the three blocking failures of FB8 §6 (storage
 * full, the engine stopped, a stroke that could not be saved).
 */
import { create } from 'zustand';

export type Politeness = 'polite' | 'assertive';

interface AnnouncerState {
  /** The polite message (`role="status"`). */
  message: string;
  /** Bumped per announcement so repeating the same text is re-announced. */
  serial: number;
  /** The assertive message (`aria-live="assertive"`). */
  alert: string;
  alertSerial: number;
}

export interface AnnounceOptions {
  readonly politeness?: Politeness;
  /** Replaces an earlier message with this key said in the same task or the key window. */
  readonly key?: string;
  /** Holds a keyed message until this long after the last call with its key (FB10 §6). */
  readonly debounceMs?: number;
}

/** FB10 §6: a keyed message within this long of the last of its key replaces it. */
export const KEY_WINDOW_MS = 250;
/** FB10 §6: polite text clears this long after it was said. */
export const CLEAR_AFTER_MS = 10_000;

export const useAnnouncer = create<AnnouncerState>()(() => ({
  message: '',
  serial: 0,
  alert: '',
  alertSerial: 0,
}));

interface Said {
  readonly key: string | undefined;
  readonly text: string;
}

/** What has been said in the current task, per politeness; cleared in a microtask. */
const batches: Record<Politeness, Said[] | null> = { polite: null, assertive: null };

/** When each key was last said, per politeness (the key window). */
const lastSaid: Record<Politeness, Map<string, number>> = {
  polite: new Map(),
  assertive: new Map(),
};

/** The key of the message each channel said last (the key window replaces only that one). */
const lastKey: Record<Politeness, string | undefined> = { polite: undefined, assertive: undefined };

/** Keyed messages waiting for their debounce, by politeness and key. */
const held = new Map<string, { timer: ReturnType<typeof setTimeout>; text: string }>();

let clearTimer: ReturnType<typeof setTimeout> | undefined;

function joined(items: readonly Said[]): string {
  return items
    .map((item, i) =>
      i === items.length - 1 || /[.!?…:]$/.test(item.text) ? item.text : `${item.text}.`,
    )
    .join(' ');
}

/** Puts `message` in this task's batch of `politeness` and writes the joined text. */
function say(
  message: string,
  politeness: Politeness,
  key: string | undefined,
  inPlace = false,
): void {
  let batch = batches[politeness];
  if (batch === null) {
    batch = [];
    batches[politeness] = batch;
    queueMicrotask(() => {
      batches[politeness] = null;
    });
  }
  if (key !== undefined) lastSaid[politeness].set(key, Date.now());
  lastKey[politeness] = key;
  const replaced = key === undefined ? -1 : batch.findIndex((item) => item.key === key);
  if (replaced >= 0) batch.splice(replaced, 1);
  // Said once: the same words again in the same task add nothing.
  if (!batch.some((item) => item.text === message)) batch.push({ key, text: message });
  const text = joined(batch);
  // In place (the key window): the same announcement node takes the new words.
  const bump = inPlace ? 0 : 1;
  if (politeness === 'assertive') {
    useAnnouncer.setState((s) => ({ alert: text, alertSerial: s.alertSerial + bump }));
    return;
  }
  useAnnouncer.setState((s) => ({ message: text, serial: s.serial + bump }));
  if (clearTimer !== undefined) clearTimeout(clearTimer);
  const serial = useAnnouncer.getState().serial;
  clearTimer = setTimeout(() => {
    clearTimer = undefined;
    // Only what is still the latest message clears.
    if (useAnnouncer.getState().serial === serial) useAnnouncer.setState({ message: '' });
  }, CLEAR_AFTER_MS);
}

export function announce(message: string, options: AnnounceOptions = {}): void {
  const politeness = options.politeness ?? 'polite';
  const key = options.key;
  if (key === undefined) {
    say(message, politeness, undefined);
    return;
  }
  const slot = `${politeness}:${key}`;
  const pending = held.get(slot);
  if (pending !== undefined) clearTimeout(pending.timer);
  held.delete(slot);
  const debounce = options.debounceMs ?? 0;
  if (debounce > 0) {
    held.set(slot, {
      text: message,
      timer: setTimeout(() => {
        held.delete(slot);
        sayKeyed(message, politeness, key);
      }, debounce),
    });
    return;
  }
  sayKeyed(message, politeness, key);
}

/** A keyed message: in place when the last of its key was said within the window. */
function sayKeyed(message: string, politeness: Politeness, key: string): void {
  // In the same task the batch replaces by key already.
  const inTask = batches[politeness]?.some((item) => item.key === key) === true;
  const since = Date.now() - (lastSaid[politeness].get(key) ?? Number.NEGATIVE_INFINITY);
  const latestIsKey = lastKey[politeness] === key;
  say(message, politeness, key, !inTask && latestIsKey && since < KEY_WINDOW_MS);
}

/** Forgets every held message, key time and the clear timer (tests). */
export function resetAnnouncer(): void {
  for (const { timer } of held.values()) clearTimeout(timer);
  held.clear();
  lastSaid.polite.clear();
  lastSaid.assertive.clear();
  lastKey.polite = undefined;
  lastKey.assertive = undefined;
  if (clearTimer !== undefined) clearTimeout(clearTimer);
  clearTimer = undefined;
  batches.polite = null;
  batches.assertive = null;
  useAnnouncer.setState({ message: '', serial: 0, alert: '', alertSerial: 0 });
}
