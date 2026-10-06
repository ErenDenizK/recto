/**
 * Opening the teaching sample (components/02-library.md §11, L10; flows.md §9.2; redesign
 * D4-2). Three doors lead here: the Library's "Try the sample" (D4-1 calls `openSample`), the
 * palette's "Try the sample" (`registerSampleCommands`) and the `?sample` link
 * (`sample-link.ts`, once per launch, with `openSample`).
 *
 * The sample opens through the same path as a file the person picked (`openFiles`), so it is
 * an ordinary document: viewing, Markup, forms, Edit text, the Pages grid, Save and Save a copy
 * all work on it, and it follows "Open documents locked" (L10 §4). The differences are the ones
 * L10 names: each open is a fresh document from the same bytes ("Recto sample (2)" beside an
 * open first one), it lands on its page in viewing whatever was showing, it says "Opened the
 * sample. Its pages explain what to try", it has no file handle (Save asks where to write), and
 * it joins Recents only once changed (02.14: not here, but the session's close rule,
 * `isSampleFile`). Guard: none.
 */
import type { DocumentId } from '@pdf-editor/document-model';

import { type CommandRegistry, commandRegistry } from '../commands/registry';
import { presentOpenFailures } from '../errors/present';
import { m } from '../i18n';
import { getLocale } from '../i18n/locale';
import { announce } from '../shell/announcer';
import { focusOpenedPage } from '../shell/focus-opened-page';
import { useUiStore } from '../state/ui-store';
import { useWorkspaceStore } from '../state/workspace-store';
import { toast } from '../ui/Toast/toast';
import { fetchSampleBytes, sampleFile } from './sample-file';
import type { SampleLocale } from './sample-param';

export type { SampleLocale } from './sample-param';

/** The sample in the UI's language (L10 §6: "any other value means the UI locale"). */
export function uiSampleLocale(): SampleLocale {
  return getLocale() === 'tr' ? 'tr' : 'en';
}

/** Titles of the open documents, for the "(2)" of a second open. */
function openTitles(): string[] {
  const { documents, documentOrder } = useWorkspaceStore.getState().workspace;
  return documentOrder.flatMap((id) => {
    const doc = documents[id];
    return doc === undefined ? [] : [doc.title];
  });
}

/**
 * Opens a fresh copy of the teaching sample as a new tab, on its page, with the focus on the
 * page; resolves to its document, or undefined when it could not open (a failure toast says
 * why: "The sample needs to load once with a connection" offline before the first load, else
 * "Could not load the sample" or the open's own failure).
 *
 * This is the entry D4-1's Library "Try the sample" (and its ⋯ menu) calls. Call it straight
 * from the click or key; it needs no user activation, so awaiting before it is fine too.
 *
 * @param locale The sample's language; defaults to the UI's.
 */
export async function openSample(
  locale: SampleLocale = uiSampleLocale(),
): Promise<DocumentId | undefined> {
  const before = document.activeElement;
  const loaded = await fetchSampleBytes(locale);
  if (!loaded.ok) {
    toast.failure(loaded.reason === 'offline' ? m.sample_offline() : m.sample_failed(), {
      key: 'sample-failed',
      testId: 'sample-failed',
    });
    return undefined;
  }
  const file = sampleFile(locale, loaded.bytes, openTitles());
  const { opened, skipped } = await useWorkspaceStore.getState().openFiles([file]);
  presentOpenFailures(skipped, 1);
  const id = opened[0]?.documentId;
  if (id === undefined || useWorkspaceStore.getState().workspace.documents[id] === undefined)
    return undefined;
  // On its page in viewing, wherever the person was (the Library, another tab, the grid).
  useWorkspaceStore.getState().setActive(id);
  useUiStore.getState().showSurface('page', id);
  announce(m.sample_announce_opened());
  focusOpenedPage(id, before);
  return id;
}

/** "Try the sample" in the palette (L10 §6: ⌘K "sample"). */
export function registerSampleCommands(registry: CommandRegistry = commandRegistry): () => void {
  return registry.register({
    id: 'file.sample',
    title: m.cmd_try_sample(),
    group: m.group_file(),
    act: null,
    run: () => void openSample(),
  });
}
