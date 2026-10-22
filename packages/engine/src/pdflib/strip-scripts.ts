/**
 * Scripts out of the bytes Print… hands to the browser's own PDF viewer (PRD-25): that viewer
 * runs document JavaScript, and Recto never runs a PDF's scripts anywhere else. With the
 * predicates of "Strip metadata" (`metadata-walk.ts`): every /AA (catalog, pages, fields), script
 * and external actions in /OpenAction, /A and /Next, and the /Names /JavaScript tree go. It works
 * on a copy and returns new bytes; the input is never changed, and bytes with nothing to strip
 * come back as they were.
 */
import { PDFArray, PDFDict, PDFDocument } from '@cantoo/pdf-lib';

import { dropUnreachable } from './metadata';
import { forEachDict, isScriptOrExternalAction, NAMES } from './metadata-walk';

export interface StrippedScripts {
  readonly bytes: Uint8Array;
  /** Actions, additional-action dictionaries and the document-level script tree removed. */
  readonly removed: number;
}

export async function stripScripts(bytes: ArrayBuffer | Uint8Array): Promise<StrippedScripts> {
  const doc = await PDFDocument.load(bytes.slice(0), { updateMetadata: false });
  const { context, catalog } = doc;
  let removed = 0;
  forEachDict(doc, ({ dict }) => {
    if (dict.has(NAMES.AA)) {
      dict.delete(NAMES.AA);
      removed++;
    }
    for (const key of [NAMES.OpenAction, NAMES.A]) {
      if (isScriptOrExternalAction(doc, dict.get(key))) {
        dict.delete(key);
        removed++;
      }
    }
    const next = context.lookup(dict.get(NAMES.Next));
    if (next instanceof PDFArray) {
      for (let i = next.size() - 1; i >= 0; i--) {
        if (isScriptOrExternalAction(doc, next.get(i))) {
          next.remove(i);
          removed++;
        }
      }
      if (next.size() === 0) dict.delete(NAMES.Next);
    } else if (isScriptOrExternalAction(doc, dict.get(NAMES.Next))) {
      dict.delete(NAMES.Next);
      removed++;
    }
  });
  const names = context.lookupMaybe(catalog.get(NAMES.Names), PDFDict);
  if (names?.has(NAMES.JavaScript)) {
    names.delete(NAMES.JavaScript);
    removed++;
    if (names.entries().length === 0) catalog.delete(NAMES.Names);
  }
  if (removed === 0) return { bytes: new Uint8Array(bytes.slice(0)), removed };
  // Detached actions are not written (pdf-lib writes every object), nor packed out of sight.
  dropUnreachable(doc);
  return {
    bytes: await doc.save({ updateFieldAppearances: false, useObjectStreams: false }),
    removed,
  };
}
