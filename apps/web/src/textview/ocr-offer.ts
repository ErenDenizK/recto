/**
 * Recognizing a scanned page from the Text view (EDN-27): what the card says before the run (the
 * languages, from the document's /Lang else the app's language, and what their packs cost to
 * download) and the run itself, which is `ocr/ocr-run.ts` `recognizeAndApply` imported only
 * when the button is pressed. The OCR dialog's own choices stay the defaults: standard quality,
 * existing text kept. The run is one undo step with the dialog's history label.
 */
import type { DocumentId } from '@pdf-editor/document-model';

import { getLocale } from '../i18n';
import { codeOfLocale, defaultLanguages, documentTargets, languageList } from '../ocr/ocr-model';
import { ocrDependencies } from '../ocr/ocr-deps';
import { useWorkspaceStore } from '../state/workspace-store';
import type { OcrOffer, OcrOfferInfo } from './contract';

/** The locale whose language the run reads: the document's /Lang if a pack exists, else the UI's. */
export function ocrLocale(documentLanguage: string | undefined, uiLocale: string): string {
  return documentLanguage !== undefined && codeOfLocale(documentLanguage) !== undefined
    ? documentLanguage
    : uiLocale;
}

export function createOcrOffer(documentId: DocumentId): OcrOffer {
  const document = () => useWorkspaceStore.getState().workspace.documents[documentId];

  async function info(): Promise<OcrOfferInfo> {
    const packs = await (await ocrDependencies().packs()).list();
    const languages = defaultLanguages(
      ocrLocale(document()?.metadata.language, getLocale()),
      packs.map((pack) => pack.code),
    );
    return {
      languages,
      languageLabel: languageList(languages, getLocale()),
      downloadBytes: packs
        .filter((pack) => languages.includes(pack.code))
        .reduce((sum, pack) => sum + pack.downloadBytes, 0),
    };
  }

  return {
    info,
    async run(pages, { signal, onProgress }) {
      const doc = document();
      if (!doc) return false;
      const targets = documentTargets(doc).filter((target) => pages.includes(target.docIndex));
      if (targets.length === 0) return false;
      const { languages } = await info();
      const deps = ocrDependencies();
      const sources = [...new Set(targets.map((target) => target.source))];
      const facts = new Map(
        await Promise.all(sources.map(async (id) => [id, await deps.facts(id)] as const)),
      );
      const { recognizeAndApply } = await import('../ocr/ocr-run');
      const result = await recognizeAndApply(
        { documentId, targets, facts, languages, quality: 'standard', replace: false },
        {
          signal,
          onProgress: (progress) =>
            onProgress(progress.done ?? 0, progress.total ?? targets.length),
        },
      );
      return result !== undefined;
    },
  };
}
