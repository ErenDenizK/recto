/**
 * Step 1 of the intent pipeline (PRD-39, spec §2.2): the typed text as the grammar reads it.
 * `foldForSearch` is length-preserving (PRD-23), so every offset in the folded text is an
 * offset in the original: tokens carry spans of what was typed, with no map to keep.
 */
import { foldForSearch } from '../fuzzy';

const SAME_LENGTH: Readonly<Record<string, string>> = {
  '’': "'",
  '‘': "'",
  '`': "'",
  '´': "'",
  '“': '"',
  '”': '"',
  '„': '"',
  '«': '"',
  '»': '"',
  '–': '-',
  '—': '-',
  '−': '-',
  '‑': '-',
  ' ': ' ',
};

/** The original (NFC) text and its folded twin of the same length: quotes and dashes unified. */
export function normalise(text: string): { readonly original: string; readonly folded: string } {
  const original = text.normalize('NFC');
  let folded = '';
  for (const char of foldForSearch(original)) folded += SAME_LENGTH[char] ?? char;
  return { original, folded };
}
