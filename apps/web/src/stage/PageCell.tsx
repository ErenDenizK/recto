/**
 * One Pages grid cell (`components/06-navigation.md` PG4, §2.2): the page, its label, and the
 * marks. Props are primitives so `memo` skips every cell a model change does not affect (a drop
 * re-renders only the affected cells); selection, drag and clipboard state come from per-cell
 * store selectors for the same reason.
 *
 * - **Marks** (§2.2; owner feedback F4): the page that was current on the page view has its
 *   label at 600 and a 1 px neutral ring 3 px out (`aria-current="page"`); a selected page a
 *   2 px `--select` ring 2 px out and a filled check badge inside the thumbnail's top-trailing
 *   corner, never colour alone (A-19), and no wash over the page. In selection mode every other
 *   cell shows the empty check circle in that place, and a fine pointer's hover shows it outside
 *   the mode, where a click on it starts selecting (ArrangeView.tsx). The focus ring takes the
 *   gap form outside the cell, on keyboard focus only (ArrangeView.module.css).
 * - **No hover actions** (06.10, baseline V10): their 20 px rotate and delete failed touch and
 *   A-15; the Pages bar and the cell menu carry them.
 * - **Rotate** turns the page on a spring through its quarter turn (`grid/rotate-motion.ts`).
 * - The mouse drags on the native path (`dnd/page-drag.ts`); touch and pen on the grid's
 *   pointer path after a lift (`grid/grid-pointer-drag.ts`).
 */
