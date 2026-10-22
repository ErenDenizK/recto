/**
 * Mounts the document-tools sheets (`DocumentSheets.tsx`) once one first opens (PF-21, quality-bar
 * Q-11: sheets load on first use); their code loads then, outside the editor's initial bundle.
 * They stay mounted afterwards, so a sheet plays its exit.
 */
import { createSheetHost } from '../ui/sheet-host';
import { closeDocumentDialog, useDocumentDialogStore } from './document-store';

export const DocumentSheetsHost = createSheetHost(
  () => import('./DocumentSheets').then((module) => ({ default: module.DocumentSheets })),
  () => useDocumentDialogStore((s) => s.dialog !== null),
  closeDocumentDialog,
);
