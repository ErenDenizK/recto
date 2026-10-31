/**
 * The intent bar's contract (decision PRD-39; spec `docs/specs/niyet.md` §2.10). Lane N1 writes
 * the parser against these types, lane N2 the preview and runner, lane N3 the bar. Pure types
 * and one constant: nothing here imports a store, so the module is free to load anywhere.
 */
import type { PatternId } from '../../redaction/patterns'; // type-only; patterns.ts is pure

export type Action =
  | 'goto'
  | 'heading'
  | 'recent'
  | 'find'
  | 'rotate'
  | 'delete'
  | 'duplicate'
  | 'move'
  | 'reverse'
  | 'split'
  | 'pageNumbers'
  | 'watermark'
  | 'extract'
  | 'combine'
  | 'signPlace'
  | 'certify'
  | 'redactFind'
  | 'ocr'
  | 'password'
  | 'fill'
  | 'officeToPdf'
  | 'compress'
  | 'exportImages'
  | 'exportText'
  | 'saveCopy'
  | 'print'
  | 'unavailable';
export type Family = 'navigate' | 'document' | 'handoff' | 'output' | 'unavailable';

/** The family of each action (§2.1): it decides the preview, chaining and what undo means. */
export const FAMILY: Readonly<Record<Action, Family>> = {
  goto: 'navigate',
  heading: 'navigate',
  recent: 'navigate',
  find: 'navigate',
  rotate: 'document',
  delete: 'document',
  duplicate: 'document',
  move: 'document',
  reverse: 'document',
  split: 'document',
  pageNumbers: 'document',
  // With text it is a document step; without text it opens the dialog (a handoff, see grammar.ts).
  watermark: 'document',
  extract: 'handoff',
  combine: 'handoff',
  signPlace: 'handoff',
  certify: 'handoff',
  redactFind: 'handoff',
  ocr: 'handoff',
  password: 'handoff',
  fill: 'handoff',
  officeToPdf: 'handoff',
  compress: 'output',
  exportImages: 'output',
  exportText: 'output',
  saveCopy: 'output',
  print: 'output',
  unavailable: 'unavailable',
};

export interface Pages {
  /** 1-based positions now, ascending, unique. */
  readonly pages: readonly number[];
  /** How they were named, so a row can say "even pages" instead of a long list. */
  readonly named: 'list' | 'all' | 'even' | 'odd' | 'selection' | 'current' | 'edge' | 'except';
  /** Inherited from the previous clause (ellipsis); the row says so. */
  readonly inherited?: true;
}

export type Unavailable = 'pdf-to-word' | 'pdf-to-excel' | 'pdf-to-powerpoint' | 'translate';

export type Step =
  | { readonly action: 'goto'; readonly page: number }
  | { readonly action: 'heading'; readonly text: string; readonly matches: readonly QueryHeading[] }
  | { readonly action: 'recent'; readonly text: string; readonly matches: readonly QueryRecent[] }
  | { readonly action: 'find'; readonly text: string }
  | { readonly action: 'rotate'; readonly pages: Pages; readonly turns: -1 | 1 | 2 }
  | {
      readonly action: 'delete' | 'duplicate' | 'extract' | 'reverse' | 'ocr' | 'pageNumbers';
      readonly pages: Pages;
    }
  | {
      readonly action: 'move';
      readonly pages: Pages;
      readonly to: { readonly before: number } | { readonly after: number } | 'start' | 'end';
    }
  | {
      readonly action: 'split';
      /**
       * `every` N pages; `at` the page numbers where a new part starts (`at: [10]` on 24 pages is
       * 1-9 and 10-24; the runner's cuts are these minus one); `parts` N near-equal parts;
       * `choose` opens the split dialog.
       */
      readonly how:
        | { readonly every: number }
        | { readonly at: readonly number[] }
        | { readonly parts: number }
        | 'choose';
    }
  | { readonly action: 'watermark'; readonly text: string | null; readonly pages: Pages }
  | { readonly action: 'compress'; readonly targetBytes: number | null }
  | {
      readonly action: 'exportImages';
      readonly format: 'jpeg' | 'png' | 'webp';
      readonly pages: Pages;
    }
  | { readonly action: 'exportText'; readonly format: 'markdown' | 'text' }
  | { readonly action: 'signPlace'; readonly page: number }
  | { readonly action: 'redactFind'; readonly patterns: readonly PatternId[] }
  | {
      readonly action:
        | 'saveCopy'
        | 'print'
        | 'combine'
        | 'certify'
        | 'password'
        | 'fill'
        | 'officeToPdf';
    }
  | {
      readonly action: 'unavailable';
      readonly capability: Unavailable;
      /** The command the row offers instead, or null. */
      readonly nearest: string | null;
    };

export type Problem =
  | 'no-document'
  | 'out-of-range'
  | 'reversed-range'
  | 'no-pages'
  | 'all-pages'
  | 'ambiguous-count'
  | 'needs-pages'
  | 'not-a-run'
  | 'shifted'
  | 'two-finishing'
  | 'after-split'
  | 'single-part'
  | 'phone';

export interface Reading {
  /** In run order (§2.9). */
  readonly steps: readonly Step[];
  readonly score: number;
  /** The first problem and the step it is on; null when the parser sees none. */
  readonly problem: {
    readonly kind: Problem;
    readonly step: number;
    readonly page?: number;
  } | null;
  /** Original-text spans each step was read from (for a later input highlight). */
  readonly spans: readonly (readonly [number, number])[];
  /** A typo was corrected: the word as typed and as read. */
  readonly corrected?: readonly { readonly typed: string; readonly read: string }[];
}

export type ParseResult =
  | {
      readonly kind: 'readings';
      readonly readings: readonly [Reading] | readonly [Reading, Reading];
    }
  /** An action word was found but another word was not understood: a quiet row, then commands. */
  | { readonly kind: 'partial'; readonly action: Action; readonly unknown: readonly string[] }
  /** Nothing to read: the command list as today. */
  | { readonly kind: 'none' };

export interface QueryHeading {
  readonly title: string;
  readonly page: number;
}
export interface QueryRecent {
  readonly id: string;
  readonly name: string;
}

export interface IntentContext {
  readonly pageCount: number; // 0 when no document is open
  readonly currentPage?: number; // 1-based
  readonly selectedPages: readonly number[]; // 1-based positions selected in the Pages bar (S10)
  readonly headings: readonly QueryHeading[];
  readonly recents: readonly QueryRecent[];
  readonly savedSignatures: number;
  readonly officeEnabled: boolean; // PRD-18 flag on and not compact (EDN-19)
  readonly edition: 'full' | 'compact';
}
