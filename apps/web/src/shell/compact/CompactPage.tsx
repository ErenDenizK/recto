/**
 * One page of the compact reader: the engine's bitmap at the page's exact device scale (as
 * Read mode draws it) within a phone's budget (`COMPACT_BITMAP_PIXELS`), exact tiles over the
 * visible page above it, and the reading layers: text (long-press
 * selection), Find hits, links and notes. Forms, annotations and signatures are in the
 * bitmap and take no input; nothing here edits the file.
 *
 * A resized or cropped page (only a document restored with changes has one) places its
 * content box as the export does (`ResizedContent`), drawn at a shared scale.
 */
import {
  pageTotalRotation,
  type Size,
  type VirtualDocument,
  type VirtualPage,
  type Workspace,
} from '@pdf-editor/document-model';

import { COMPACT_BITMAP_PIXELS, RENDER_PRIORITY } from '../../engine/engine-service';
import { m } from '../../i18n';
import { PageCanvas } from '../../pages/PageCanvas';
import { rotationPhrase } from '../../pages/page-geometry';
import { needsTiles, TiledPage } from '../../pages/TiledPage';
import type { PageOverlayProps } from '../../stage/page-overlays';
import { contentFrame, ResizedContent } from '../../stage/ResizedContent';
import { LinkLayer } from '../../viewer/LinkLayer';
import { pageFrame } from '../../viewer/page-frame';
import { SearchHighlights } from '../../viewer/SearchHighlights';
import { CompactTextLayer } from './CompactTextLayer';
import styles from './CompactReader.module.css';
import { NoteLayer } from './NoteLayer';
import type { PageBox } from './reader-layout';

/** Debounce before a zoom change asks for sharper bitmaps (as Read mode). */
const ZOOM_RENDER_DELAY_MS = 160;
/** Tiles prepared this far (CSS px) beyond the screen: a short flick's worth on a phone. */
const TILE_MARGIN_PX = 64;

export function CompactPage({
  ws,
  doc,
  page,
  index,
  size,
  box,
  scale,
  visible,
  label,
}: {
  readonly ws: Workspace;
  readonly doc: VirtualDocument;
  readonly page: VirtualPage;
  readonly index: number;
  /** Displayed size in points. */
  readonly size: Size;
  readonly box: PageBox;
  /** CSS px per point. */
  readonly scale: number;
  /** Intersects the viewport (not only the overscan). */
  readonly visible: boolean;
  /** The page's own label when it differs from its number. */
  readonly label: string | undefined;
}) {
  const sourceId = page.ref.kind === 'source' ? page.ref.source : undefined;
  const sourceIndex = page.ref.kind === 'source' ? page.ref.index : 0;
  const total = pageTotalRotation(ws, page);
  const frame = contentFrame(ws, page);
  const contentPt = frame ? { width: frame.widthPt, height: frame.heightPt } : size;
  const contentWidth = frame ? frame.width * box.width : box.width;
  const contentScale = contentWidth / Math.max(1e-6, contentPt.width);
  const tiled =
    sourceId !== undefined &&
    visible &&
    frame === undefined &&
    needsTiles(contentScale, contentPt.width, contentPt.height, COMPACT_BITMAP_PIXELS);
  const name = `${m.cell_label({ position: index + 1, count: doc.pages.length })}${rotationPhrase(total)}`;
  const overlay: PageOverlayProps = {
    page,
    pageId: page.id,
    pageIndex: index,
    sourceId,
    sourceIndex,
    sizePt: size,
    cssScale: scale,
    rotation: total,
    visible,
  };
  return (
    <div
      role={sourceId === undefined ? 'img' : 'region'}
      aria-label={label === undefined ? name : `${name} (${m.viewer_page_label({ label })})`}
      className={styles.page}
      data-page-id={page.id}
      data-page-index={index}
      style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
    >
      <ResizedContent frame={frame}>
        <PageCanvas
          sourceId={sourceId}
          blobId={page.ref.kind === 'image' ? page.ref.blob : undefined}
          index={sourceIndex}
          rotation={page.rotation}
          widthPt={contentPt.width}
          heightPt={contentPt.height}
          cssWidth={contentWidth}
          exact={frame === undefined}
          priority={visible ? RENDER_PRIORITY.page : RENDER_PRIORITY.offscreen}
          delayMs={ZOOM_RENDER_DELAY_MS}
          maxPixels={COMPACT_BITMAP_PIXELS}
        />
        {tiled && sourceId !== undefined ? (
          <TiledPage
            sourceId={sourceId}
            index={sourceIndex}
            rotation={page.rotation}
            frame={pageFrame({
              sourceId,
              sourceIndex,
              sizePt: contentPt,
              rotation: total,
              cssScale: contentScale,
            })}
            marginPx={TILE_MARGIN_PX}
          />
        ) : null}
      </ResizedContent>
      <div className="page-overlays" data-page-overlays>
        <CompactTextLayer {...overlay} />
        <SearchHighlights {...overlay} />
        <LinkLayer {...overlay} />
        <NoteLayer {...overlay} />
      </div>
    </div>
  );
}
