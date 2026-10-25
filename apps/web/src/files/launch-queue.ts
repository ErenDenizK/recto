/**
 * "Open with" from the operating system (PRD-31; File Handling API, installed Chromium only).
 *
 * The manifest's `file_handlers` (vite.config.ts) lists Recto beside PDF, Markdown, text and
 * image files once the PWA is installed; choosing it launches the app with those files in
 * `launchQueue`. They go to the same path as a drop (`openDocuments` then `showOpened`), with
 * their handles kept for Recents and Save. Firefox and Safari have no `launchQueue`: nothing is
 * installed, nothing is shown. Not a core feature (R12 §9).
 */
import { isImageFile } from './images';
import { isPdfFile, type FileHandleLike, type NamedFile } from './file-filters';
import { rememberFileHandle } from './open-files';
import { isTextFile } from './text-files';

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
    void filesFromLaunch(params).then((files) => (files.length > 0 ? open(files) : undefined));
  });
  return true;
}
