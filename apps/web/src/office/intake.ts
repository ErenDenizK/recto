/**
 * Where Office files enter (ADR-0035 §5, §6), the only office code the open path loads: it
 * sorts them out of a pick or a drop and hands them on. Everything heavier (the sheet, the
 * download manager, the converter host) loads when the sheet mounts.
 *
 * - **Full edition** (desktops and tablets, EDN-19): the conversion sheet opens.
 * - **Compact edition** (phones): guidance instead, never a download. LibreOffice reserves
 *   1 GiB before it starts and phones kill such a tab (spike §3).
 * - **Off by default** until phase 2 (`flag.ts`): without the flag nothing here runs, and an
 *   Office file is ignored as it always was.
 */
import { m } from '../i18n';
import { registerServiceWorkerNow } from '../pwa/register';
import { getEdition } from '../shell/frame/edition';
import { toast } from '../ui/Toast/toast';
import { OFFICE_RELOAD_KEY, officeEnabled } from './flag';
import { isOfficeFile } from './office-files';
import { openOffice } from './office-store';

/** Splits off the Office files when the flag is on; `rest` keeps the others in order. */
export function takeOfficeFiles<T extends File>(
  files: readonly T[],
): { readonly office: T[]; readonly rest: T[] } {
  if (!officeEnabled()) return { office: [], rest: [...files] };
  return {
    office: files.filter(isOfficeFile),
    rest: files.filter((file) => !isOfficeFile(file)),
  };
}

/** The phone's answer to an Office file (EDN-19). */
export function showOfficeGuidance(): void {
  toast.info(m.office_phone_guidance(), {
    detail: m.office_phone_guidance_detail(),
    key: 'office-guidance',
  });
}

/** Converts `files` (the full edition) or explains why not (the phone). */
export function offerOfficeFiles(files: readonly File[]): void {
  if (files.length === 0) return;
  if (getEdition() === 'compact') {
    showOfficeGuidance();
    return;
  }
  // Isolating the page needs a controlling worker; do not wait for a page to render (PF-20).
  registerServiceWorkerNow();
  openOffice(files);
}

/**
 * After the reload into isolation, picks the stashed files up again (the app shell calls this
 * once at start). Does nothing on any other load.
 */
export function resumeOfficeAfterReload(): void {
  if (!officeEnabled() || getEdition() === 'compact') return;
  try {
    if (sessionStorage.getItem(OFFICE_RELOAD_KEY) === '1') openOffice([], true);
  } catch {
    // No session storage: no reload was flagged either.
  }
}
