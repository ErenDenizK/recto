/**
 * The title menu's rows as data (`components/01-frame.md` F5 §5; flows.md §4.6; DSN-47): File ·
 * Pages · Protect · Add to pages · Convert, then Compare with… and Document info…. Each row is a
 * registered command (its title, act and availability come from the registry, so the change
 * guard's reason reads on a dimmed row, ADR-0030) or one of the menu's own actions (Rotate
 * all ▸).
 *
 * - **One place per command** (DSN-46, DSN-47): a row lives here only when no other control on
 *   screen holds it. Save and Close are the strip's own (its Save button, the tab's ✕), so they
 *   show only in the narrow window's bar, which has neither (`narrowOnly`); Sign with
 *   certificate… and Find sensitive data are Markup's (the Sign group, More tools); the
 *   signatures of a signed file are the header's facts row; Add bookmark is the sidebar's
 *   Contents; Settings, Keyboard shortcuts and About are the dock's More and the Library's ⋯
 *   (`docs/design/audit-2026-10-16-menus.md`).
 * - **Static** (RA-21): rows stay where they are and dim with their reason ("Locked · unlock
 *   first", "Nothing changed since opening"); only the "Remove …" twins of page furniture and
 *   the repair rows appear just while there is something to remove or repair, as before.
 * - **Rows today's app has no command for** (Print…, Share…, Apply redactions…) are left out
 *   until their packages bring them; every command of the "Document" group that no section names
 *   and no other home holds joins the last section, so tools registered elsewhere still appear.
 *
 * The labels are the commands' titles (today's words, in both languages).
 */
import { getActiveDocument, type PageId } from '@pdf-editor/document-model';

import { type Command, commandRegistry } from '../../commands/registry';
import { m } from '../../i18n';
import { openOperationDialog } from '../../stage/operation-dialogs-store';
import { changeRefusal, refusalReason } from '../../state/guard';
import { useSelectionStore } from '../../state/selection-store';
import { useWorkspaceStore } from '../../state/workspace-store';
import type { IconName } from '../../ui/Icon';
import { announce } from '../announcer';

export type TitleMenuEntry =
  | {
      readonly kind: 'command';
      readonly id: string;
      /** The menu's name for it, when shorter than the command's title ("Split…"). */
      readonly label?: () => string;
      /** Shown only while available ("Remove …" when there is something to remove). */
      readonly onlyWhenAvailable?: true;
      /** Shown only in the narrow window's bar, which has no Save button and no tabs. */
      readonly narrowOnly?: true;
      /** The menu's own act in place of the command's (the menu's page scope). */
      readonly run?: () => void;
    }
  | { readonly kind: 'rotate' };

export type TitleMenuSectionId = 'file' | 'pages' | 'protect' | 'add' | 'convert' | 'document';

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

