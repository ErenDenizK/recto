/**
 * What the palette offers beyond a typed query (R25 Epic 4 lanes 2 and 4; PRD-29; 08-feedback
 * §2 "Scoped" and §6): the commands that act on selected pages, the document's own suggestions
 * for the empty state, and the open documents. Pure, so the order and the rules are testable.
 */
import type { VirtualDocument, Workspace } from '@pdf-editor/document-model';

/** Commands that act on the selected pages, in the Pages bar's order (08-feedback §6). */
export const PAGE_SCOPE_COMMANDS: readonly string[] = [
  'pages.rotateRight',
  'pages.rotateLeft',
  'pages.delete',
  'pages.extract',
  'pages.duplicate',
  'pages.moveToStart',
  'pages.moveToEnd',
];

/** Open documents the empty state lists (08-feedback §6). */
export const OPEN_DOCUMENTS_SHOWN = 4;

/** True when the document has form fields (the Save a copy sheet's own test for forms). */
export function hasFormFields(ws: Workspace, doc: VirtualDocument): boolean {
  return (
    (doc.fields?.length ?? 0) > 0 ||
    doc.pages.some((p) => p.ref.kind === 'source' && ws.sources[p.ref.source]?.flags.hasAcroForm)
  );
}

export type Suggestion = 'fill-sign' | 'recognize';

/**
 * "Suggested for this document": fields offer Fill & sign, pages with no text offer Recognize
 * text. Nothing when neither holds, so the section never shows filler.
 */
export function suggestionsFor(facts: {
  readonly fields: boolean;
  readonly textlessPages: number;
}): Suggestion[] {
  return [
    ...(facts.fields ? (['fill-sign'] as const) : []),
    ...(facts.textlessPages > 0 ? (['recognize'] as const) : []),
  ];
}
