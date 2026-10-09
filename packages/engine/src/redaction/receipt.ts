/**
 * The save receipt's computation (docs/plan/v1/PLAN.md E13-c; innovation roadmap E13: "The
 * receipt search runs PDFium over the output bytes"). After a save, the receipt UI (E13-u)
 * reads "3 areas removed · searched the saved file: 0 matches remain"; this module gives it
 * those numbers, per act and in total, from the exact bytes that were saved.
 *
 * Each redacted string is searched the way the export's self-check does it (forensic.ts,
 * `no-search-hits`): PDFium's whole-document search, one match per hit, then the normalised
 * text of every page (`normalizeForMatch`), which also finds a copy with a zero-width
 * character inside; a page found that way and not by the search adds one match. A string
 * shared by two acts is searched once.
 *
 * The receipt carries counts and page numbers only, never the redacted text. With no string
 * to search for, the file is not opened at all.
 */

import type {
  ForensicDeps,
  RedactionPlan,
  SaveReceipt,
  SaveReceiptAct,
  SaveReceiptActResult,
} from '../types';
import { forensicDepsOf, openScratch, type RedactionHost } from './engine-session';
import { normalizeForMatch } from './strings';

/** What the computation reads from the saved file. */
export interface SaveReceiptDeps extends Pick<ForensicDeps, 'search' | 'getPageText'> {
  readonly pageCount: number;
}

/** One act per applied redaction of an export (`RedactionExportPlan.plans`, one per apply). */
export function saveReceiptActsOf(plans: readonly RedactionPlan[]): SaveReceiptAct[] {
  return plans.map((plan) => ({
    kind: 'redaction',
    areas: plan.areas.length,
    terms: plan.strings,
  }));
}

/** Distinct, non-blank strings, in first-seen order. */
function distinctTerms(terms: readonly string[]): string[] {
  return [...new Set(terms.filter((term) => normalizeForMatch(term) !== ''))];
}

/**
 * The receipt of the file `deps` reads, for `acts`, whose size is `bytes`. Never throws for a
 * match (a match is a count); a dependency error rejects.
 */
export async function computeSaveReceipt(
  acts: readonly SaveReceiptAct[],
  deps: SaveReceiptDeps | undefined,
  bytes: number,
): Promise<SaveReceipt> {
  const terms = distinctTerms(acts.flatMap((act) => act.terms));
  /** Per searched string: the pages it matched on, with the match count per page. */
  const found = new Map<string, Map<number, number>>();
  if (deps && terms.length > 0) {
    for (const term of terms) {
      const pages = new Map<number, number>();
      for (const hit of await deps.search(term)) {
        pages.set(hit.pageIndex, (pages.get(hit.pageIndex) ?? 0) + 1);
      }
      found.set(term, pages);
    }
    const needles = terms.map((term) => [term, normalizeForMatch(term)] as const);
    for (let pageIndex = 0; pageIndex < deps.pageCount; pageIndex++) {
      const text = normalizeForMatch(
        (await deps.getPageText(pageIndex)).map((run) => run.text).join(''),
      );
      for (const [term, needle] of needles) {
        const pages = found.get(term) as Map<number, number>;
        if (!pages.has(pageIndex) && text.includes(needle)) pages.set(pageIndex, 1);
      }
    }
  }
  const tally = (list: readonly string[]) => {
    const pages = new Set<number>();
    let matches = 0;
    for (const term of list) {
      for (const [pageIndex, count] of found.get(term) ?? []) {
        pages.add(pageIndex);
        matches += count;
      }
    }
    return { matches, matchPages: [...pages].sort((a, b) => a - b) };
  };
  const results: SaveReceiptActResult[] = acts.map((act) => {
    const own = distinctTerms(act.terms);
    return { kind: act.kind, areas: act.areas, termsSearched: own.length, ...tally(own) };
  });
  return {
    acts: results,
    areasRemoved: acts.reduce((sum, act) => sum + act.areas, 0),
    termsSearched: terms.length,
    matchesRemain: tally(terms).matches,
    pagesSearched: deps && terms.length > 0 ? deps.pageCount : 0,
    bytes,
  };
}

/**
 * `computeSaveReceipt` on `bytes` opened in a scratch document of the hosted engine (the PDFium
 * worker's entry), closed afterwards; not opened when no act has a string to search for.
 */
export async function computeSaveReceiptOn(
  host: RedactionHost,
  bytes: ArrayBuffer | Uint8Array,
  acts: readonly SaveReceiptAct[],
  options: { readonly password?: string; readonly signal?: AbortSignal } = {},
): Promise<SaveReceipt> {
  if (distinctTerms(acts.flatMap((act) => act.terms)).length === 0) {
    return computeSaveReceipt(acts, undefined, bytes.byteLength);
  }
  const size = bytes.byteLength;
  const scratch = await openScratch(host, bytes, options);
  try {
    const deps: SaveReceiptDeps = { ...forensicDepsOf(scratch), pageCount: scratch.doc.pageCount };
    return await computeSaveReceipt(acts, deps, size);
  } finally {
    await scratch.close();
  }
}
