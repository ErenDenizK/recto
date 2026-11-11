/**
 * The covers' sizes on Home (DSN-93, `home-recents.html`, `tablet-home.html`): from 1280 px of
 * window a shelf cover stands 224 high and Continue's page is 216 wide, under it 196 and 190.
 * The CSS reads the same breakpoint (`Desk.module.css`); this is for the pages drawn live
 * (`PageThumb`), which need their box in pixels.
 */
import { useSyncExternalStore } from 'react';

/** The window width from which the desktop sizes hold. */
export const WIDE_QUERY = '(min-width: 1280px)';

export interface CoverSizes {
  /** A shelf cover's height. */
  readonly shelf: number;
  /** Continue's page width, and the sample's. */
  readonly hero: number;
  /** The gap between covers on a shelf. */
  readonly gap: number;
}

export const WIDE_COVERS: CoverSizes = { shelf: 224, hero: 216, gap: 44 };
export const NARROW_COVERS: CoverSizes = { shelf: 196, hero: 190, gap: 32 };

function subscribe(listener: () => void): () => void {
  const list = window.matchMedia(WIDE_QUERY);
  list.addEventListener('change', listener);
  return () => list.removeEventListener('change', listener);
}

const wide = (): boolean => window.matchMedia(WIDE_QUERY).matches;

export function useCoverSizes(): CoverSizes {
  return useSyncExternalStore(subscribe, wide, () => true) ? WIDE_COVERS : NARROW_COVERS;
}
