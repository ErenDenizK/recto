/**
 * Plain text and Markdown as a new document (conversion memo step 2, PRD-19, PRD-28): a `.txt`
 * (or `.md`, `.markdown`) file becomes a new,
 * unsaved document named `<name>.pdf`, made like the document of an image: its pages are the
 * converted PDF's, it is one history entry (so it counts as changed and closing it asks), and
 * it is not added to Recents. The layout is the engine's (`@pdf-editor/engine/text-to-pdf`,
 * loaded only when a text file is opened); Markdown goes through its own parser (PRD-28).
 *
 * Only files named `*.txt`, `*.md` or `*.markdown` that were dropped or picked themselves
 * convert: not a `.log` or `.csv`, and not the text files inside a dropped folder. Over 2 MB the
 * file is refused.
 */
import type { DocumentId } from '@pdf-editor/document-model';

import { m } from '../i18n';
import { toast } from '../ui/Toast/toast';
import { isHiddenName, isPdfFile, type NamedFile } from './file-filters';
import { openGeneratedPdf } from './generated-document';

/** Accept string for pickers and inputs. */
export const TEXT_ACCEPT = '.txt,.md,.markdown,text/plain,text/markdown';

/** The picker's two type entries: plain text, and Markdown (PRD-28). */
export const PLAIN_PICKER_TYPES: Readonly<Record<string, string[]>> = { 'text/plain': ['.txt'] };
export const MARKDOWN_PICKER_TYPES: Readonly<Record<string, string[]>> = {
  'text/markdown': ['.md', '.markdown'],
};

const MARKDOWN_NAME = /\.(md|markdown)$/i;

/** The largest text file that converts (bytes). */
export const TEXT_MAX_BYTES = 2 * 1024 * 1024;

/** A file named `*.md` or `*.markdown`. */
export function isMarkdownFile(file: NamedFile): boolean {
  return MARKDOWN_NAME.test(file.name);
}

/** A file named `*.txt`, `*.md` or `*.markdown` (a text type alone is not enough). */
export function isTextFile(file: NamedFile): boolean {
  if (isHiddenName(file.name) || isPdfFile(file)) return false;
  return /\.txt$/i.test(file.name) || isMarkdownFile(file);
}

/** The converted document's name: `notes.txt` → `notes.pdf`, `readme.md` → `readme.pdf`. */
export function pdfNameForText(name: string): string {
  const stem = /\.(txt|md|markdown)$/i;
  return stem.test(name) ? name.replace(stem, '.pdf') : `${name}.pdf`;
}

/** Converts one text file to a PDF file named after it. */
export async function textFileToPdf(file: File): Promise<File> {
  const { markdownToPdf, textToPdf } = await import('@pdf-editor/engine/text-to-pdf');
  const name = pdfNameForText(file.name);
  const convert = isMarkdownFile(file) ? markdownToPdf : textToPdf;
  const bytes = await convert(new Uint8Array(await file.arrayBuffer()), {
    title: name.replace(/\.pdf$/i, ''),
  });
  return new File([bytes as BlobPart], name, { type: 'application/pdf' });
}

/** Splits the text files off `files`; the rest keeps its order. */
export function takeTextFiles<T extends File>(
  files: readonly T[],
): { readonly text: T[]; readonly rest: T[] } {
  return {
    text: files.filter(isTextFile),
    rest: files.filter((file) => !isTextFile(file)),
  };
}

/** One text file as one new document; undefined when it was refused or failed (a toast says so). */
async function openTextFile(file: File): Promise<DocumentId | undefined> {
  if (file.size > TEXT_MAX_BYTES) {
    toast.failure(m.text_to_pdf_too_large({ name: file.name }));
    return undefined;
  }
  let pdf: File;
  try {
    pdf = await textFileToPdf(file);
  } catch {
    toast.failure(m.text_to_pdf_failed({ name: file.name }));
    return undefined;
  }
  const created = await openGeneratedPdf(pdf);
  if (created === undefined) toast.failure(m.text_to_pdf_failed({ name: file.name }));
  return created;
}

/** Opens each text file as its own new document, in order. */
export async function openTextFiles(files: readonly File[]): Promise<DocumentId[]> {
  const opened: DocumentId[] = [];
  for (const file of files) {
    const id = await openTextFile(file);
    if (id !== undefined) opened.push(id);
  }
  return opened;
}
