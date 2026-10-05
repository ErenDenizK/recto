/**
 * Mounts the Settings sheet on first use (quality-bar Q-11: sheets load on first use). The
 * shell renders this host once; the sheet's code stays out of the entry chunk until Settings
 * opens, and then stays mounted so it can animate out and in again. Whether it was ever opened
 * is kept for the page's life, so the remount a language change causes shows it at once.
 */
import { lazy, Suspense } from 'react';

import { useSheetOpen, useSheetStore } from '../ui/sheet';
import { SETTINGS_SHEET_ID } from './open-settings';

const SettingsSheet = lazy(() => import('./SettingsSheet'));

let requested = useSheetStore.getState().open?.id === SETTINGS_SHEET_ID;
useSheetStore.subscribe((state) => {
  if (state.open?.id === SETTINGS_SHEET_ID) requested = true;
});

export function SettingsHost() {
  // Re-renders when Settings opens; `requested` then holds.
  const open = useSheetOpen(SETTINGS_SHEET_ID);
  if (!open && !requested) return null;
  return (
    <Suspense fallback={null}>
      <SettingsSheet />
    </Suspense>
  );
}
