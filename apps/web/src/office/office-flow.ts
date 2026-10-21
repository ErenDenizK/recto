/**
 * The Office conversion flow (ADR-0035 §5), driven by the sheet (`OfficeSheet.tsx`):
 *
 *   checking → consent → downloading → (reloading →) converting → the PDF opens
 *
 * - **Consent** comes only when the package is not on the device; afterwards a dropped file
 *   goes straight to converting, offline too.
 * - **Download** shows its progress and stops on Cancel (the `AbortController` ends the fetch);
 *   what was already checked and stored stays for next time.
 * - **Isolation.** The converter needs a cross-origin-isolated page. When this one is not, the
 *   files are stashed, the service worker is told the package is in, and the page reloads once;
 *   the next load resumes here (`intake.ts`). A second miss is the `isolation` failure.
 * - **Open.** Each PDF is wrapped as `<name>.pdf` and opens
 *   (`openGeneratedPdf`) as a new, unsaved document like Text to PDF (PRD-19): changed from
 *   the start, so closing asks, and not in Recents; then one toast says it was converted with
 *   LibreOffice and asks to check the layout (the
 *   honesty line of spike §4).
 *
 * Its effects go through `OfficeDeps`, so tests run the flow with a fake converter.
 */
import type { DocumentId } from '@pdf-editor/document-model';

import { openGeneratedPdf } from '../files/generated-document';
import { showOpened } from '../home/home-actions';
import { formatNumber, m } from '../i18n';
import { announce } from '../shell/announcer';
import { useWorkspaceStore } from '../state/workspace-store';
import { toast } from '../ui/Toast/toast';
import { createWorkerConverter, type OfficeConverter } from './converter';
import {
  canIsolate,
  isIsolated,
  refreshServiceWorker,
  reloadIntoIsolation,
  stashFiles,
  takeReloadFlag,
  takeStashedFiles,
} from './isolation';
import { failureOf, type OfficeFailure } from './office-error';
import { officeExtension, pdfNameFor } from './office-files';
import { closeOffice, setOfficeStep, useOfficeStore } from './office-store';
import { type InstallOptions, installPackage, isPackageInstalled } from './package-store';
import { packageDownloadBytes } from './package';

export interface OfficeDeps {
  readonly installed: () => Promise<boolean>;
  readonly install: (options: InstallOptions) => Promise<void>;
  readonly downloadBytes: () => number;
  readonly isolated: () => boolean;
  readonly canIsolate: () => boolean;
  readonly refresh: () => Promise<boolean>;
  readonly stash: (files: readonly File[]) => Promise<void>;
  readonly takeStash: () => Promise<File[]>;
  readonly takeReloadFlag: () => boolean;
  readonly reload: () => void;
  readonly converter: () => OfficeConverter;
  /** Opens the converted PDFs through the normal open path. */
  readonly open: (files: readonly File[]) => Promise<void>;
}

let converter: OfficeConverter | null = null;

const defaultDeps: OfficeDeps = {
  installed: isPackageInstalled,
  install: installPackage,
  downloadBytes: () => packageDownloadBytes(),
  isolated: isIsolated,
  canIsolate,
  refresh: () => refreshServiceWorker(),
  stash: stashFiles,
  takeStash: takeStashedFiles,
  takeReloadFlag,
  reload: reloadIntoIsolation,
  converter: () => {
    converter ??= createWorkerConverter();
    return converter;
  },
  open: async (files) => {
    const wasEmpty = useWorkspaceStore.getState().workspace.documentOrder.length === 0;
    const ids: DocumentId[] = [];
    for (const file of files) {
      const id = await openGeneratedPdf(file);
      if (id !== undefined) ids.push(id);
      else toast.failure(m.office_failed_convert({ name: file.name }));
    }
    showOpened(ids, { wasEmpty });
  },
};

let deps: OfficeDeps = defaultDeps;

/** Replaces some effects (tests); `undefined` restores the real ones. */
export function setOfficeDeps(overrides: Partial<OfficeDeps> | undefined): void {
  deps = overrides === undefined ? defaultDeps : { ...defaultDeps, ...overrides };
}

let download: AbortController | null = null;
/** Bumped by every start and cancel, so a stale run never moves the sheet. */
let run = 0;

