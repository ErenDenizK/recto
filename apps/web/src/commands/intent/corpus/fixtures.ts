/**
 * The documents the corpus reads against (PRD-39, spec §4.1). The headings and recent files are
 * PRD-23's, so the 211 regression rows keep their meaning.
 */
import type { IntentContext } from '../types';

const HEADINGS = [
  { title: 'Introduction', page: 1 },
  { title: 'Methods', page: 14 },
  { title: 'Results', page: 30 },
  { title: 'Contributor agreement', page: 88 },
  { title: 'Yöntem', page: 40 },
  { title: 'İçindekiler', page: 2 },
  { title: 'Işık ve gölge', page: 51 },
];
const RECENTS = [
  { id: 'a', name: 'Annual report 2025.pdf' },
  { id: 'b', name: 'Lease agreement.pdf' },
  { id: 'c', name: 'Fatura Ocak.pdf' },
  { id: 'd', name: 'Işıklı tablo.pdf' },
];

const DOC24: IntentContext = {
  pageCount: 24,
  currentPage: 7,
  selectedPages: [],
  headings: [
    { title: 'Introduction', page: 1 },
    { title: 'Methods', page: 14 },
    { title: 'Results', page: 20 },
    { title: 'Yöntem', page: 9 },
  ],
  recents: RECENTS,
  savedSignatures: 1,
  officeEnabled: false,
  edition: 'full',
};

export const FIXTURES = {
  DOC24,
  /** Pages 3, 4 and 9 selected in the Pages bar. */
  DOC24_SEL: { ...DOC24, selectedPages: [3, 4, 9] },
  DOC1: { ...DOC24, pageCount: 1, currentPage: 1 },
  NODOC: { ...DOC24, pageCount: 0, currentPage: 0, headings: [] },
  PHONE: { ...DOC24, edition: 'compact' },
  OFFICE: { ...DOC24, officeEnabled: true },
  /** PRD-23's document: 100 pages, page 12 in view (the 211 regression rows). */
  DOC100: { ...DOC24, pageCount: 100, currentPage: 12, headings: HEADINGS },
} as const satisfies Record<string, IntentContext>;

export type FixtureName = keyof typeof FIXTURES;

/** One corpus row: what is typed, what the bar shows (see `show.ts`), and the document (default `DOC24`). */
export type Row = readonly [sentence: string, expected: string, ctx?: FixtureName];
