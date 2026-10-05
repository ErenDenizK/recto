/**
 * The work Save a copy does while it is open (components/07-sheets.md §4.4, §4.6):
 *
 * - `useSizeAnalysis`: the document assembled as it would be saved, analysed by the compress
 *   worker at idle priority, so every Size preset shows its estimate before anything runs
 *   (INV-18). One analysis per document and history step, kept while the step stays.
 * - `useTextPreview`: the Markdown or text conversion, run on open and again 250 ms after each
 *   change (the run before is cancelled), so the preview shows and Save copy writes exactly
 *   what was previewed.
 * - `usePrepared`: the pre-assembled copy that Share needs (§27.6): Web Share must be called
 *   inside the press, which an assembly would outlast, so the copy is built 600 ms after the
 *   settings stop changing.
 * - `usePlatform`: what this browser offers for the primary (§4.6).
 */
import type { DocumentId, HistoryEntry, VirtualDocument } from '@pdf-editor/document-model';
import type { CompressionAnalysis, ConvertResult } from '@pdf-editor/engine';
import { useEffect, useState } from 'react';
import { create } from 'zustand';

import { type ConvertChoice, convertDocumentPages } from '../convert/convert-run';
import { m } from '../i18n';
import { useWorkspaceStore } from '../state/workspace-store';
import { getCompressor } from '../tools/compress-client';
import { toolSourceBytes } from '../tools/tool-source';
import { supportsSavePicker } from './deliver';
import type { PlatformCapabilities } from './save-copy-model';
import { canShareFiles, type CopyOutput } from './save-copy-run';

// ---------------------------------------------------------------------------
// Size analysis
// ---------------------------------------------------------------------------

export type SizeAnalysis =
  | { readonly state: 'working' }
  | {
      readonly state: 'ready';
      readonly analysis: CompressionAnalysis;
      /** The assembled bytes the analysis read (the before of a comparison). */
      readonly source: ArrayBuffer;
    }
  | { readonly state: 'failed'; readonly message: string };

interface Analysed {
  readonly doc: VirtualDocument;
  readonly step: HistoryEntry | null;
  readonly result: SizeAnalysis;
}

/** The last analysis per document, valid while its document and history step stay. */
const useAnalysed = create<{ readonly entries: Readonly<Record<string, Analysed>> }>()(() => ({
  entries: {},
}));

const idle = (run: () => void): (() => void) => {
  if (typeof requestIdleCallback === 'function') {
    const handle = requestIdleCallback(run, { timeout: 500 });
    return () => cancelIdleCallback(handle);
  }
  const timer = setTimeout(run, 0);
  return () => clearTimeout(timer);
};

/** The analysis behind the Size estimates; `enabled` while the PDF format shows. */
export function useSizeAnalysis(documentId: DocumentId, enabled: boolean): SizeAnalysis | null {
  const doc = useWorkspaceStore((s) => s.workspace.documents[documentId]);
  const step = useWorkspaceStore((s) => s.history.present);
  const cached = useAnalysed((s) => s.entries[documentId]);
  const fresh = cached && cached.doc === doc && cached.step === step ? cached.result : null;

  useEffect(() => {
    if (!enabled || !doc || fresh?.state === 'ready') return undefined;
    const abort = new AbortController();
    const settle = (result: SizeAnalysis) => {
      if (abort.signal.aborted) return;
      useAnalysed.setState((s) => ({
        entries: { ...s.entries, [documentId]: { doc, step, result } },
      }));
    };
    const cancel = idle(() => {
      void (async () => {
        try {
          const source = await toolSourceBytes(documentId, abort.signal);
          if (abort.signal.aborted) return;
          const compressor = await getCompressor();
          const analysis = await compressor.analyze(source.slice(0));
          settle({ state: 'ready', analysis, source });
        } catch (error) {
          settle({
            state: 'failed',
            message: error instanceof Error ? error.message : String(error),
          });
        }
      })();
    });
    return () => {
      cancel();
      abort.abort();
    };
  }, [documentId, doc, step, enabled, fresh?.state]);

  if (!enabled) return null;
  return fresh ?? { state: 'working' };
}