const current = (token: number) => token === run && useOfficeStore.getState().files !== null;

function fail(reason: OfficeFailure, name?: string): void {
  const retry =
    reason === 'network' || reason === 'corrupt' || reason === 'quota'
      ? 'download'
      : reason === 'convert' || reason === 'timeout'
        ? 'convert'
        : null;
  setOfficeStep({ kind: 'failed', reason, name, retry });
}

/** The sheet opened: resume after a reload, then ask, or convert straight away. */
export async function beginOffice(): Promise<void> {
  const token = ++run;
  const state = useOfficeStore.getState();
  let files = state.files ?? [];
  let reloaded = false;
  if (state.resume) {
    reloaded = deps.takeReloadFlag();
    files = await deps.takeStash();
    if (!current(token)) return;
    if (files.length === 0) {
      closeOffice();
      return;
    }
    useOfficeStore.setState({ files, resume: false });
  }
  if (!(await deps.installed())) {
    if (current(token)) setOfficeStep({ kind: 'consent', downloadBytes: deps.downloadBytes() });
    return;
  }
  if (current(token)) await convertFiles(files, reloaded, token);
}

/** Download (the consent's primary, or "Try again" after a failed download). */
export async function acceptDownload(): Promise<void> {
  const token = ++run;
  const files = useOfficeStore.getState().files ?? [];
  download?.abort();
  const controller = new AbortController();
  download = controller;
  const total = deps.downloadBytes();
  setOfficeStep({ kind: 'downloading', loaded: 0, total });
  try {
    await deps.install({
      signal: controller.signal,
      onProgress: ({ loaded, total: all }) => {
        if (current(token)) setOfficeStep({ kind: 'downloading', loaded, total: all });
      },
    });
  } catch (error) {
    const reason = failureOf(error);
    if (reason !== 'aborted' && current(token)) fail(reason);
    return;
  } finally {
    if (download === controller) download = null;
  }
  if (!current(token)) return;
  await deps.refresh();
  if (current(token)) await convertFiles(files, false, token);
}

/** "Try again" after a failed conversion. */
export async function retryConversion(): Promise<void> {
  const token = ++run;
  await convertFiles(useOfficeStore.getState().files ?? [], false, token);
}

/** Cancel (the download's, or the consent's): stops the download and closes the sheet. */
export function cancelOffice(): void {
  const downloading = download !== null;
  run += 1;
  download?.abort();
  download = null;
  closeOffice();
  if (downloading) announce(m.office_announce_cancelled());
}

async function convertFiles(files: readonly File[], reloaded: boolean, token: number) {
  if (!deps.isolated()) {
    if (reloaded || !deps.canIsolate()) {
      fail('isolation');
      return;
    }
    setOfficeStep({ kind: 'reloading' });
    await deps.refresh();
    await deps.stash(files);
    if (current(token)) deps.reload();
    return;
  }
  const engine = deps.converter();
  const pdfs: File[] = [];
  for (const [index, file] of files.entries()) {
    const ext = officeExtension(file.name);
    if (ext === undefined) continue;
    const step = { kind: 'converting', name: file.name, index, count: files.length } as const;
    setOfficeStep({ ...step, phase: 'starting', percent: null });
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pdf = await engine.convert(bytes, ext, ({ phase, percent }) => {
        if (current(token)) setOfficeStep({ ...step, phase, percent });
      });
      pdfs.push(
        new File([pdf as Uint8Array<ArrayBuffer>], pdfNameFor(file.name), {
          type: 'application/pdf',
        }),
      );
    } catch (error) {
      if (!current(token)) return;
      const reason = failureOf(error);
      // What converted before this file still opens.
      if (pdfs.length > 0) await deps.open(pdfs);
      fail(reason === 'aborted' ? 'convert' : reason, file.name);
      return;
    }
    if (!current(token)) return;
  }
  closeOffice();
  await deps.open(pdfs);
  const [first] = pdfs;
  if (first !== undefined) {
    const name =
      pdfs.length === 1 ? first.name : m.office_files_many({ count: formatNumber(pdfs.length) });
    toast.info(m.office_converted({ name }), { key: 'office-converted' });
  }
}
