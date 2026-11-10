/**
 * Results of the engine service: every public method resolves to an `EngineResult` and never
 * rejects (engine-service.ts). Split from the service so the queue and the parking module can
 * share them; `engine-service.ts` re-exports all of it.
 */
import type { EngineErrorCode } from '@pdf-editor/engine';

export type EngineFailureCode = EngineErrorCode | 'password-cancelled' | 'read-failed';

export interface EngineFailure {
  readonly code: EngineFailureCode;
  readonly message: string;
}

export type EngineResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: EngineFailure };

export const ok = <T>(value: T): EngineResult<T> => ({ ok: true, value });
export const fail = <T>(code: EngineFailureCode, message: string): EngineResult<T> => ({
  ok: false,
  error: { code, message },
});

const ENGINE_CODES: readonly string[] = [
  'password-required',
  'password-incorrect',
  'unsupported-encryption',
  'corrupt',
  'unsupported',
  'out-of-memory',
  'aborted',
  'internal',
];

/** Maps anything thrown by an adapter to a typed failure (duck-typed on `code`). */
export function toFailure(error: unknown): EngineFailure {
  const code = (error as { code?: unknown } | null)?.code;
  const message = error instanceof Error ? error.message : String(error);
  if (typeof code === 'string' && ENGINE_CODES.includes(code)) {
    return { code: code as EngineErrorCode, message };
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    return { code: 'aborted', message };
  }
  return { code: 'internal', message };
}
