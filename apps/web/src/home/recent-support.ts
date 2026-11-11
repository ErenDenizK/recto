/**
 * What the Home's shelves share about Recents (`02-library` L7, DSN-93): the clock that moves
 * "5 minutes ago" on, the files open right now (Recents does not repeat them), Clear recents with
 * its confirmation, and the quiet hint a kept or unreachable entry carries.
 */
import type { SourceId } from '@pdf-editor/document-model';
import { useEffect, useMemo, useState } from 'react';

import { clearRecentFiles } from '../commands/app-commands';
import { canReopenRecent, type RecentEntry } from '../files/recents';
import { m } from '../i18n';
import { useWorkspaceStore } from '../state/workspace-store';
import { confirm } from '../ui/sheet';

/** The current time, refreshed every minute while mounted ("5 minutes ago" moves on). */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

/** Name and size of each file open right now, so Recents does not repeat a card. */
export function useOpenFiles(): readonly { readonly name: string; readonly size: number }[] {
  const workspace = useWorkspaceStore((s) => s.workspace);
  const files = useWorkspaceStore((s) => s.files);
  return useMemo(() => {
    const sources = new Set<SourceId>();
    for (const id of workspace.documentOrder) {
      for (const page of workspace.documents[id]?.pages ?? []) {
        if (page.ref.kind === 'source') sources.add(page.ref.source);
      }
    }
    return [...sources].flatMap((id) => {
      const file = files[id];
      return file === undefined ? [] : [{ name: file.name, size: file.size }];
    });
  }, [workspace, files]);
}

/**
 * Clear recents (L7 §6): with kept changes on the list, the confirmation first, since Clear
 * deletes them from this device; without, at once.
 */
export async function clearWithConfirm(entries: readonly RecentEntry[]): Promise<void> {
  const changed = entries.filter((e) => e.kept?.changed === true).length;
  if (changed > 0) {
    const ok = await confirm({
      title: m.recents_clear_confirm_title(),
      body: m.recents_clear_confirm_body({ count: changed }),
      action: m.recents_clear_confirm_action(),
      danger: true,
      glyph: 'trash',
    });
    if (!ok) return;
  }
  await clearRecentFiles();
}

/** The quiet hint a tile carries: kept changes, permission to ask for, or the file dialog. */
export function recentHint(entry: RecentEntry, access: string | undefined): string | undefined {
  // A kept snapshot reopens by itself on every browser (ADR-0032 §2.6).
  if (entry.kept !== undefined) return entry.kept.changed ? m.recents_hint_kept() : undefined;
  if (!canReopenRecent(entry) || access === 'unavailable') return m.recents_hint_open_again();
  if (access === 'prompt') return m.recents_hint_permission();
  return undefined;
}
