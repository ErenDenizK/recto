/**
 * The Text view's reader of a tab (PRD-35, PRD-36, EDN-26): a `ConvertSource` over the tab's
 * pages (`compare/document-pages.ts`: text runs, geometry; image placements from
 * `locateImages`, without pixels) fed to the analysis worker's `textStyle` and `textBlocks`.
 * It holds the analysis lease from `openTextSource` to `dispose`, so the worker stays up while the
 * view is open and ends `ANALYSIS_IDLE_MS` after it closes; PDFium calls run at `priority: 'low'`
 * so a page being read in the reader is not kept waiting. A scanned page has no runs and comes
 * back with `needsOcr`.
 */
import type { DocumentId, Rotation, SourceId } from '@pdf-editor/document-model';
import type {
  AnalysisProxy,
  ConvertStyle,
  EngineCallOptions,
  TextViewPage,
} from '@pdf-editor/engine';

import {
  type DocumentPages,
  documentPages,
  type PageEngine,
  pageAt,
  pageEngine,
  pageGeometry,
  pageText,
  totalRotation,
} from '../compare/document-pages';
import { getAnalysisWorkers } from '../engine/engine-service';
import { useWorkspaceStore } from '../state/workspace-store';
import type { PageFrame } from '../viewer/geometry';

/** A document page as the engine has it open, and its frame at one unit per point. */
export interface PageRef {
  readonly sourceId: SourceId;
  /** The page's index in its source. */
  readonly index: number;
  /** The view rotation on top of the page's own /Rotate (the `renderPage` rotation). */
  readonly delta: Rotation;
  readonly frame: PageFrame;
}

/** What the loader reads: one open tab. Release it with `dispose`. */
export interface TextSource {
  readonly pageCount: number;
  /** The document's /Lang, when it names one. */
  readonly language: string | undefined;
  pageRef(page: number): PageRef;
  style(signal: AbortSignal): Promise<ConvertStyle>;
  /** Blocks of `pages` (0-based, ascending), classified with the document's `style`. */
  blocks(
    pages: readonly number[],
    style: ConvertStyle,
    signal: AbortSignal,
  ): Promise<readonly TextViewPage[]>;
  dispose(): void;
}

type ConvertSourceOf = Parameters<AnalysisProxy['textBlocks']>[0];

const LOW: Pick<EngineCallOptions, 'priority'> = { priority: 'low' };

/** The `ConvertSource` of an open tab: text, geometry and image placements (no pixels). */
export function convertSourceOf(side: DocumentPages, engine: PageEngine): ConvertSourceOf {
  const call = (options: EngineCallOptions): EngineCallOptions => ({ ...options, ...LOW });
  const { locateImages } = engine;
  return {
    pageCount: side.pages.length,
    geometry: (index) => pageGeometry(pageAt(side, index)),
    text: (index, options) => pageText(engine, side, index, call(options)),
    ...(locateImages
      ? {
          async imageRects(index: number, options: EngineCallOptions) {
            const page = pageAt(side, index);
            const located = await locateImages.call(
              engine,
              page.sourceId,
              page.index,
              call(options),
            );
            return located.map((image) => ({ rect: image.bounds }));
          },
        }
      : {}),
  };
}

/** Opens `documentId` for reading: the tab's pages and a lease on the analysis worker. */
export async function openTextSource(
  documentId: DocumentId,
  signal?: AbortSignal,
): Promise<TextSource> {
  const lease = await getAnalysisWorkers().acquire();
  try {
    const engine = await pageEngine();
    const side = await documentPages(documentId, signal ? { signal } : {});
    const convert = convertSourceOf(side, engine);
    let closed = false;
    return {
      pageCount: side.pages.length,
      language: useWorkspaceStore.getState().workspace.documents[documentId]?.metadata.language,
      pageRef(page) {
        const p = pageAt(side, page);
        return {
          sourceId: p.sourceId,
          index: p.index,
          delta: p.delta,
          frame: {
            size: p.size,
            originX: p.origin.x,
            originY: p.origin.y,
            rotation: totalRotation(p),
            intrinsicRotation: p.intrinsic,
            scale: 1,
          },
        };
      },
      style: (callSignal) => lease.proxy.textStyle(convert, { signal: callSignal }),
      blocks: (pages, style, callSignal) =>
        lease.proxy.textBlocks(convert, { pages, style, signal: callSignal }),
      dispose() {
        if (closed) return;
        closed = true;
        lease.release();
        void side.dispose().catch(() => undefined);
      },
    };
  } catch (error) {
    lease.release();
    throw error;
  }
}
