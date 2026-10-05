/**
 * The History scrubber's preview (08-feedback FB7 §6): moving through the list or along the
 * slider shows each step on the page, throttled, and the step the scrubber opened at comes
 * back on Esc, a press outside or Cancel.
 *
 * - At most one history jump per `PREVIEW_INTERVAL_MS` (100 ms); the latest asked-for step
 *   wins, so a held arrow key or a fast drag ends on the step it stopped at.
 * - A preview that crosses an engine edit undone by reopening and replaying (a text or
 *   paragraph edit, OCR, applied redaction, a removed or replaced image) waits for the keep:
 *   replaying engine inverses per frame is too slow (FB7 §6, judgement).
 */
import type { EngineEdit, History } from '@pdf-editor/document-model';

export const PREVIEW_INTERVAL_MS = 100;

/** Engine edits whose undo reopens the source and replays (edit-runner.ts). */
const REPLAYED: ReadonlySet<EngineEdit['kind']> = new Set([
  'text.edit',
  'text.editParagraph',
  'ocr.apply',
  'redaction.apply',
  'image.remove',
  'image.replace',
]);

/** Whether moving between entries `from` and `to` (of `historyEntries`) replays the engine. */
export function crossesReplay(history: History, from: number, to: number): boolean {
  const entries = [...history.past, history.present, ...history.future];
  const a = entries[from]?.workspace.engineEdits ?? [];
  const b = entries[to]?.workspace.engineEdits ?? [];
  let shared = 0;
  while (shared < a.length && shared < b.length && a[shared] === b[shared]) shared++;
  const crossed = [...a.slice(shared), ...b.slice(shared)];
  return crossed.some((edit) => REPLAYED.has(edit.kind));
}

export interface PreviewOptions {
  /** The entry shown when the scrubber opened. */
  readonly start: number;
  /** Shows entry `index` (a history jump). */
  readonly show: (index: number) => void;
  /** Whether showing `to` from `from` must wait for the keep (`crossesReplay`). */
  readonly waits?: ((from: number, to: number) => boolean) | undefined;
  readonly now?: (() => number) | undefined;
}

export interface PreviewSession {
  /** The entry on the page now. */
  readonly shown: number;
  /** Asks to show `index`; applied now or at the end of the interval. */
  preview(index: number): void;
  /** Drops a waiting preview (before a keep or a cancel). */
  flush(): void;
  /** Shows the start entry again (Esc, outside press, Cancel). */
  restore(): void;
}

export function createPreviewSession(options: PreviewOptions): PreviewSession {
  const now = options.now ?? (() => performance.now());
  let shown = options.start;
  let lastAt = Number.NEGATIVE_INFINITY;
  let pending: number | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const apply = (index: number) => {
    pending = null;
    if (index === shown) return;
    if (options.waits?.(shown, index)) return;
    lastAt = now();
    shown = index;
    options.show(index);
  };

  const cancelTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  return {
    get shown() {
      return shown;
    },
    preview(index) {
      const wait = lastAt + PREVIEW_INTERVAL_MS - now();
      if (wait <= 0 && timer === null) {
        apply(index);
        return;
      }
      pending = index;
      timer ??= setTimeout(
        () => {
          timer = null;
          if (pending !== null) apply(pending);
        },
        Math.max(0, wait),
      );
    },
    flush() {
      cancelTimer();
      pending = null;
    },
    restore() {
      cancelTimer();
      pending = null;
      if (shown === options.start) return;
      shown = options.start;
      options.show(options.start);
    },
  };
}
