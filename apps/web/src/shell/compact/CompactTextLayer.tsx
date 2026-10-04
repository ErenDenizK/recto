/**
 * The compact reader's text layer (ADR-0033 §2.3 "text selection with Copy"): the page's
 * text as transparent spans over the bitmap, built from the same model as the full edition's
 * (`viewer/text-model.ts`, `viewer/text-spans.ts`), so a long press selects words natively
 * and the system's Copy takes the assembled text (`installCopyHandler`, CompactApp). No
 * custom selection bar, no editing entry, no hover outline: reading only.
 *
 * Built for pages within one page of the viewport and dropped beyond three, as in the full
 * edition, so a long document keeps a small DOM.
 */
import type { TextRun } from '@pdf-editor/engine';
import { Fragment, useEffect, useState } from 'react';

import { getEngineService } from '../../engine/engine-service';
import type { PageOverlayProps } from '../../stage/page-overlays';
import { distanceFromView, useViewStore } from '../../state/view-store';
import { pageFrame } from '../../viewer/page-frame';
import {
  layoutTextLines,
  separatorAfter,
  TEXT_LAYER_ATTR,
  TEXT_ROW_ATTR,
} from '../../viewer/text-model';
import styles from '../../viewer/TextLayer.module.css';
import { lineStyle } from '../../viewer/text-spans';

const BUILD_DISTANCE = 1;
const DROP_DISTANCE = 3;

export function CompactTextLayer(props: PageOverlayProps) {
  const { sourceId, sourceIndex, pageIndex } = props;
  const distance = useViewStore((s) => distanceFromView(pageIndex, s.visibleRange));
  const [built, setBuilt] = useState(false);
  const [runs, setRuns] = useState<{ page: string; runs: readonly TextRun[] } | null>(null);
  if (!built && distance <= BUILD_DISTANCE && sourceId !== undefined) setBuilt(true);
  if (built && distance > DROP_DISTANCE) setBuilt(false);
  const page = `${sourceId ?? ''}:${sourceIndex}`;

  useEffect(() => {
    if (!built || sourceId === undefined) return;
    const controller = new AbortController();
    void getEngineService()
      .getPageText(sourceId, sourceIndex, controller.signal)
      .then((result) => {
        if (result.ok) setRuns({ page, runs: result.value });
      });
    return () => controller.abort();
  }, [built, sourceId, sourceIndex, page]);

  if (!built || runs?.page !== page) return null;
  const lines = layoutTextLines(runs.runs, pageFrame(props));
  if (lines.length === 0) return null;
  return (
    <div
      className={styles.layer}
      {...{ [TEXT_LAYER_ATTR]: String(pageIndex) }}
      data-selectable="true"
      data-testid="text-layer"
    >
      {lines.map((line, i) => {
        const separator = separatorAfter(lines, i);
        return (
          <Fragment key={i}>
            <span {...{ [TEXT_ROW_ATTR]: line.row }} style={lineStyle(line)}>
              {line.text}
            </span>
            {separator === '' ? null : <span className={styles.separator}>{separator}</span>}
          </Fragment>
        );
      })}
      <div className={styles.end} aria-hidden="true" />
    </div>
  );
}
