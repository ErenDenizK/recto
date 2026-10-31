/**
 * Scoring and picking (PRD-39, spec §2.6, §2.7). A score is only for ordering the readings and
 * for deciding whether a second one is shown: the product, over the clauses, of the sense's
 * weight (1, 0.8 for a second sense of a shared word, 0.95 for a folk phrase, 0.75 for a typo)
 * and its slot fit (1 when every slot came from the text, 0.9 when a default filled one).
 */
import type { Reading } from './types';

/** A reading with what the picker needs to know about how it was made. */
export interface Scored {
  readonly reading: Reading;
  /** A clause used an entry marked `alwaysAsk` (a known two-way word). */
  readonly ask: boolean;
}

const SECOND_SHOWN_FROM = 0.8;

/** At most two readings: the best, and the second when it is close or the word is two-way. */
export function pick(scored: readonly Scored[]): [Reading] | [Reading, Reading] | null {
  const sorted = [...scored].sort((a, b) => b.reading.score - a.reading.score);
  const first = sorted[0];
  if (!first) return null;
  const second = sorted[1];
  if (
    second &&
    (second.reading.score >= SECOND_SHOWN_FROM * first.reading.score - 1e-9 ||
      first.ask ||
      second.ask)
  ) {
    return [first.reading, second.reading];
  }
  return [first.reading];
}
