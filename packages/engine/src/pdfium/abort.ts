/**
 * The `aborted` error of a cancelled call. Kept apart from `task-bridge.ts`, which imports
 * EmbedPDF's models, so the worker proxies on the caller's thread stay on the light
 * `@pdf-editor/engine/client` entry (docs/plan/v1/PLAN.md PF-2).
 */
import { EngineError } from '../types';

export function abortedError(op: string, cause?: unknown): EngineError {
  return new EngineError('aborted', `${op} aborted`, cause === undefined ? undefined : { cause });
}

export function throwIfAborted(signal: AbortSignal | undefined, op: string): void {
  if (signal?.aborted) {
    throw abortedError(op, signal.reason);
  }
}
