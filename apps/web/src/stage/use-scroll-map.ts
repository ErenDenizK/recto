/**
 * The glass scroll bar's page map for the reader (R29 study, GLS-26 amendment; `?scroll=glass`).
 * With the flag off (`ui/scroll-glass-flag.ts`) it returns nothing and loads nothing; on, it
 * fetches `scroll-map.ts` once and builds the map for the document, with the dragged bubble's
 * words ("4 / 8 | Roll three").
 */
import type { VirtualDocument, Workspace } from '@pdf-editor/document-model';
import { type RefObject, useEffect, useMemo, useState } from 'react';

import { scrollGlassStyle } from '../ui/scroll-glass-flag';
import type { ScrollMap } from '../ui/scroll-thumbs';
import type * as ScrollMapModule from './scroll-map';

export function useScrollMap(
  doc: VirtualDocument,
  ws: Workspace,
  pageAt: RefObject<((scrollTop: number) => number | undefined) | null>,
): { readonly map: ScrollMap; readonly label: (scrollTop: number) => string } | undefined {
  const [module, setModule] = useState<typeof ScrollMapModule | null>(null);
  useEffect(() => {
    if (scrollGlassStyle()) void import('./scroll-map').then(setModule);
  }, []);
  return useMemo(() => {
    if (!module) return undefined;
    const map = module.buildScrollMap(doc, ws, (top) => pageAt.current?.(top));
    const label = (top: number) => {
      const under = map.at(top);
      return under ? module.bubbleText(under.page, map.pages, under.heading) : '';
    };
    return { map, label };
  }, [module, doc, ws, pageAt]);
}