// ---------------------------------------------------------------------------
// Text preview
// ---------------------------------------------------------------------------

/** Wait after a change before converting again (typing a range). */
const PREVIEW_DEBOUNCE_MS = 250;

export type TextPreview = { readonly key: string } & (
  | { readonly state: 'working'; readonly done: number; readonly total: number }
  | { readonly state: 'ready'; readonly result: ConvertResult }
  | { readonly state: 'failed'; readonly message: string }
);

/** Converts `pages` with `choice` while `enabled`; the latest run's state. */
export function useTextPreview(
  documentId: DocumentId,
  enabled: boolean,
  choice: ConvertChoice,
  pages: readonly number[] | null,
): TextPreview | null {
  const pagesKey = pages?.join(',') ?? '';
  const key = JSON.stringify([documentId, choice, pagesKey]);
  const [latest, setLatest] = useState<TextPreview | null>(null);

  useEffect(() => {
    if (!enabled || pagesKey === '') return undefined;
    const abort = new AbortController();
    const list = pagesKey.split(',').map(Number);
    const timer = window.setTimeout(() => {
      convertDocumentPages(documentId, list, choice, {
        signal: abort.signal,
        onProgress: (done, total) => {
          if (!abort.signal.aborted) setLatest({ key, state: 'working', done, total });
        },
      }).then(
        (result) => {
          if (!abort.signal.aborted) setLatest({ key, state: 'ready', result });
        },
        (error: unknown) => {
          if (abort.signal.aborted) return;
          setLatest({
            key,
            state: 'failed',
            message: m.convert_failed({
              reason: error instanceof Error ? error.message : String(error),
            }),
          });
        },
      );
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      abort.abort();
    };
  }, [documentId, choice, pagesKey, key, enabled]);

  if (!enabled || pagesKey === '') return null;
  // Until a run for the current choices reports, it shows as starting.
  return latest?.key === key
    ? latest
    : { key, state: 'working', done: 0, total: (pages?.length ?? 0) + 1 };
}

// ---------------------------------------------------------------------------
// The copy prepared for Share
// ---------------------------------------------------------------------------

/** How long the settings must rest before the copy is built for Share (§4.6). */
export const PREPARE_AFTER_MS = 600;

export type Prepared = { readonly key: string } & (
  | { readonly state: 'working'; readonly share: number }
  | { readonly state: 'ready'; readonly output: CopyOutput }
  | { readonly state: 'failed'; readonly message: string }
);

/**
 * Builds the copy for `key` with `build` once the settings have rested, while `enabled`;
 * a new key cancels the build before it.
 */
export function usePrepared(
  enabled: boolean,
  key: string,
  build: (signal: AbortSignal, onProgress: (share: number) => void) => Promise<CopyOutput>,
): Prepared | null {
  const [latest, setLatest] = useState<Prepared | null>(null);
  useEffect(() => {
    if (!enabled) return undefined;
    const abort = new AbortController();
    const timer = window.setTimeout(() => {
      build(abort.signal, (share) => {
        if (!abort.signal.aborted) setLatest({ key, state: 'working', share });
      }).then(
        (output) => {
          if (!abort.signal.aborted) setLatest({ key, state: 'ready', output });
        },
        (error: unknown) => {
          if (abort.signal.aborted) return;
          setLatest({
            key,
            state: 'failed',
            message: error instanceof Error ? error.message : String(error),
          });
        },
      );
    }, PREPARE_AFTER_MS);
    return () => {
      window.clearTimeout(timer);
      abort.abort();
    };
    // `build` reads the settings `key` names; a new key is a new build.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key]);
  if (!enabled) return null;
  return latest?.key === key ? latest : { key, state: 'working', share: 0 };
}

// ---------------------------------------------------------------------------
// The platform
// ---------------------------------------------------------------------------

/** What this browser offers, read once per sheet (pointers do not change mid-sheet). */
export function usePlatform(): PlatformCapabilities {
  const [platform] = useState<PlatformCapabilities>(() => ({
    savePicker: supportsSavePicker(),
    coarse: matchMedia('(pointer: coarse)').matches,
    shareFiles: canShareFiles(),
  }));
  return platform;
}
