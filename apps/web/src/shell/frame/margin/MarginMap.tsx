/**
 * The margin map (R26 wow concept 7, DSN-72; a prototype behind `?margin=1`): beside the page,
 * on wide windows, the document's outline in plain text on the dark ground. The section being
 * read is bright, the rest dim; a heading is a button that goes there (the sidebar Contents'
 * own jump, `OutlinePanel.goToDestination`, the same data: `doc.outline`).
 *
 * Content is solid, not glass (DSN-2). It keeps 64 px from the page and withdraws (fades) when
 * the margin is too small: a narrow window, zoomed in, a panel taking the room, no outline.
 * It never limits zoom (DSN-60). Updates are one rAF-batched read per scroll, zoom or resize:
 * the pages' boxes are read, nothing is written to the layout, and state is set only when the
 * answer changed. Fades only, under reduced motion too (MOT-4: nothing loops).
 */
import { type PageId, pageDisplaySize } from '@pdf-editor/document-model';
import { useEffect, useMemo, useRef, useState } from 'react';

import { m } from '../../../i18n';
import { useUiStore } from '../../../state/ui-store';
import { useViewStore } from '../../../state/view-store';
import { useActiveDocument, useWorkspaceStore } from '../../../state/workspace-store';
import { goToDestination } from '../../OutlinePanel';
import styles from './MarginMap.module.css';
import {
  currentEntry,
  type MapEntry,
  type MarginPlacement,
  mapEntries,
  placeMargin,
} from './margin-map-model';

/** The reading line sits this far below the free rectangle's top (px). */
const READ_LINE = 48;

interface Measure {
  readonly placement: MarginPlacement | null;
  /** False while withdrawn: the map fades where it stood. */
  readonly shown: boolean;
  readonly current: string | null;
}

function rootPx(name: string): number {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;
}

export default function MarginMap() {
  const doc = useActiveDocument();
  const ws = useWorkspaceStore((s) => s.workspace);
  const entries = useMemo<MapEntry[]>(() => {
    if (!doc) return [];
    const ids = new Map<PageId, number>(doc.pages.map((p, i) => [p.id, i]));
    return mapEntries(
      doc.outline,
      (id) => ids.get(id) ?? -1,
      (i) => {
        const page = doc.pages[i];
        return page ? pageDisplaySize(ws, page).height : 0;
      },
    );
  }, [doc, ws]);

  const [measure, setMeasure] = useState<Measure>({ placement: null, shown: false, current: null });
  const last = useRef(measure);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      const pages = [
        ...document.querySelectorAll<HTMLElement>('[data-read-viewport] [data-page-index]'),
      ];
      let left = Infinity;
      let right = -Infinity;
      const freeTop = rootPx('--free-top');
      const line = freeTop + READ_LINE;
      let page = -1;
      let frac = 0;
      for (const el of pages) {
        const box = el.getBoundingClientRect();
        if (box.width <= 0) continue;
        left = Math.min(left, box.left);
        right = Math.max(right, box.right);
        const index = Number(el.dataset.pageIndex);
        // The page under the line; between pages, the last one above it.
        if (box.top <= line && index >= page) {
          page = index;
          frac = box.height > 0 ? Math.min(1, Math.max(0, (line - box.top) / box.height)) : 0;
        }
      }
      const placement = placeMargin({
        windowWidth: window.innerWidth,
        freeLeft: rootPx('--free-left'),
        freeRight: window.innerWidth - rootPx('--free-right'),
        pages: pages.length > 0 && left < right ? { left, right } : null,
        entries: entries.length,
      });
      const current = page < 0 ? null : (currentEntry(entries, page, frac)?.key ?? null);
      const prev = last.current;
      const shown = placement !== null;
      const kept = placement ?? prev.placement;
      const samePlace =
        kept === prev.placement ||
        (kept !== null &&
          prev.placement !== null &&
          kept.side === prev.placement.side &&
          Math.abs(kept.left - prev.placement.left) < 1 &&
          Math.abs(kept.width - prev.placement.width) < 1);
      if (samePlace && prev.shown === shown && prev.current === current) return;
      last.current = { placement: kept, shown, current };
      setMeasure(last.current);
    };
    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(read);
    };
    schedule();
    document.addEventListener('scroll', schedule, { capture: true, passive: true });
    window.addEventListener('resize', schedule);
    const unsubscribe = useUiStore.subscribe(schedule);
    const unsubscribeView = useViewStore.subscribe(schedule);
    const observer = new ResizeObserver(schedule);
    const viewport = document.querySelector('[data-read-viewport]');
    if (viewport) observer.observe(viewport);
    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      document.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
      unsubscribe();
      unsubscribeView();
      observer.disconnect();
    };
  }, [entries]);

  const currentKey = measure.current;

  // Keep the current heading in sight inside a long list, by the list's own scroll.
  useEffect(() => {
    const list = listRef.current;
    const item = list?.querySelector<HTMLElement>('[aria-current="location"]');
    if (!list || !item) return;
    const top = item.offsetTop - list.offsetTop;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (top + item.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = top + item.offsetHeight - list.clientHeight;
    }
  }, [currentKey]);

  const { placement, shown } = measure;
  if (entries.length === 0 || placement === null) return null;
  return (
    <nav
      className={styles.map}
      aria-label={m.margin_map_label()}
      data-shown={shown ? '' : undefined}
      data-testid="margin-map"
      // A withdrawn map is out of the tab order and the tree, not only transparent.
      inert={!shown}
      style={{ left: placement.left, width: placement.width }}
    >
      <ol ref={listRef} className={styles.list}>
        {entries.map((entry) => (
          <li key={entry.key} className={styles.item}>
            <a
              className={styles.link}
              href={`#page-${entry.pageIndex + 1}`}
              data-level={entry.level}
              aria-current={measure.current === entry.key ? 'location' : undefined}
              onClick={(event) => {
                event.preventDefault();
                goToDestination(entry.destination);
              }}
            >
              {entry.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
