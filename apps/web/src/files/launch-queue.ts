/**
 * "Open with" from the operating system (PRD-31; File Handling API, installed Chromium only).
 *
 * The manifest's `file_handlers` (vite.config.ts) lists Recto beside PDF, Markdown, text and
 * image files once the PWA is installed; choosing it launches the app with those files in
 * `launchQueue`. They go to the same path as a drop (`openDocuments` then `showOpened`) once the
 * launch's session restore is over, with their handles kept for Recents and Save (PDFs only). Firefox and Safari have no
 * `launchQueue`: nothing is installed, nothing is shown. Not a core feature (R12 §9).
 */
import { isImageFile } from './images';
import { isPdfFile, type FileHandleLike, type NamedFile } from './file-filters';
import { rememberFileHandle } from './open-files';
import { isTextFile } from './text-files';
import { whenLaunchSettled } from '../session/session-store';

interface LaunchParams {
  readonly files?: readonly FileHandleLike[];
}
interface LaunchQueueLike {
  setConsumer(consumer: (params: LaunchParams) => void): void;
}

const accepts = (file: NamedFile): boolean =>
  isPdfFile(file) || isImageFile(file) || isTextFile(file);

/** Reads a launch's handles into the files the app opens; unreadable or foreign ones drop out. */
export async function filesFromLaunch(params: LaunchParams): Promise<File[]> {
  const out: File[] = [];
  for (const handle of params.files ?? []) {
    const file = await handle.getFile().catch(() => null);
    if (file === null || !accepts(file)) continue;
    rememberFileHandle(file, handle);
    out.push(file);
  }
  return out;
}

/**
 * Hands every launch's files to `open`. Returns false, and does nothing, where the browser has
 * no `launchQueue`.
 */
export function installLaunchConsumer(open: (files: File[]) => void | Promise<void>): boolean {
  const queue = (window as Window & { launchQueue?: LaunchQueueLike }).launchQueue;
  if (queue === undefined || typeof queue.setConsumer !== 'function') return false;
  queue.setConsumer((params) => {
    const warn = (error: unknown) =>
      console.warn('Open with: could not open the launched files', error);
    filesFromLaunch(params)
      .then((files) => {
        if (files.length === 0) return;
        // After the launch's restore, which would otherwise replace the opened files.
        whenLaunchSettled(() => {
          Promise.resolve(open(files)).catch(warn);
        });
      })
      .catch(warn);
  });
  return true;
}
