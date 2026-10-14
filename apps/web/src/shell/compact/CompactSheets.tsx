/**
 * The compact reader's sheets (ADR-0033 §2.3): Contents (the file's outline), Go to page,
 * Document info and About. One opens at a time, from the capsule's page number or the ⋯ menu;
 * a jump closes its sheet and lands the page under the top bar.
 *
 * Pages is no sheet any more: it is the page overview (MOB-2, `overview-host.tsx`). The four
 * are rarely used and load on demand (`CompactMoreSheets`; phone code audit 2026-10 §4a, the
 * bundle gate PRC-11). Their module is fetched once the browser is idle after the reader
 * opens, and at the latest when ⋯ opens or one of them is asked for, and stays mounted from
 * then on, so each later opening rises at once.
 */
import type { VirtualDocument } from '@pdf-editor/document-model';
import { type ComponentType, useEffect, useState } from 'react';

import { useCompactStore } from './compact-store';

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
  const wanted = useCompactStore((s) => s.menuOpen || s.sheet !== null);
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

  return More ? <More doc={doc} /> : null;
}
