/**
 * The link annotations of a source page, cached (spec §1; LinkLayer.tsx draws them). Apart from
 * the layer so the phone edition's close hook reaches the cache without the layer, which it
 * loads on demand (bundle diet, PRC-11).
 */
import type { SourceId } from '@pdf-editor/document-model';
import type { Annotation, LinkAnnotation } from '@pdf-editor/engine';

import { getEngineService } from '../engine/engine-service';

const MAX_CACHED_PAGES = 300;

const links = new Map<string, Promise<readonly LinkAnnotation[]>>();

function isLink(annotation: Annotation): annotation is LinkAnnotation {
  return annotation.kind === 'link';
}

/** Link annotations of a source page (memoized; failures are not kept). */
export function pageLinks(sourceId: SourceId, index: number): Promise<readonly LinkAnnotation[]> {
  const key = `${sourceId}:${index}`;
  const cached = links.get(key);
  if (cached) return cached;
  const pending = getEngineService()
    .editor()
    .then((editor) => editor.listAnnotations(sourceId, index))
    .then((annotations) => annotations.filter(isLink));
  pending.catch(() => links.delete(key));
  links.set(key, pending);
  if (links.size > MAX_CACHED_PAGES) {
    const oldest = links.keys().next().value;
    if (oldest !== undefined) links.delete(oldest);
  }
  return pending;
}

/** Forgets the cached links of a source (call when it closes; its ids are never reused). */
export function clearLinksForSource(sourceId: SourceId): void {
  const prefix = `${sourceId}:`;
  for (const key of [...links.keys()]) {
    if (key.startsWith(prefix)) links.delete(key);
  }
}
