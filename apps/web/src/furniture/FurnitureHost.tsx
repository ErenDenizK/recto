/**
 * Mounts the page furniture sheets (`FurnitureDialogs.tsx`) once one first opens (PF-21,
 * quality-bar Q-11: sheets load on first use); their code loads then, outside the editor's
 * initial bundle. They stay mounted afterwards, so a sheet plays its exit.
 */
import { lazy, Suspense, useState } from 'react';

import { useFurnitureStore } from './furniture-store';

const FurnitureDialogs = lazy(() =>
  import('./FurnitureDialogs').then((module) => ({ default: module.FurnitureDialogs })),
);

export function FurnitureHost() {
  const open = useFurnitureStore((s) => s.dialog !== null);
  const [asked, setAsked] = useState(open);
  if (open && !asked) setAsked(true);
  if (!asked) return null;
  return (
    <Suspense fallback={null}>
      <FurnitureDialogs />
    </Suspense>
  );
}
