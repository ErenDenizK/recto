/**
 * The Library (`02-library` L1; the place `destination === 'home'`, code name kept), Home since
 * Colophon (DSN-93): the desk, on every edition that shows this view. It renders `Desk` and
 * nothing else; the Launcher, the card-only Library and the sample card are gone (DSN-93).
 *
 * The view has no glass and no fill of its own; each part takes its tier. Behind the content
 * glows the aura (`Aura.tsx`) in two lobes, laid by the shell fixed to the window behind the
 * stage (`AppShell.tsx`; owner feedback 2026-10-10, R15), and the desk's own beam (`Beam.tsx`).
 * The head row publishes its text-safe rect for the WebGL field (`text-safe.ts`). The view
 * reaches up under the top strip's pieces (owner feedback 2026-10-09, G2), so its scroller runs
 * under them. A file drag over the window lifts the panel and changes Open's label (L9); the
 * document view's overlay is `DropOverlay`.
 *
 * Esc ladder (L1 §6): Esc clears the checks, then leaves Select mode; it never navigates. First
 * focus: Continue when it shows, else Open or drop files (`Desk`). `scroll-padding-bottom` keeps a
 * focused cover clear of the selection bar (A-12).
 *
 * Nothing on the first paint needs the engine, and the early read of Recents and covers
 * (`desk-prefetch.ts`) starts when this module evaluates, not when React asks.
 */
import { useMemo } from 'react';

import { useResumeStore } from '../session/resume';
import { useWorkspaceStore } from '../state/workspace-store';
import { Desk } from './Desk';
import './desk-prefetch';
import { type HomeCardData, homeCards } from './home-cards';
import { useDragFileCount } from './use-drag-file-count';

function useLibraryCards(): HomeCardData[] {
  const workspace = useWorkspaceStore((s) => s.workspace);
  const files = useWorkspaceStore((s) => s.files);
  const colors = useWorkspaceStore((s) => s.documentColors);
  const points = useResumeStore((s) => s.points);
  return useMemo(
    () => homeCards(workspace, files, colors, points),
    [workspace, files, colors, points],
  );
}

export function LibraryView({ dragging }: { readonly dragging: boolean }) {
  const cards = useLibraryCards();
  const dragCount = useDragFileCount(dragging);
  return <Desk cards={cards} dragging={dragging} dragCount={dragCount} />;
}
