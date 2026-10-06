/**
 * The title menu's rows as data (`components/01-frame.md` F5 §5; flows.md §4.6): File ·
 * Pages · Add to pages · Protect · Convert, then Compare with… and Document info…. Each row
 * is a registered command (its title, act and availability come from the registry, so the
 * change guard's reason reads on a dimmed row, ADR-0030) or one of the menu's own actions
 * (Combine, Rotate all ▸).
 *
 * - **Static** (RA-21): rows stay where they are and dim with their reason ("Locked · unlock
 *   first", "Nothing changed since opening"); only the "Remove …" twins of page furniture and
 *   the repair rows appear just while there is something to remove or repair, as before.
 * - **Rows today's app has no command for** (Print…, Share…, Insert pages from file…,
 *   Signatures…, Apply redactions…) are left out until their packages bring them; every
 *   command of the "Document" group that no section names joins the last section, so tools
 *   registered elsewhere still appear.
 * - **Interim tail:** Settings…, Keyboard shortcuts and About Recto close the menu until the
 *   dock's More (D2-2) takes them (`LibraryMenu.tsx`'s `APP_ITEMS`).
 *
 * The labels are the commands' titles (today's words, in both languages); the copy of F5 §5
 * is D4-4's copy-check to apply.
 */
import { getActiveDocument, type PageId } from '@pdf-editor/document-model';

import { openDocuments } from '../../commands/app-commands';
import { type Command, commandRegistry } from '../../commands/registry';
import { pickFiles } from '../../files/open-files';
import { m } from '../../i18n';
import { changeRefusal, refusalReason } from '../../state/guard';
import { useSelectionStore } from '../../state/selection-store';
import { useWorkspaceStore } from '../../state/workspace-store';
import { announce } from '../announcer';

export type TitleMenuEntry =
  | {
      readonly kind: 'command';
      readonly id: string;
      /** The menu's name for it, when shorter than the command's title ("Split…"). */
      readonly label?: () => string;
      /** Shown only while available ("Remove …" when there is something to remove). */
      readonly onlyWhenAvailable?: true;
    }
  | { readonly kind: 'merge' }
  | { readonly kind: 'rotate' };

export type TitleMenuSectionId = 'file' | 'pages' | 'add' | 'protect' | 'convert' | 'document';

export interface TitleMenuSection {
  readonly id: TitleMenuSectionId;
  /** The group's label; the last section has none. */
  readonly label?: () => string;
  readonly entries: readonly TitleMenuEntry[];
}

const command = (
  id: string,
  extra: Omit<Extract<TitleMenuEntry, { kind: 'command' }>, 'kind' | 'id'> = {},
): TitleMenuEntry => ({ kind: 'command', id, ...extra });

const furniture = (id: string): TitleMenuEntry[] => [
  command(id),
  command(`${id}.remove`, { onlyWhenAvailable: true }),
];

/** The sections (F5 §5), in order. */
export const TITLE_MENU_SECTIONS: readonly TitleMenuSection[] = [
  {
    id: 'file',
    label: m.frame_section_file,
    entries: [
      command('file.save'),
      command('file.export'),
      command('file.revert'),
      command('tab.close', { label: m.common_close }),
    ],
  },
  {
    id: 'pages',
    label: m.frame_section_pages,
    entries: [
      { kind: 'merge' },
      command('section.split', { label: m.menu_split }),
      command('section.interleave'),
      { kind: 'rotate' },
      command('pages.crop'),
      command('pages.resize'),
    ],
  },
  {
    id: 'add',
    label: m.menu_section_add,
    entries: [
      ...furniture('document.pageNumbers'),
      ...furniture('document.headerFooter'),
      ...furniture('document.bates'),
      ...furniture('document.watermark'),
    ],
  },
  {
    id: 'protect',
    label: m.frame_section_protect,
    entries: [
      command('document.setPassword'),
      command('document.removePassword', { onlyWhenAvailable: true }),
      command('document.sign'),
      command('redaction.find'),
      command('document.stripMetadata'),
    ],
  },
  {
    id: 'convert',
    label: m.frame_section_convert,
    entries: [
      command('document.ocr'),
      command('document.compress'),
      command('document.exportImages'),
      command('document.exportMarkdown'),
      // Batch moves to ⌘K and the Library's ⋯ with D2-9; here until then.
      command('document.batch'),
    ],
  },
  {
    id: 'document',
    entries: [
      command('mode.compare', { label: m.menu_compare }),
      // "Document info…" is the navigator package's (N1) command; its title is N1's.
      command('document.info'),
      command('outline.addBookmark'),
      command('outline.removeDeadLinks', { onlyWhenAvailable: true }),
      command('document.saveRepaired', { onlyWhenAvailable: true }),
    ],
  },
];