/** The sections (F5 §5, DSN-47), in order: the most used first. */
export const TITLE_MENU_SECTIONS: readonly TitleMenuSection[] = [
  {
    id: 'file',
    label: m.frame_section_file,
    entries: [
      command('file.save', { narrowOnly: true }),
      command('file.export'),
      command('file.revert'),
      command('tab.close', { label: m.common_close, narrowOnly: true }),
    ],
  },
  {
    id: 'pages',
    label: m.frame_section_pages,
    entries: [
      // F5 §5's first two rows (MOB-4, MOB-10): files not open are added inside Combine.
      command('pages.insertFromFile'),
      command('documents.mergeAll'),
      command('section.split', { label: m.menu_split }),
      command('section.interleave'),
      { kind: 'rotate' },
      // The document's menu: the selected pages, else the whole document, as Rotate all; never
      // the grid's focused cell (DSN-47: the Pages bar's ⋯ at rest no longer offers these).
      command('pages.crop', { run: () => openPagesSheet('crop') }),
      command('pages.resize', { run: () => openPagesSheet('resize') }),
    ],
  },
  {
    id: 'protect',
    label: m.frame_section_protect,
    entries: [
      command('document.setPassword'),
      command('document.removePassword', { onlyWhenAvailable: true }),
      command('document.stripMetadata'),
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
    id: 'convert',
    label: m.frame_section_convert,
    entries: [
      command('document.compress'),
      command('document.ocr'),
      command('document.exportImages'),
      command('document.exportMarkdown'),
    ],
  },
  {
    id: 'document',
    entries: [
      command('mode.compare', { label: m.menu_compare }),
      // "Document info…" is the navigator package's (N1) command; its title is N1's.
      command('document.info'),
      command('outline.removeDeadLinks', { onlyWhenAvailable: true }),
      command('document.saveRepaired', { onlyWhenAvailable: true }),
    ],
  },
];

/**
 * Commands of the "Document" group that have their home elsewhere (DSN-47), so the last
 * section never takes them in as unnamed tools.
 */
const HOMED_ELSEWHERE = new Set([
  // Markup's Sign group (Certificate…) and More tools (Find sensitive data).
  'document.sign',
  'redaction.find',
  // The header's facts row of a signed file opens S9 Signatures.
  'document.signatures',
  // The sidebar's Contents group has Add bookmark as its icon button (DSN-26).
  'outline.addBookmark',
]);

/**
 * Each row's 16 px glyph (the menu recipe, system-audit-2026-10 §3.6: every row may carry
 * one, and in this menu every row does, so the labels share one edge). A "Remove …" twin
 * takes its row's glyph; a command no section names (a tool registered elsewhere) keeps the
 * glyph's room empty (`rowGlyph`).
 */
const ROW_GLYPHS: Readonly<Record<string, IconName>> = {
  'file.save': 'tray-arrow-down',
  'file.export': 'copy',
  'file.revert': 'arrow-counter-clockwise',
  'tab.close': 'x',
  'pages.insertFromFile': 'files',
  'documents.mergeAll': 'stack',
  'section.split': 'columns',
  'section.interleave': 'rows',
  rotate: 'arrow-clockwise',
  'pages.crop': 'crop',
  'pages.resize': 'arrows-out-simple',
  'document.pageNumbers': 'hash',
  'document.headerFooter': 'text-aa',
  'document.bates': 'list',
  'document.watermark': 'stamp',
  'document.setPassword': 'lock-simple',
  'document.removePassword': 'lock-simple-open',
  'document.stripMetadata': 'eraser',
  'document.ocr': 'scan',
  'document.compress': 'file',
  'document.exportImages': 'image',
  'document.exportMarkdown': 'file-text',
  'mode.compare': 'compare',
  'document.info': 'info',
  'outline.removeDeadLinks': 'link',
  'document.saveRepaired': 'check-circle',
  'edit.redo': 'arrow-u-up-right',
};

/** The glyph of the row `key` (a "Remove …" twin's is its row's), if it has one. */
export function rowGlyph(key: string): IconName | undefined {
  return ROW_GLYPHS[key] ?? ROW_GLYPHS[key.replace(/\.remove$/, '')];
}

const NAMED = new Set([
  ...TITLE_MENU_SECTIONS.flatMap((s) =>
    s.entries.flatMap((e) => (e.kind === 'command' ? [e.id] : [])),
  ),
  ...HOMED_ELSEWHERE,
]);

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

/**
 * The rows of each section as shown now (no empty section, no unavailable "Remove …"); Save and
 * Close only with `narrow`, the narrow window's bar.
 */
export function shownTitleMenu(
  commands: readonly Command[],
  { narrow = false }: { readonly narrow?: boolean } = {},
): { section: TitleMenuSection; rows: ShownRow[] }[] {
  const group = m.group_document();
  const extra = commands.filter((c) => c.group === group && !NAMED.has(c.id));
  return TITLE_MENU_SECTIONS.map((section) => {
    const rows: ShownRow[] = [];
    const all: TitleMenuEntry[] = [
      ...section.entries,
      ...(section.id === 'document' ? extra.map((c) => command(c.id)) : []),
    ];
    for (const entry of all) {
      if (entry.kind === 'rotate') {
        // Turning pages is a `pages` act: the guard dims it on a locked document.
        const refusal = changeRefusal(activeDocument()?.id, 'pages');
        const enabled = rotateScope().pages.length > 0 && refusal === undefined;
        const reason = refusal === undefined ? undefined : refusalReason(refusal);
        rows.push({ key: 'rotate', entry, label: m.frame_rotate_all(), enabled, reason });
        continue;
      }
      if (entry.narrowOnly && !narrow) continue;
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

/** Crop pages… or Resize pages… on the scope: the selected pages, else the whole document. */
export function openPagesSheet(kind: 'crop' | 'resize'): void {
  const doc = activeDocument();
  if (!doc) return;
  const scope = rotateScope();
  openOperationDialog({ kind, documentId: doc.id, pageIds: scope.selected ? scope.pages : [] });
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
