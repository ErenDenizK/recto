/**
 * The compact reader's sheets (ADR-0033 §2.3): Pages (a thumbnail grid to jump), Contents
 * (the file's outline), Go to page, Document info and About. One opens at a time, from the
 * capsule or the ⋯ menu; a jump closes its sheet and lands the page under the top bar.
 *
 * Pages, the capsule's first button, is here; the other four are rarely used and load on
 * demand (`CompactMoreSheets`; phone code audit 2026-10 §4a, the bundle gate PRC-11). Their
 * module is fetched once the browser is idle after the reader opens, and at the latest when ⋯
 * opens or one of them is asked for, and stays mounted from then on, so each later opening
 * rises like the Pages sheet.
 */
import type { VirtualDocument, VirtualPage, Workspace } from '@pdf-editor/document-model';
import { type ComponentType, useEffect, useRef, useState } from 'react';

import { RENDER_PRIORITY } from '../../engine/engine-service';
import { m } from '../../i18n';
import { PageCanvas } from '../../pages/PageCanvas';
import { displaySize, fitInBox } from '../../pages/page-geometry';
import { contentFrame, ResizedContent } from '../../stage/ResizedContent';
import { useViewStore } from '../../state/view-store';
import { useWorkspaceStore } from '../../state/workspace-store';
import { documentLabels } from '../../viewer/navigation';
import { CompactSheet } from './CompactSheet';
import { closeSheet, useCompactStore } from './compact-store';
import styles from './CompactSheets.module.css';
import { jumpTo } from './jump';
import { visibleRange } from './reader-layout';

type MoreSheets = ComponentType<{ readonly doc: VirtualDocument }>;

let moreSheets: Promise<MoreSheets> | undefined;

/** Fetches the on-demand sheets' module once; later calls share the same promise. */
export function loadMoreSheets(): Promise<MoreSheets> {
  moreSheets ??= import('./CompactMoreSheets').then((module) => module.default);
  return moreSheets;
}

/** How long the idle prefetch may wait for an idle moment, ms. */
const PREFETCH_TIMEOUT_MS = 3000;

