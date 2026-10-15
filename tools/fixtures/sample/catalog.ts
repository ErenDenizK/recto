/**
 * The page catalog (MOB-12, technical.md §1 (b)): one list of page designs, each flagged with
 * the editions whose file holds it. `buildSample(locale, edition)` filters it, so the full
 * cut (desktop and tablet) and the phone cut share every drawing and differ only where the
 * lesson does (design.md §3).
 */
import type { PageCtx, SampleEdition } from './context.ts';
import { agreementPage } from './pages/agreement.ts';
import { contactPage } from './pages/contact.ts';
import { coverPage } from './pages/cover.ts';
import { featurePage } from './pages/feature.ts';
import { flatplanPage } from './pages/flatplan.ts';
import { invoicePage } from './pages/invoice.ts';
import { letterPage } from './pages/letter.ts';

export interface SamplePage {
  readonly id: string;
  readonly editions: readonly SampleEdition[];
  /** Draws the page; the scan page instead returns no writer output (see build.ts). */
  readonly draw?: (ctx: PageCtx) => unknown;
  /** The page is one image with no text layer (Recognize text's page). */
  readonly scan?: boolean;
}

export const SAMPLE_PAGES: readonly SamplePage[] = [
  { id: 'cover', editions: ['full', 'phone'], draw: coverPage },
  { id: 'letter', editions: ['full', 'phone'], draw: letterPage },
  { id: 'feature', editions: ['full', 'phone'], draw: featurePage },
  { id: 'contact', editions: ['full', 'phone'], draw: contactPage },
  { id: 'agreement', editions: ['full', 'phone'], draw: agreementPage },
  { id: 'scan', editions: ['full'], scan: true },
  { id: 'invoice', editions: ['full'], draw: invoicePage },
  { id: 'flatplan', editions: ['full'], draw: flatplanPage },
  { id: 'flatplan-phone', editions: ['phone'], draw: flatplanPage },
];

export const pagesOf = (edition: SampleEdition): SamplePage[] =>
  SAMPLE_PAGES.filter((p) => p.editions.includes(edition));
