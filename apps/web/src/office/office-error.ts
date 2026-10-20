/** Why an Office conversion stopped (ADR-0035 §5); each reason has its own sentence. */
export type OfficeFailure =
  /** The build ships no package (`convert/` answered 404). */
  | 'missing'
  /** The download failed or stopped. */
  | 'network'
  /** A file's SHA-256 did not match the lock. */
  | 'corrupt'
  /** The device refused to store it. */
  | 'quota'
  /** No cross-origin isolation here (no service worker, or the reload did not isolate). */
  | 'isolation'
  /** LibreOffice could not convert the file. */
  | 'convert'
  /** The conversion did not finish in time. */
  | 'timeout';

export class OfficeError extends Error {
  readonly reason: OfficeFailure | 'aborted';
  constructor(reason: OfficeFailure | 'aborted', message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'OfficeError';
    this.reason = reason;
  }
}

/** The reason behind `error` (an unknown error is a failed conversion). */
export function failureOf(error: unknown): OfficeFailure | 'aborted' {
  if (error instanceof OfficeError) return error.reason;
  if (error instanceof DOMException && error.name === 'AbortError') return 'aborted';
  if (error instanceof DOMException && error.name === 'QuotaExceededError') return 'quota';
  return 'convert';
}