export function CompactSheets({ doc }: { readonly doc: VirtualDocument }) {
  const sheet = useCompactStore((s) => s.sheet);
  const wanted = useCompactStore((s) => s.menuOpen || (s.sheet !== null && s.sheet !== 'pages'));
  const [More, setMore] = useState<MoreSheets | null>(null);

  // Fetched when the browser is idle after the reader opens, or at once when asked for.
  useEffect(() => {
    if (More) return;
    let live = true;
    const load = () => {
      loadMoreSheets()
        .then((component) => {
          if (live) setMore(() => component);
        })
        .catch(() => {
          // Offline without the chunk (it is precached, PF-17): asking again retries.
          moreSheets = undefined;
        });
    };
    if (wanted) {
      load();
      return () => {
        live = false;
      };
    }
    const idle = typeof window.requestIdleCallback === 'function';
    const handle = idle
      ? window.requestIdleCallback(load, { timeout: PREFETCH_TIMEOUT_MS })
      : window.setTimeout(load, PREFETCH_TIMEOUT_MS);
    return () => {
      live = false;
      if (idle) window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
    };
  }, [More, wanted]);

  return (
    <>
      <CompactSheet
        open={sheet === 'pages'}
        onClose={closeSheet}
        title={m.compact_pages()}
        size="tall"
        testId="compact-pages-sheet"
      >
        <PagesGrid doc={doc} />
      </CompactSheet>
      {More ? <More doc={doc} /> : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

const GRID_PADDING = 8;
const GRID_GAP = 12;
const MIN_CELL = 104;
const THUMB_ASPECT = 1.35;
const LABEL_HEIGHT = 24;

/** A virtualised grid of thumbnails: only the rows near the view are mounted. */
function PagesGrid({ doc }: { readonly doc: VirtualDocument }) {
  const ws = useWorkspaceStore((s) => s.workspace);
  const current = useViewStore((s) => s.currentPage);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ width: 0, height: 0, top: 0 });
  const labels = documentLabels(ws, doc);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const read = () =>
      setView({ width: el.clientWidth, height: el.clientHeight, top: el.scrollTop });
    read();
    const observer = new ResizeObserver(read);
    observer.observe(el);
    el.addEventListener('scroll', read, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener('scroll', read);
    };
  }, []);

  const inner = Math.max(0, view.width - 2 * GRID_PADDING);
  const columns = Math.max(3, Math.floor((inner + GRID_GAP) / (MIN_CELL + GRID_GAP)));
  const cell = Math.max(1, (inner - (columns - 1) * GRID_GAP) / columns);
  const thumb = Math.round(cell * THUMB_ASPECT);
  const rowHeight = thumb + LABEL_HEIGHT + GRID_GAP;
  const rowCount = Math.ceil(doc.pages.length / columns);
  const rowBoxes = Array.from({ length: rowCount }, (_, r) => ({
    top: GRID_PADDING + r * rowHeight,
    left: 0,
    width: inner,
    height: rowHeight,
  }));
  const rows = visibleRange(rowBoxes, view.top, view.height, view.height);

  // Opens on the page being read, centred.
  const centred = useRef(false);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || centred.current || view.width === 0) return;
    centred.current = true;
    const row = Math.floor(current / columns);
    el.scrollTop = Math.max(0, GRID_PADDING + row * rowHeight - (el.clientHeight - rowHeight) / 2);
  }, [view.width, columns, rowHeight, current]);

  const cells = [];
  if (view.width > 0) {
    for (let r = rows.first; r <= rows.last; r++) {
      for (let c = 0; c < columns; c++) {
        const index = r * columns + c;
        const page = doc.pages[index];
        if (!page) break;
        const label = labels[index] ?? String(index + 1);
        cells.push(
          <Thumbnail
            key={page.id}
            ws={ws}
            page={page}
            index={index}
            count={doc.pages.length}
            label={label}
            current={index === current}
            box={{
              left: GRID_PADDING + c * (cell + GRID_GAP),
              top: GRID_PADDING + r * rowHeight,
              width: cell,
              height: thumb,
            }}
            onPick={() => jumpTo(doc, index)}
          />,
        );
      }
    }
  }

  return (
    <div ref={scrollRef} className={styles.gridScroll} data-testid="compact-pages-grid">
      <div
        className={styles.grid}
        role="list"
        style={{ height: GRID_PADDING * 2 + rowCount * rowHeight - GRID_GAP }}
      >
        {cells}
      </div>
    </div>
  );
}

function Thumbnail({
  ws,
  page,
  index,
  count,
  label,
  current,
  box,
  onPick,
}: {
  readonly ws: Workspace;
  readonly page: VirtualPage;
  readonly index: number;
  readonly count: number;
  readonly label: string;
  readonly current: boolean;
  readonly box: { left: number; top: number; width: number; height: number };
  readonly onPick: () => void;
}) {
  const size = displaySize(ws, page);
  const fitted = fitInBox(size, box.width, box.height);
  const frame = contentFrame(ws, page);
  const sourceId = page.ref.kind === 'source' ? page.ref.source : undefined;
  const name =
    label !== String(index + 1)
      ? m.cell_label_with_label({ position: index + 1, label, count })
      : m.cell_label({ position: index + 1, count });
  return (
    <div
      role="listitem"
      className={styles.cell}
      style={{ left: box.left, top: box.top, width: box.width }}
    >
      <button
        type="button"
        className={styles.thumbButton}
        style={{ height: box.height }}
        aria-label={name}
        aria-current={current ? 'page' : undefined}
        data-page-index={index}
        onClick={onPick}
      >
        <span className={styles.thumb} style={{ width: fitted.width, height: fitted.height }}>
          <ResizedContent frame={frame}>
            <PageCanvas
              sourceId={sourceId}
              blobId={page.ref.kind === 'image' ? page.ref.blob : undefined}
              index={page.ref.kind === 'source' ? page.ref.index : 0}
              rotation={page.rotation}
              widthPt={frame?.widthPt ?? size.width}
              heightPt={frame?.heightPt ?? size.height}
              cssWidth={frame ? frame.width * fitted.width : fitted.width}
              priority={RENDER_PRIORITY.visible}
            />
          </ResizedContent>
        </span>
      </button>
      <span className={styles.thumbLabel} aria-hidden="true" data-current={current || undefined}>
        {label}
      </span>
    </div>
  );
}
