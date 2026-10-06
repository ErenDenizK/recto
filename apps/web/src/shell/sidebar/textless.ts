/**
 * Pages Find cannot search (`components/06-navigation.md` N4 §4, "No text on these pages ·
 * Recognize text…"; flows.md J11): the document's source pages with no visible text and no
 * invisible layer (a scan nobody recognised), from the engine's page facts (`ocrPageFacts`,
 * the OCR sheet's own source). Read per document and kept until its sources or engine edits
 * change, so a run of OCR clears the prompt.
 */
import type { DocumentId, VirtualDocument } from '@pdf-editor/document-model';
import { useEffect, useState } from 'react';

import { documentTargets } from '../../ocr/ocr-model';
import { ocrDependencies } from '../../ocr/ocr-deps';
import { useWorkspaceStore } from '../../state/workspace-store';

export interface Textless {
  /** Document page indices without searchable text. */
  readonly pages: readonly number[];
  /** Pages a run could recognise (source pages). */
  readonly targets: number;
}

const cache = new Map<string, Promise<Textless>>();

/** What invalidates the facts: the document's sources and the engine edits on them. */
function cacheKey(doc: VirtualDocument, editsRevision: unknown): string {
  const sources = [
    ...new Set(doc.pages.flatMap((p) => (p.ref.kind === 'source' ? [p.ref.source] : []))),
  ];
  return `${doc.id}|${sources.join(',')}|${String(editsRevision)}`;
}

let editsSeen: unknown = null;
let editsRevision = 0;

/** A number that changes whenever the engine edits change (cheap identity check). */
function revisionOf(edits: unknown): number {
  if (edits !== editsSeen) {
    editsSeen = edits;
    editsRevision += 1;
  }
  return editsRevision;
}

/** The textless pages of `doc` (cached; a failure reads as none). */
export function textlessPages(doc: VirtualDocument): Promise<Textless> {
  const edits = useWorkspaceStore.getState().workspace.engineEdits;
  const key = cacheKey(doc, revisionOf(edits));
  const known = cache.get(key);
  if (known) return known;
  const targets = documentTargets(doc);
  const sources = [...new Set(targets.map((t) => t.source))];
  const promise = Promise.all(
    sources.map(async (source) => [source, await ocrDependencies().facts(source)] as const),
  )
    .then((entries) => {
      const facts = new Map(entries);
      const pages = targets
        .filter((t) => {
          const fact = facts.get(t.source)?.[t.index];
          return fact !== undefined && !fact.visibleText && fact.invisibleText === 'none';
        })
        .map((t) => t.docIndex);
      return { pages, targets: targets.length };
    })
    .catch(() => ({ pages: [], targets: targets.length }));
  cache.set(key, promise);
  return promise;
}

/** `textlessPages` for a component; undefined until read. */
export function useTextless(doc: VirtualDocument | undefined): Textless | undefined {
  const edits = useWorkspaceStore((s) => s.workspace.engineEdits);
  const [state, setState] = useState<{ id: DocumentId; value: Textless } | undefined>();
  useEffect(() => {
    if (!doc) return;
    let live = true;
    void textlessPages(doc).then((value) => {
      if (live) setState({ id: doc.id, value });
    });
    return () => {
      live = false;
    };
  }, [doc, edits]);
  return state !== undefined && state.id === doc?.id ? state.value : undefined;
}

/** Tests: forget what was read. */
export function resetTextless(): void {
  cache.clear();
}
