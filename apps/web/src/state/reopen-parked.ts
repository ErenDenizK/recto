/**
 * A parked source is back in the workspace (undo of a close, PF-18): opens it in the engine and
 * has the edit runner replay its edits. Loaded on demand, only when a close is undone. The job
 * capsule shows after its 400 ms gate.
 */
import type { SourceId } from '@pdf-editor/document-model';

import { getEngineService } from '../engine/engine-service';
import { m } from '../i18n';
import { startJob } from '../jobs/job-store';
import { useWorkspaceStore } from './workspace-store';

/**
 * Sources only history references (a closed document undo can bring back) are parked: closed in
 * the engine, bytes kept. Parked sources the workspace shows again reopen.
 */
export function syncParking(
  ids: readonly SourceId[],
  live: ReadonlySet<string>,
  shown: object,
  protections: ReadonlySet<string>,
): void {
  const engine = getEngineService();
  for (const id of ids) {
    if (protections.has(id)) continue;
    if (!(id in shown)) {
      if (live.has(id)) void engine.park(id);
    } else if (engine.isParked(id)) {
      void reopenParked(id);
    }
  }
}

const reopeningIds = new Set<SourceId>();

export async function reopenParked(id: SourceId): Promise<void> {
  // One reopen (and replay) per source at a time, however often garbage collection runs.
  if (reopeningIds.has(id)) return;
  reopeningIds.add(id);
  const job = startJob({ label: m.job_reopening() });
  try {
    const reopened = await getEngineService().ensureOpen(id);
    if (!reopened.ok) {
      console.warn(`Reopening ${id} failed`, reopened.error);
      return;
    }
    const { workspace, files } = useWorkspaceStore.getState();
    if (workspace.sources[id] === undefined) {
      // A redo closed the document again while it reopened: park it again.
      if (files[id] !== undefined) void getEngineService().park(id);
      return;
    }
    if (workspace.engineEdits.some((edit) => edit.source === id)) {
      const { scheduleReconcile } = await import('../annotations/edit-runner');
      await scheduleReconcile();
    }
  } finally {
    reopeningIds.delete(id);
    job.finish();
  }
}
