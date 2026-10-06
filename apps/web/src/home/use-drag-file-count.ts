/**
 * How many files a desktop drag carries, for "Drop to open 2 files" (`02-library` L9 §4: the
 * count when `items.length` is known, else "Drop to open"). Browsers expose the drag's items
 * (kind and type, not the contents) during `dragenter`, so one capture listener on the
 * document reads them; the shell's own drop handling (`AppShell`, the depth counter) is left as
 * it is. Undefined while no file drag is known or when the browser hides the items.
 */
import { useEffect, useState } from 'react';

import { dragHasFiles } from '../files/open-files';

/** Files in a drag's item list; undefined when the list is empty (the browser hides it). */
export function draggedFileCount(data: DataTransfer | null): number | undefined {
  if (!data || !dragHasFiles(data)) return undefined;
  const count = Array.from(data.items ?? []).filter((item) => item.kind === 'file').length;
  return count > 0 ? count : undefined;
}

/** The count of the file drag in progress while `dragging` is on (see the module comment). */
export function useDragFileCount(dragging: boolean): number | undefined {
  const [count, setCount] = useState<number | undefined>(undefined);
  useEffect(() => {
    const onEnter = (event: DragEvent) => {
      const next = draggedFileCount(event.dataTransfer);
      if (next !== undefined) setCount(next);
    };
    // A drag that drops or leaves the window forgets its count, so the next starts unknown.
    const onEnd = (event: DragEvent) => {
      if (event.type === 'drop' || event.relatedTarget === null) setCount(undefined);
    };
    document.addEventListener('dragenter', onEnter, true);
    document.addEventListener('dragleave', onEnd, true);
    document.addEventListener('drop', onEnd, true);
    return () => {
      document.removeEventListener('dragenter', onEnter, true);
      document.removeEventListener('dragleave', onEnd, true);
      document.removeEventListener('drop', onEnd, true);
    };
  }, []);
  return dragging ? count : undefined;
}