import type { BlobId, DocumentId, PageId, Rotation, SourceId } from '@pdf-editor/document-model';
import {
  memo,
  Profiler,
  type ProfilerOnRenderCallback,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react';

import { useDragSession } from '../dnd/drag-store';
import { attachPageDrag } from '../dnd/page-drag';
import { RENDER_PRIORITY } from '../engine/engine-service';
import { m } from '../i18n';
import { PageCanvas } from '../pages/PageCanvas';
import { rotationPhrase } from '../pages/page-geometry';
import { announce } from '../shell/announcer';
import { changeRefusal, refusalReason } from '../state/guard';
import { useSelectionStore } from '../state/selection-store';
import { CheckBadge } from '../ui/CheckBadge';
import { Icon } from '../ui/Icon';
import styles from './ArrangeView.module.css';
import { showGridLockNotice } from './grid/grid-lock-notice';
import { spinSheet, turnBetween } from './grid/rotate-motion';
import { ResizedContent } from './ResizedContent';

export interface PageCellProps {
  readonly pageId: PageId;
  readonly documentId: DocumentId;
  readonly index: number;
  readonly count: number;
  readonly column: number;
  readonly label: string;
  readonly sourceId: SourceId | undefined;
  readonly sourceIndex: number;
  /** Image pages: the blob the page shows. */
  readonly blobId?: BlobId | undefined;
  readonly sourceName: string | undefined;
  readonly colorIndex: number;
  /** VirtualPage.rotation (on top of the intrinsic /Rotate). */
  readonly rotation: Rotation;
  /** Total displayed rotation, for the label. */
  readonly totalRotation: number;
  readonly widthPt: number;
  readonly heightPt: number;
  /**
   * Resized pages (ResizedContent.tsx): the content box as fractions of the sheet, and the
   * content's displayed size in points. Undefined when the page is not resized.
   */
  readonly contentLeft?: number | undefined;
  readonly contentTop?: number | undefined;
  readonly contentWidth?: number | undefined;
  readonly contentHeight?: number | undefined;
  readonly contentWidthPt?: number | undefined;
  readonly contentHeightPt?: number | undefined;
  readonly thumbWidth: number;
  readonly thumbHeight: number;
  readonly cellWidth: number;
  readonly boxHeight: number;
  readonly outlined: boolean;
  readonly tabbable: boolean;
  /** The page that was current on the page view (the lime ring). */
  readonly current?: boolean | undefined;
  /** Split's preview: the part this page starts (2-based) and how many parts (S13). */
  readonly cutPart?: number | undefined;
  readonly parts?: number | undefined;
  readonly visible: boolean;
}

/** Cell render counts in development (profiling hook for tests and perf checks). */
export const cellRenderStats = { renders: 0, byPage: new Map<string, number>() };

const onCellRender: ProfilerOnRenderCallback = (id, phase) => {
  if (phase === 'nested-update') return;
  cellRenderStats.renders += 1;
  cellRenderStats.byPage.set(id, (cellRenderStats.byPage.get(id) ?? 0) + 1);
};

function Profiled({ id, children }: { readonly id: string; readonly children: ReactNode }) {
  return import.meta.env.DEV ? (
    <Profiler id={id} onRender={onCellRender}>
      {children}
    </Profiler>
  ) : (
    children
  );
}

export const PageCell = memo(function PageCell(props: PageCellProps) {
  return (
    <Profiled id={props.pageId}>
      <PageCellInner {...props} />
    </Profiled>
  );
});

function PageCellInner({
  pageId,
  documentId,
  index,
  count,
  column,
  label,
  sourceId,
  sourceIndex,
  blobId,
  sourceName,
  colorIndex,
  rotation,
  totalRotation,
  widthPt,
  heightPt,
  contentLeft,
  contentTop,
  contentWidth,
  contentHeight,
  contentWidthPt,
  contentHeightPt,
  thumbWidth,
  thumbHeight,
  cellWidth,
  boxHeight,
  outlined,
  tabbable,
  current = false,
  cutPart,
  parts,
  visible,
}: PageCellProps) {
  const ref = useRef<HTMLDivElement>(null);
  const selected = useSelectionStore((s) => s.selected.has(pageId));
  const focused = useSelectionStore((s) => s.focused === pageId);
  const cut = useSelectionStore(
    (s) => s.clipboard?.mode === 'cut' && s.clipboard.pageIds.includes(pageId),
  );
  const dragging = useDragSession((s) => s.session?.pageIds.has(pageId) ?? false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const shown = useRef({ rotation, width: thumbWidth, height: thumbHeight });

  // Rotate turns the page on a spring (grid/rotate-motion.ts): before paint, while the canvas
  // still holds the old bitmap (PageCanvas clears it in its passive effect).
  useLayoutEffect(() => {
    const was = shown.current;
    shown.current = { rotation, width: thumbWidth, height: thumbHeight };
    if (was.rotation !== rotation && sheetRef.current) {
      spinSheet(sheetRef.current, turnBetween(was.rotation, rotation), was);
    }
  }, [rotation, thumbWidth, thumbHeight]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // The guard at the lift (§2.4): a locked document lifts nothing and says why at the cell.
    return attachPageDrag(el, pageId, () => {
      const refusal = changeRefusal(documentId, 'pages');
      if (!refusal) return true;
      const reason = refusalReason(refusal);
      announce(reason);
      showGridLockNotice(el, reason);
      return false;
    });
  }, [pageId, documentId]);

  const frame =
    contentLeft === undefined ||
    contentTop === undefined ||
    contentWidth === undefined ||
    contentHeight === undefined
      ? undefined
      : { left: contentLeft, top: contentTop, width: contentWidth, height: contentHeight };

  const position = String(index + 1);
  const name = `${
    label === position
      ? m.cell_label({ position, count })
      : m.cell_label_with_label({ position, label, count })
  }${sourceName ? m.cell_from({ name: sourceName }) : ''}${rotationPhrase(totalRotation)}${
    outlined ? m.cell_bookmarked() : ''
  }`;

  return (
    <div
      ref={ref}
      role="gridcell"
      aria-colindex={column + 1}
      aria-selected={selected}
      aria-current={current ? 'page' : undefined}
      aria-label={name}
      tabIndex={tabbable ? 0 : -1}
      data-page-id={pageId}
      data-document-id={documentId}
      data-focused={focused || undefined}
      data-dragging={dragging || undefined}
      data-cut={cut || undefined}
      data-current={current || undefined}
      data-tag={colorIndex}
      className={styles.cell}
      style={{ width: cellWidth }}
    >
      {cutPart !== undefined && parts !== undefined ? (
        <span className={styles.cut} style={{ height: boxHeight }} aria-hidden="true">
          <span className={styles.cutLabel}>{m.split_part_label({ part: cutPart, parts })}</span>
        </span>
      ) : null}
      <div className={styles.box} style={{ height: boxHeight }}>
        <div
          ref={sheetRef}
          className={styles.thumbSheet}
          data-thumb=""
          style={{ width: thumbWidth, height: thumbHeight }}
        >
          <ResizedContent frame={frame}>
            <PageCanvas
              sourceId={sourceId}
              blobId={blobId}
              index={sourceIndex}
              rotation={rotation}
              widthPt={frame ? (contentWidthPt ?? widthPt) : widthPt}
              heightPt={frame ? (contentHeightPt ?? heightPt) : heightPt}
              cssWidth={frame ? thumbWidth * frame.width : thumbWidth}
              priority={visible ? RENDER_PRIORITY.visible : RENDER_PRIORITY.offscreen}
            />
          </ResizedContent>
          {/* The check circle (§2.2): empty, or filled when selected; the cell carries the state
              (`aria-selected`), and Space is its key. */}
          <CheckBadge checked={selected} className={styles.check} data-select-toggle="" />
        </div>
      </div>
      <div className={styles.meta} aria-hidden="true">
        <span className={styles.label}>{label}</span>
        {outlined ? <Icon name="bookmark-simple" className={styles.outlineGlyph} /> : null}
      </div>
    </div>
  );
}
