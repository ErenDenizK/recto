/**
 * The compact edition's side of "where you left off" (R26 concept 4, DSN-66; EDN-10): its zoom,
 * which is relative to fit and lives in `compact-store`, is how `session/resume.ts` reads and sets
 * the phone's zoom, and the reader's scroll is captured just before the Library replaces it. It
 * loads with the compact closure and does nothing until `?home=continue` is on.
 */
import type { DocumentId } from '@pdf-editor/document-model';

import { HOME_CONTINUE_FLAG, homeFlagEnabled } from '../../home/home-flags';
import type { ResumePoint } from '../../session/resume';
import {
  applyResumeZoom,
  captureResume,
  setResumeZoom,
  settleResume,
} from '../../session/resume-view';
import { setZoom, showReader, useCompactStore } from './compact-store';

if (homeFlagEnabled(HOME_CONTINUE_FLAG)) {
  setResumeZoom({
    read: () => ({ zoom: useCompactStore.getState().zoom, fit: null }),
    write: (zoom) => setZoom(zoom),
  });
  // The reader's scroller goes with the place: read it before it unmounts.
  useCompactStore.subscribe((state, previous) => {
    if (previous.place === 'reader' && state.place === 'library') captureResume();
  });
}

/** Back into the open document at its place: the zoom first, then the reader, then the offset. */
export function resumeCompact(id: DocumentId, point: ResumePoint): void {
  applyResumeZoom(point);
  showReader();
  settleResume(id, point);
}
