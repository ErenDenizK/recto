/**
 * "Batch…" opens S21 (`BatchSheet.tsx`; `components/07-sheets.md` §22; spec D2-9): in ⌘K and
 * the Library's ⋯ (02.18), no longer in a document's title menu (a batch never touches the
 * open documents, so it is a tool, not a document command). Available with or without open
 * documents. Under 600 px it is dimmed with "Needs a wider window" (07.Q4, RA-21).
 */
import type { CommandRegistry } from '../commands/registry';
import { m } from '../i18n';
import { openBatchDialog, useBatchStore } from './batch-store';

/** The narrowest window S21 opens in (07.Q4). */
export const BATCH_MIN_WIDTH = 600;

const narrow = () => typeof window !== 'undefined' && window.innerWidth < BATCH_MIN_WIDTH;

export function registerBatchCommands(registry: CommandRegistry): () => void {
  return registry.register({
    id: 'document.batch',
    title: m.cmd_batch(),
    group: m.group_tools(),
    act: null,
    keywords: ['batch', 'recipe', 'many', 'files', 'folder', 'automate', 'bulk', 'zip'],
    when: () => !useBatchStore.getState().open && !narrow(),
    reason: () => (narrow() ? m.batch_needs_wider() : undefined),
    run: () => openBatchDialog(),
  });
}
