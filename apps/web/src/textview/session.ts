/**
 * Opens the Text view's data for a tab (EDN-26): the reader of its pages with the analysis
 * lease (`text-source.ts`), the loader that watches the tab for changes, the image crops and the
 * OCR offer. `dispose` ends the loader and with it the lease. Opening is what loads the engine,
 * so the door calls it only once the view is on screen.
 */
import type { DocumentId } from '@pdf-editor/document-model';

import { useWorkspaceStore } from '../state/workspace-store';
import type { ImageCrops, OcrOffer } from './contract';
import { createImageCrops } from './image-crops';
import { createTextViewLoader, type DocumentTextLoader } from './loader';
import { createOcrOffer } from './ocr-offer';
import { openTextSource } from './text-source';

export interface TextViewSession {
  readonly loader: DocumentTextLoader;
  readonly crops: ImageCrops;
  readonly ocr: OcrOffer;
  dispose(): void;
}

/** Calls `onChange` when the tab's document or the engine edits on it change. */
export function watchDocument(documentId: DocumentId, onChange: () => void): () => void {
  let last = useWorkspaceStore.getState().workspace;
  return useWorkspaceStore.subscribe((state) => {
    const now = state.workspace;
    if (
      now.documents[documentId] === last.documents[documentId] &&
      now.engineEdits === last.engineEdits
    ) {
      return;
    }
    last = now;
    onChange();
  });
}

export async function openTextViewSession(
  documentId: DocumentId,
  signal?: AbortSignal,
): Promise<TextViewSession> {
  const first = await openTextSource(documentId, signal);
  const loader = createTextViewLoader(first, {
    reopen: () => openTextSource(documentId),
    watch: (onChange) => watchDocument(documentId, onChange),
  });
  return {
    loader,
    crops: createImageCrops(loader),
    ocr: createOcrOffer(documentId),
    dispose: () => loader.dispose(),
  };
}
