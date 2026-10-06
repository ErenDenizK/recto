/**
 * The `?sample` link at boot (components/02-library.md §11, L10 §6; flows.md §9.2): read once
 * and removed from the address at once (`sample-param.ts`), then the sample opens after the
 * launch's restore. Kept apart from `open-sample.ts` so the compact edition, which opens it in
 * its reader, does not load the full shell's modules.
 */
import { getLocale } from '../i18n/locale';
import { useSessionStore } from '../session/session-store';
import { type SampleLocale, takeSampleParam } from './sample-param';

/** The link's sample, read once per page load: undefined until read, null once handled. */
let linked: SampleLocale | null | undefined;

/** Whether the launch's restore is over (or there is none), so a new tab cannot stop it. */
function launchSettled(): boolean {
  // No session running (a component test): nothing to wait for.
  if (document.documentElement.dataset.session === undefined) return true;
  const { keeping, restoring } = useSessionStore.getState();
  return keeping === 'unavailable' || (keeping === 'available' && !restoring);
}

/**
 * The `?sample` link (L10 §6): reads and removes the parameter at once, then opens the sample
 * after the launch's restore, as one more tab beside the restored documents (a document opened
 * during the restore would stop it: the restore only fills an empty tab). Call it once at
 * boot, after `startSession`; returns a canceller. Calling it again (React's development
 * double mount) waits for the same sample, and the sample opens only once per page load.
 *
 * @param open How the edition opens it: `openSample` in the full edition, the reader's own
 *   open in the compact one.
 */
export function openSampleFromLink(open: (locale: SampleLocale) => Promise<unknown>): () => void {
  if (linked === undefined) linked = takeSampleParam(getLocale());
  if (linked === null) return () => undefined;
  const go = () => {
    const locale = linked;
    linked = null;
    if (locale) void open(locale);
  };
  if (launchSettled()) {
    go();
    return () => undefined;
  }
  const unsubscribe = useSessionStore.subscribe(() => {
    if (!launchSettled()) return;
    unsubscribe();
    go();
  });
  return unsubscribe;
}

/** Forgets that the link was read (tests). */
export function resetSampleLink(): void {
  linked = undefined;
}
