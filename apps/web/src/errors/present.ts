/**
 * Error presentation (`08-feedback` FB8; inventory INV-6; language.md §8): say what went
 * wrong and what to do, where it happened, calmly, in EN and TR.
 *
 * `describeFailure()` turns an engine or file failure into one sentence in FB8 §5's pattern,
 * "Could not {verb} {object}: {reason}.", with at most one next step. `presentError()` picks
 * the place in FB8 §2's order:
 *
 * 1. **inline at the cause** when the caller has the cause on screen (a field, a sheet, a
 *    row): it passes `inline`, which receives the sentence;
 * 2. else **a failure toast**, until dismissed (`ui/Toast`), which also says it once;
 * 3. a dialog only when the person must choose before anything continues, which is the
 *    caller's (password, Replace), never for a plain failure.
 *
 * Failures are polite except the blocking three (FB8 §6): storage full, the engine stopped,
 * and a stroke that could not be saved. Focus never moves to an error. Many failures from one
 * action become one toast (`presentOpenFailures`): the damaged-file toast closes INV-6, where
 * a corrupt or skipped file showed nothing on screen.
 */
import type { EngineFailure } from '../engine/engine-service';
import { m } from '../i18n';
import type { Politeness } from '../shell/announcer';
import { toast } from '../ui/Toast/toast';
import type { ToastAction } from '../ui/Toast/toast-store';

/** What went wrong, in the terms the person knows. */
export type Failure =
  /** A file did not open; `retry` opens it again (a skipped password asks again). */
  | {
      readonly kind: 'open';
      readonly name: string;
      readonly error: EngineFailure;
      readonly retry?: (() => void) | undefined;
    }
  /** A dropped or picked file that is not a PDF or a supported image. */
  | { readonly kind: 'not-openable'; readonly name: string }
  /** Snapshots can no longer be written (ADR-0032 §2.4). */
  | { readonly kind: 'storage-full'; readonly manage?: (() => void) | undefined }
  /** The engine worker died; only a reload brings it back. */
  | { readonly kind: 'engine-stopped' }
  /** An action of the app that failed, already worded by its owner. */
  | {
      readonly kind: 'message';
      readonly text: string;
      readonly blocking?: boolean;
      readonly action?: ToastAction | undefined;
    };

export interface FailureCopy {
  readonly text: string;
  readonly action?: ToastAction | undefined;
  /** Said instead of `text` when it differs (the engine's "Reload to continue"). */
  readonly spoken?: string | undefined;
  readonly politeness: Politeness;
  /** `warning` for what can be put right by the person (a password), else `danger`. */
  readonly tone: 'danger' | 'warning';
}

/** The reason clause of an engine failure ("the file is damaged"); existing `failure_*`. */
export function failureReason(error: EngineFailure): string {
  switch (error.code) {
    case 'password-cancelled':
    case 'password-required':
    case 'password-incorrect':
      return m.failure_no_password();
    case 'unsupported-encryption':
      return m.failure_unsupported_encryption();
    case 'corrupt':
      return m.failure_corrupt();
    case 'read-failed':
      return m.failure_read_failed();
    case 'unsupported':
      return m.failure_unsupported();
    case 'out-of-memory':
      return m.failure_out_of_memory();
    case 'aborted':
    case 'internal':
      return m.failure_engine();
  }
}

const isPassword = (error: EngineFailure) =>
  error.code === 'password-cancelled' ||
  error.code === 'password-required' ||
  error.code === 'password-incorrect';

/** The words and the next step for `failure` (FB8 §5). */
export function describeFailure(failure: Failure): FailureCopy {
  switch (failure.kind) {
    case 'open': {
      const { name, error, retry } = failure;
      if (isPassword(error)) {
        return {
          text: m.error_password_skipped({ name }),
          action: retry ? { label: m.error_enter_password(), run: retry } : undefined,
          politeness: 'polite',
          tone: 'warning',
        };
      }
      const text =
        error.code === 'corrupt'
          ? m.error_open_damaged({ name })
          : m.error_open({ name, reason: failureReason(error) });
      // A read that failed or ran out of memory may work a second time; damage does not.
      const transient = error.code === 'read-failed' || error.code === 'out-of-memory';
      return {
        text,
        action: transient && retry ? { label: m.error_try_again(), run: retry } : undefined,
        politeness: 'polite',
        tone: 'danger',
      };
    }
    case 'not-openable':
      return {
        text: m.error_not_openable({ name: failure.name }),
        politeness: 'polite',
        tone: 'danger',
      };
    case 'storage-full':
      return {
        text: m.error_storage_full(),
        action: failure.manage
          ? { label: m.error_manage_storage(), run: failure.manage }
          : undefined,
        politeness: 'assertive',
        tone: 'warning',
      };
    case 'engine-stopped':
      return {
        text: m.error_engine_stopped(),
        spoken: m.error_engine_stopped_spoken(),
        action: { label: m.error_reload(), run: () => location.reload() },
        politeness: 'assertive',
        tone: 'danger',
      };
    case 'message':
      return {
        text: failure.text,
        action: failure.action,
        politeness: failure.blocking ? 'assertive' : 'polite',
        tone: 'danger',
      };
  }
}

export interface PresentContext {
  /** The cause is on screen: show the sentence there instead of a toast. */
  readonly inline?: ((text: string) => void) | undefined;
  /** Replaces an earlier toast of the same failure (a retry that fails again). */
  readonly key?: string | undefined;
  readonly testId?: string | undefined;
}

/** Shows `failure` in its place (FB8 §2); returns where it went. */
export function presentError(failure: Failure, context: PresentContext = {}): 'inline' | 'toast' {
  const copy = describeFailure(failure);
  if (context.inline) {
    context.inline(copy.text);
    return 'inline';
  }
  toast.failure(copy.text, {
    action: copy.action,
    tone: copy.tone,
    spoken: copy.spoken,
    politeness: copy.politeness,
    key: context.key,
    testId: context.testId ?? 'failure-toast',
  });
  return 'toast';
}

export interface OpenFailure {
  readonly name: string;
  readonly error: EngineFailure;
  readonly retry?: (() => void) | undefined;
}

/**
 * The files of one open that did not open (FB8 §6): one failure toast for one file ("Could
 * not open scan.pdf: the file is damaged."), or one for several ("2 of 5 files could not be
 * opened.", each file and its reason on the second line).
 */
export function presentOpenFailures(failed: readonly OpenFailure[], total: number): void {
  if (failed.length === 0) return;
  if (failed.length === 1) {
    const [only] = failed as [OpenFailure];
    presentError({ kind: 'open', ...only }, { key: `open:${only.name}` });
    return;
  }
  const text = m.error_some_files({ failed: String(failed.length), total: String(total) });
  const detail = failed
    .map((f) => m.announce_skipped({ name: f.name, reason: failureReason(f.error) }))
    .join(' · ');
  toast.failure(text, { detail, testId: 'failure-toast' });
}
