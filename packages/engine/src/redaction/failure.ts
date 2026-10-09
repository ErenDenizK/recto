/**
 * The error a redaction that must not be offered fails with (spec redaction §1.2). It lives
 * apart from `apply.ts`, which imports pdf-lib, so the PDFium proxy can rebuild it on the
 * caller's thread from the light `@pdf-editor/engine/client` entry (docs/plan/v1/PLAN.md PF-2).
 */
import { type ApplyRedactionsResult, EngineError } from '../types';

/** What was known when a redaction failed its gate or its check (no bytes). */
export type RedactionFailure = Partial<Omit<ApplyRedactionsResult, 'bytes'>> &
  Pick<ApplyRedactionsResult, 'plan' | 'captured'>;

/**
 * A redaction that must not be offered: `stage` says which gate stopped it and `failure`
 * holds the reports (the gate's areas, or the forensic findings).
 */
export class RedactionFailedError extends EngineError {
  constructor(
    readonly stage: 'gate' | 'forensic',
    message: string,
    readonly failure: RedactionFailure,
  ) {
    super(stage === 'gate' ? 'unsupported' : 'internal', message);
    this.name = 'RedactionFailedError';
  }
}
