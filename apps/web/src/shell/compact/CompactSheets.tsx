/**
 * The compact reader's sheets (ADR-0033 §2.3; DSN-53): Contents (the file's outline), Go to
 * page, Document info, Settings, a note and the password prompt. One opens at a time, from the
 * capsule's page number, the title menu or a note; a jump closes its sheet and lands the page
 * under the top bar. The Library mounts them too, without a document, for Settings behind its
 * gear (DSN-51) and the password a file it opens may ask for.
 *
 * Pages is no sheet any more: it is the page overview (MOB-2, `overview-host.tsx`). The four
 * are rarely used and load on demand (`CompactMoreSheets`; phone code audit 2026-10 §4a, the
 * bundle gate PRC-11). Their module is fetched on intent (EDN-25, never on idle): at the pointerdown on
 * the page number or the Library's gear, and at the latest when ⋯ opens or one of them is asked
 * for. It stays mounted from then on, so each later opening rises at once.
 */
import type { VirtualDocument } from '@pdf-editor/document-model';
import { type ComponentType, useEffect, useState } from 'react';

import { usePasswordStore } from '../../state/password-store';
import { useCompactStore } from './compact-store';

type MoreSheets = ComponentType<{ readonly doc?: VirtualDocument | undefined }>;

let moreSheets: Promise<MoreSheets> | undefined;

/** Fetches the on-demand sheets' module once; later calls share the same promise. */
export function loadMoreSheets(): Promise<MoreSheets> {
  moreSheets ??= import('./CompactMoreSheets').then(
    (module) => module.default,
    (error: unknown) => {
      // Offline without the chunk (it is precached, PF-17): asking again retries.
      moreSheets = undefined;
      throw error;
    },
  );
  return moreSheets;
}

/** `doc` is the reader's document; the Library, with none, gets Settings alone (DSN-51). */
export function CompactSheets({ doc }: { readonly doc?: VirtualDocument | undefined }) {
  const asked = useCompactStore((s) => s.menuOpen || s.sheet !== null);
  const wanted = usePasswordStore((s) => s.queue.length > 0) || asked;
  const [More, setMore] = useState<MoreSheets | null>(null);

  // Fetched when asked for (EDN-25): ⋯, a sheet or a password prompt.
  useEffect(() => {
    if (More || !wanted) return;
    let live = true;
    loadMoreSheets()
      .then((component) => {
        if (live) setMore(() => component);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [More, wanted]);

  return More ? <More doc={doc} /> : null;
}
