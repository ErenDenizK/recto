/**
 * A page's small thumbnail for Find (R26 concept 3; DSN-65): the sidebar's result group headers
 * and the find map's card show the page a hit is on. The same sheet and canvas as the Pages
 * list (`ThumbnailList`), fitted to a box, so the bitmaps come from the one render cache.
 */
import type { VirtualDocument } from '@pdf-editor/document-model';

import { RENDER_PRIORITY } from '../../engine/engine-service';
import { PageCanvas } from '../../pages/PageCanvas';
import { displaySize, fitInBox } from '../../pages/page-geometry';
import { useWorkspaceStore } from '../../state/workspace-store';
import { contentFrame, ResizedContent } from '../../stage/ResizedContent';
import styles from './FindThumb.module.css';

export function FindThumb({
  doc,
  pageIndex,
  width,
  height,
}: {
  readonly doc: VirtualDocument;
  readonly pageIndex: number;
  /** The box the page is fitted into, CSS px. */
  readonly width: number;
  readonly height: number;
}) {
  'use no memo'; // Static output, cheaper unmemoized (the editor's first load, R26 budget).
  const ws = useWorkspaceStore((s) => s.workspace);
  const page = doc.pages[pageIndex];
  if (!page) return null;
  const size = displaySize(ws, page);
  const box = fitInBox(size, width, height);
  // Resized pages: the bitmap covers the content box, placed as the export draws it.
  const frame = contentFrame(ws, page);
  return (
    <span className={styles.slot} style={{ width, height }} aria-hidden="true">
      <span className={styles.sheet} style={{ width: box.width, height: box.height }}>
        <ResizedContent frame={frame}>
          <PageCanvas
            sourceId={page.ref.kind === 'source' ? page.ref.source : undefined}
            blobId={page.ref.kind === 'image' ? page.ref.blob : undefined}
            index={page.ref.kind === 'source' ? page.ref.index : 0}
            rotation={page.rotation}
            widthPt={frame?.widthPt ?? size.width}
            heightPt={frame?.heightPt ?? size.height}
            cssWidth={box.width * (frame?.width ?? 1)}
            priority={RENDER_PRIORITY.visible}
          />
        </ResizedContent>
      </span>
    </span>
  );
}
