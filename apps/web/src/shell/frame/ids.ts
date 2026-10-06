/**
 * Element ids the frame and the stage share (`components/01-frame.md` F4 §8): each tab
 * controls the stage (`aria-controls`), and the stage is named by the active tab
 * (`aria-labelledby`). A module of its own, so the stage, the reader and history's reveal can
 * read them without importing the strip.
 */
export const STAGE_ID = 'stage';

export function tabDomId(documentId: string): string {
  return `tab-${documentId}`;
}

/** The sidebar (▤ `aria-controls`). */
export const SIDEBAR_ID = 'left-panel';
