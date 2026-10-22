/**
 * Parking and the idle end of the engine worker (PF-18), loaded on demand: only closing a
 * document, undoing a close and an idle worker need it, so it stays out of the editor's first
 * load. `EngineService` keeps the hot path (open, render, close) and calls in here.
 */
import type { SourceId } from '@pdf-editor/document-model';

import {
  type EngineResult,
  type EngineService,
  fail,
  ok,
  readCropBoxes,
  readShapes,
  toFailure,
} from './engine-service';

/** Arms the idle timer: the worker ends `idleMs` after its last use while nothing is open. */
export function scheduleEnd(service: EngineService): void {
  if (service.idleTimer !== undefined) clearTimeout(service.idleTimer);
  if (service.renderer === undefined || !service.canEnd()) return;
  const wait = Math.max(0, service.idleMs - (Date.now() - service.lastUse));
  service.idleTimer = setTimeout(() => {
    service.idleTimer = undefined;
    if (!service.canEnd()) return;
    if (Date.now() - service.lastUse < service.idleMs) service.armIdle();
    else void endWorker(service);
  }, wait || service.idleMs);
}

async function endWorker(service: EngineService): Promise<void> {
  const renderer = service.renderer;
  if (renderer === undefined) return;
  service.renderer = undefined;
  for (const listener of service.workerEndListeners) listener();
  try {
    await (await renderer).destroy?.();
  } catch {
    // Nothing left to clean up.
  }
}

export function park(service: EngineService, sourceId: SourceId): Promise<void> {
  if (!service.retained.has(sourceId) || service.parked.has(sourceId)) return Promise.resolve();
  const prefix = `${sourceId}:`;
  service.dropRendering(sourceId, 'Source released');
  for (const key of [...service.texts.keys()]) {
    if (key.startsWith(prefix)) service.texts.delete(key);
  }
  service.parked.add(sourceId);
  service.openSources.delete(sourceId);
  for (const listener of service.parkListeners) listener(sourceId);
  const done = (async () => {
    try {
      if (service.renderer !== undefined) await (await service.renderer).close(sourceId);
    } catch {
      // The document is gone either way.
    }
  })().finally(() => {
    service.parking.delete(sourceId);
    service.armIdle();
  });
  service.parking.set(sourceId, done);
  return done;
}

export async function ensureOpen(
  service: EngineService,
  sourceId: SourceId,
): Promise<EngineResult<void>> {
  await service.parking.get(sourceId);
  if (!service.parked.has(sourceId)) return ok(undefined);
  let pending = service.reopening.get(sourceId);
  if (pending === undefined) {
    pending = reopenParked(service, sourceId).finally(() => {
      service.reopening.delete(sourceId);
      service.armIdle();
    });
    service.reopening.set(sourceId, pending);
  }
  return pending;
}

async function reopenParked(
  service: EngineService,
  sourceId: SourceId,
): Promise<EngineResult<void>> {
  const blob = service.retained.get(sourceId);
  if (blob === undefined) return fail('internal', `Source ${sourceId} is not open`);
  try {
    const bytes = await blob.arrayBuffer();
    const password = service.passwords.get(sourceId);
    const document = await (await service.engine()).open(
      sourceId,
      bytes,
      password === undefined ? {} : { password },
    );
    service.cropBoxes.set(sourceId, readCropBoxes(document));
    service.shapes.set(sourceId, readShapes(document));
    // Closed meanwhile (history let go of it): do not keep it open.
    if (!service.retained.has(sourceId)) {
      await (await service.engine()).close(sourceId);
      return ok(undefined);
    }
    service.parked.delete(sourceId);
    service.openSources.add(sourceId);
    return ok(undefined);
  } catch (error) {
    return { ok: false, error: toFailure(error) };
  }
}
