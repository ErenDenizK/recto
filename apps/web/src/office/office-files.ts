/**
 * Which files are Office documents (ADR-0035 §5): Word, Excel and PowerPoint in their current
 * formats, by extension (browsers often hand these over with an empty or generic type). The
 * older binary formats and OpenDocument stay out until a fidelity pass covers them.
 */
import { isHiddenName, type NamedFile } from '../files/file-filters';

export type OfficeExtension = 'docx' | 'xlsx' | 'pptx';

const MIME: Readonly<Record<OfficeExtension, string>> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

/** The Office extension of `name`, or undefined. */
export function officeExtension(name: string): OfficeExtension | undefined {
  const ext = /\.([A-Za-z]+)$/.exec(name)?.[1]?.toLowerCase();
  return ext === 'docx' || ext === 'xlsx' || ext === 'pptx' ? ext : undefined;
}

export function isOfficeFile(file: NamedFile): boolean {
  return !isHiddenName(file.name) && officeExtension(file.name) !== undefined;
}

/** `<input accept>` for Office files. */
export const OFFICE_ACCEPT = (Object.keys(MIME) as OfficeExtension[])
  .map((ext) => `${MIME[ext]},.${ext}`)
  .join(',');

/** `showOpenFilePicker` types for Office files. */
export const OFFICE_PICKER_TYPES: Readonly<Record<string, string[]>> = Object.fromEntries(
  (Object.keys(MIME) as OfficeExtension[]).map((ext) => [MIME[ext], [`.${ext}`]]),
);

/** The converted document's name: `report.docx` → `report.pdf`. */
export function pdfNameFor(name: string): string {
  return officeExtension(name) === undefined ? `${name}.pdf` : name.replace(/\.[A-Za-z]+$/, '.pdf');
}
