/**
 * Plain text as a new document (conversion memo step 2, PRD-19): a `.txt` file becomes the
 * PDF `<name>.pdf`, which then goes through the normal open path like any PDF (the Office
 * intake does the same with its converted files). The layout is the engine's
 * (`@pdf-editor/engine/text-to-pdf`, loaded only when a text file is opened).
 */
import { m } from '../i18n';
import { toast } from '../ui/Toast/toast';
import { isHiddenName, isPdfFile, type NamedFile } from './file-filters';

/** Accept string for pickers and inputs. */
export const TEXT_ACCEPT = 'text/plain,.txt';

export const TEXT_PICKER_TYPES: Readonly<Record<string, string[]>> = { 'text/plain': ['.txt'] };

export function isTextFile(file: NamedFile): boolean {
  if (isHiddenName(file.name) || isPdfFile(file)) return false;
  return file.type.toLowerCase() === 'text/plain' || /\.txt$/i.test(file.name);
}

/** The converted document's name: `notes.txt` → `notes.pdf`. */
export function pdfNameForText(name: string): string {
  return /\.txt$/i.test(name) ? name.replace(/\.txt$/i, '.pdf') : `${name}.pdf`;
}

/** Converts one text file to a PDF file named after it. */
export async function textFileToPdf(file: File): Promise<File> {
  const { textToPdf } = await import('@pdf-editor/engine/text-to-pdf');
  const name = pdfNameForText(file.name);
  const bytes = await textToPdf(new Uint8Array(await file.arrayBuffer()), {
    title: name.replace(/\.pdf$/i, ''),
  });
  return new File([bytes as BlobPart], name, { type: 'application/pdf' });
}

/**
 * Replaces the text files among `files` by their PDFs, keeping order. A file that cannot be
 * converted is dropped with a toast.
 */
export async function convertTextFiles(files: readonly File[]): Promise<File[]> {
  const out: File[] = [];
  for (const file of files) {
    if (!isTextFile(file)) {
      out.push(file);
      continue;
    }
    try {
      out.push(await textFileToPdf(file));
    } catch {
      toast.failure(m.text_to_pdf_failed({ name: file.name }));
    }
  }
  return out;
}
