/**
 * Pages Find cannot search (`components/06-navigation.md` N4 §4, "No text on these pages ·
 * Recognize text…"; flows.md J11): the document's source pages with no visible text and no
 * invisible layer (a scan nobody recognised), from the engine's page facts (`ocrPageFacts`,
 * the OCR sheet's own source). Read per document and kept until its sources or engine edits
 * change, so a run of OCR clears the prompt.
 */
import type { DocumentId, SourceId, VirtualDocument } from '@pdf-editor/document-model';
import type { OcrPageFacts } from '@pdf-editor/engine';
import { useEffect, useState } from 'react';

import { documentTargets } from '../../ocr/ocr-model';
import { ocrDependencies } from '../../ocr/ocr-deps';
import { useWorkspaceStore } from '../../state/workspace-store';
import { useSearchStore } from '../../viewer/search';

export interface Textless {
  /** Document page indices without searchable text. */
  readonly pages: readonly number[];
  /** Pages a run could recognise (source pages). */
  readonly targets: number;
}

const cache = new Map<string, Promise<Textless>>();

/** How long Find must have been idle before the page facts start. */
const CALM_MS = 1000;
/** Pages per engine request: a search waits for at most one of these. */
const CHUNK_PAGES = 20;

/**
 * Resolves once no search is running, after `delay` ms of that holding (it starts over when
 * the query or the status changes). The facts walk every page in the one engine worker, and
 * the worker takes one request at a time: read in one go they ran ahead of the first search,
 * which showed nothing until they were done. So the walk starts only when Find is idle and
 * steps aside whenever a search runs (R25 Epic 1 lane 5, DSN-61). A query typed but not yet
 * started (`idle`) counts as idle: the walk's chunk in that gap is the most a search waits.
 */
export function whenSearchIdle(delay: number): Promise<void> {
  return new Promise((resolve) => {
    let timer: number | undefined;
    let last = useSearchStore.getState();
    const arm = () => {
      window.clearTimeout(timer);
      if (useSearchStore.getState().status === 'searching') return;
      timer = window.setTimeout(() => {
        unsubscribe();
        resolve();
      }, delay);
    };
    const unsubscribe = useSearchStore.subscribe((state) => {
      if (state.status === last.status && state.query === last.query) return;
      last = state;
      arm();
    });
    arm();
  });
}

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

/** Facts of one source's pages, `CHUNK_PAGES` at a time, stepping aside for any search. */
async function readFacts(
  source: SourceId,
  pageCount: number,
  stale: () => boolean,
): Promise<OcrPageFacts[] | undefined> {
  const facts: OcrPageFacts[] = [];
  for (let from = 0; from < pageCount; from += CHUNK_PAGES) {
    await whenSearchIdle(from === 0 ? CALM_MS : 0);
    if (stale()) return undefined;
    const chunk = await ocrDependencies().facts(source, {
      from,
      count: Math.min(CHUNK_PAGES, pageCount - from),
    });
    facts.push(...chunk);
  }
  return facts;
}

/** The textless pages of `doc` (cached; a failure reads as none). */
export function textlessPages(doc: VirtualDocument): Promise<Textless> {
  const edits = useWorkspaceStore.getState().workspace.engineEdits;
  const key = cacheKey(doc, revisionOf(edits));
  const known = cache.get(key);
  if (known) return known;
  // Older reads of this document are superseded: their walks stop at their next chunk.
  for (const old of cache.keys()) if (old.startsWith(`${doc.id}|`)) cache.delete(old);
  const targets = documentTargets(doc);
  const sources = [...new Set(targets.map((t) => t.source))];
  const stale = () =>
    cache.get(key) !== promise || useWorkspaceStore.getState().workspace.activeDocument !== doc.id;
  const promise: Promise<Textless> = Promise.all(
    sources.map(async (source) => {
      const count = Math.max(...targets.filter((t) => t.source === source).map((t) => t.index)) + 1;
      return [source, await readFacts(source, count, stale)] as const;
    }),
  )
    .then((entries) => {
      const none = { pages: [], targets: targets.length };
      if (entries.some(([, facts]) => facts === undefined)) {
        // Stopped part-way: no answer, and nothing cached for a later read to trust.
        if (cache.get(key) === promise) cache.delete(key);
        return none;
      }
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
