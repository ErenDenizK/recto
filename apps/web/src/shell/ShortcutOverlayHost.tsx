/**
 * Mounts the shortcuts overlay (S22, components/07-sheets.md §23) on first use (quality-bar
 * Q-11: sheets load on first use). The shell renders this host once; the overlay's code, the key
 * map's groups and their strings stay out of the editor's initial bundle (V1-P2) until `?` first
 * opens it, and then it stays mounted so it can animate out and in again. Whether it was ever
 * opened is kept for the page's life, so the remount a language change causes shows it at once.
 */
import { lazy, Suspense } from 'react';

import { useUiStore } from '../state/ui-store';

const ShortcutOverlay = lazy(() =>
  import('./ShortcutOverlay').then((module) => ({ default: module.ShortcutOverlay })),
);

let requested = useUiStore.getState().shortcutsOpen;
useUiStore.subscribe((state) => {
  if (state.shortcutsOpen) requested = true;
});

export function ShortcutOverlayHost() {
  // Re-renders when the overlay opens; `requested` then holds.
  const open = useUiStore((s) => s.shortcutsOpen);
  if (!open && !requested) return null;
  return (
    <Suspense fallback={null}>
      <ShortcutOverlay />
    </Suspense>
  );
}