const NAMED = new Set(
  TITLE_MENU_SECTIONS.flatMap((s) =>
    s.entries.flatMap((e) => (e.kind === 'command' ? [e.id] : [])),
  ),
);

/** A row as shown now. */
export interface ShownRow {
  readonly key: string;
  readonly entry: TitleMenuEntry;
  readonly command?: Command;
  readonly label: string;
  readonly enabled: boolean;
  /** Why a dimmed row is dimmed (the guard's or the command's reason). */
  readonly reason?: string | undefined;
}

const activeDocument = () => getActiveDocument(useWorkspaceStore.getState().workspace);

/** The pages "Rotate all" turns: the selected pages of the active document, else all. */
export function rotateScope(): { pages: PageId[]; selected: boolean } {
  const doc = activeDocument();
  if (!doc) return { pages: [], selected: false };
  const { selected } = useSelectionStore.getState();
  const chosen = doc.pages.filter((p) => selected.has(p.id)).map((p) => p.id);
  return chosen.length > 0
    ? { pages: chosen, selected: true }
    : { pages: doc.pages.map((p) => p.id), selected: false };
}

/** The rows of each section as shown now (no empty section, no unavailable "Remove …"). */
export function shownTitleMenu(
  commands: readonly Command[],
): { section: TitleMenuSection; rows: ShownRow[] }[] {
  const group = m.group_document();
  const extra = commands.filter((c) => c.group === group && !NAMED.has(c.id));
  const docCount = useWorkspaceStore.getState().workspace.documentOrder.length;
  return TITLE_MENU_SECTIONS.map((section) => {
    const rows: ShownRow[] = [];
    const all: TitleMenuEntry[] = [
      ...section.entries,
      ...(section.id === 'document' ? extra.map((c) => command(c.id)) : []),
    ];
    for (const entry of all) {
      if (entry.kind === 'merge') {
        rows.push({ key: 'merge', entry, label: m.menu_merge(), enabled: docCount > 0 });
        continue;
      }
      if (entry.kind === 'rotate') {
        // Turning pages is a `pages` act: the guard dims it on a locked document.
        const refusal = changeRefusal(activeDocument()?.id, 'pages');
        const enabled = rotateScope().pages.length > 0 && refusal === undefined;
        const reason = refusal === undefined ? undefined : refusalReason(refusal);
        rows.push({ key: 'rotate', entry, label: m.frame_rotate_all(), enabled, reason });
        continue;
      }
      const registered = commands.find((c) => c.id === entry.id);
      if (!registered) continue;
      const enabled = commandRegistry.isEnabled(registered);
      if (!enabled && entry.onlyWhenAvailable) continue;
      rows.push({
        key: entry.id,
        entry,
        command: registered,
        label: entry.label?.() ?? registered.title,
        enabled,
        reason: enabled ? undefined : commandRegistry.disabledReason(registered),
      });
    }
    return { section, rows };
  }).filter((s) => s.rows.length > 0);
}

/**
 * Combine (today's "Merge files…"): with several documents open, the merge dialog for all of
 * them; with one, a file picker first, then the same dialog (combining always goes through
 * the merge dialog until D2-5's Combine straight into the grid).
 */
export async function mergeFiles(): Promise<void> {
  const count = () => useWorkspaceStore.getState().workspace.documentOrder.length;
  if (count() < 2) {
    const files = await pickFiles('pdf');
    if (files.length === 0) return;
    await openDocuments(files);
  }
  if (count() > 1) await commandRegistry.execute('documents.mergeAll');
}

/** Rotates the scope (selected pages, else all) by `delta` degrees and says so. */
export function rotateDocumentPages(delta: 90 | -90 | 180): void {
  const { pages } = rotateScope();
  if (pages.length === 0) return;
  if (!useWorkspaceStore.getState().rotatePages(pages, delta)) return;
  const count = pages.length;
  announce(
    delta === 180
      ? m.menu_rotated_half({ count })
      : delta > 0
        ? m.announce_rotated_right({ count })
        : m.announce_rotated_left({ count }),
  );
}
