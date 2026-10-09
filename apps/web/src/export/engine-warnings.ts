/**
 * The engine's export warnings in the reader's language (M1-d, docs/plan/v1/PLAN.md §3.2;
 * "complete Turkish is a 1.0 criterion"). The assembler writes its warnings in English
 * (`ReconciliationReport.warnings`, a stable engine API that tests and logs read); the summary
 * shows each one through this table, matched by its wording, with the numbers and names it
 * carries. A warning no row matches is shown as the engine wrote it, so a new engine warning is
 * never hidden; `engine-warnings.test.ts` fails until it has a row here.
 */
import { formatNumber, m } from '../i18n';

interface WarningText {
  readonly pattern: RegExp;
  readonly text: (match: RegExpExecArray) => string;
}

const WARNINGS: readonly WarningText[] = [
  {
    pattern:
      /^(\d+) annotations? fell outside resized pages \(cut off by the new size\) and (?:is|are) not visible$/,
    text: (match) => {
      const count = Number(match[1]);
      return m.summary_warning_annotations_cut({ count, countText: formatNumber(count) });
    },
  },
  {
    pattern:
      /^AES-256 encryption requires PDF 1\.7 extension level 3 or later; the header version was raised$/,
    text: () => m.summary_warning_aes_version(),
  },
  {
    pattern: /^Form fields on duplicated pages were kept on the first occurrence only$/,
    text: () => m.summary_warning_duplicated_page_fields(),
  },
  {
    pattern:
      /^Overlay text uses characters the standard (.+) font cannot encode; a bundled font was embedded instead$/,
    text: (match) => m.summary_warning_overlay_font({ family: match[1] ?? '' }),
  },
  {
    pattern: /^Some overlay characters are not covered by the bundled fonts and were left blank$/,
    text: () => m.summary_warning_overlay_blank(),
  },
  {
    pattern:
      /^Outline entries whose target page was removed were kept as headings for their children$/,
    text: () => m.summary_warning_outline_headings(),
  },
  {
    pattern: /^Some fields with equal names differ in type and were renamed instead of joined$/,
    text: () => m.summary_warning_fields_renamed_types(),
  },
  {
    pattern:
      /^Form resource fonts with the same name in several sources were merged \(first wins\)$/,
    text: () => m.summary_warning_form_fonts_merged(),
  },
  {
    pattern: /^Some created form fields are on pages that are not exported and were left out$/,
    text: () => m.summary_warning_created_fields_left_out(),
  },
  {
    pattern:
      /^Some form field text uses characters Helvetica cannot encode; its appearance uses a bundled font$/,
    text: () => m.summary_warning_field_font(),
  },
  {
    pattern: /^Ignored invalid creation date "(.*)"$/,
    text: (match) => m.summary_warning_creation_date({ value: match[1] ?? '' }),
  },
  {
    pattern: /^Ignored invalid modification date "(.*)"$/,
    text: (match) => m.summary_warning_modification_date({ value: match[1] ?? '' }),
  },
];

/** `warning` in the current locale, or as the engine wrote it when no row matches. */
export function engineWarningText(warning: string): string {
  for (const { pattern, text } of WARNINGS) {
    const match = pattern.exec(warning);
    if (match) return text(match);
  }
  return warning;
}

/** Whether `warning` has a translation (the coverage test). */
export function isTranslatedEngineWarning(warning: string): boolean {
  return WARNINGS.some(({ pattern }) => pattern.test(warning));
}
