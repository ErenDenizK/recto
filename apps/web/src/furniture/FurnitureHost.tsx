/**
 * Mounts the page furniture sheets (`FurnitureDialogs.tsx`) once one first opens (PF-21,
 * quality-bar Q-11: sheets load on first use); their code loads then, outside the editor's
 * initial bundle. They stay mounted afterwards, so a sheet plays its exit.
 */
import { createSheetHost } from '../ui/sheet-host';
import { closeFurnitureDialog, useFurnitureStore } from './furniture-store';

export const FurnitureHost = createSheetHost(
  () => import('./FurnitureDialogs').then((module) => ({ default: module.FurnitureDialogs })),
  () => useFurnitureStore((s) => s.dialog !== null),
  closeFurnitureDialog,
);
