/**
 * Parking follows the workspace (PF-18, `reopen-parked.ts`): a source only history references is
 * parked, one an operation still protects (a snapshot taken when garbage collection ran) is
 * left alone, and a parked source the workspace shows again is reopened.
 */
import { type SourceId, sourceId } from '@pdf-editor/document-model';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getEngineService } from '../engine/engine-service';
import { syncParking } from './reopen-parked';

const A = sourceId('a');
const B = sourceId('b');
const C = sourceId('c');

afterEach(() => {
  vi.restoreAllMocks();
});

describe('syncParking', () => {
  it('parks live sources the workspace no longer shows, and only those', () => {
    const park = vi.spyOn(getEngineService(), 'park').mockResolvedValue();
    vi.spyOn(getEngineService(), 'isParked').mockReturnValue(false);
    const ids: SourceId[] = [A, B, C];
    // A is shown, B is only in history (live), C is held by an operation in progress.
    syncParking(ids, new Set([A, B, C]), { [A]: {} }, new Set([C]));
    expect(park.mock.calls.map(([id]) => id)).toEqual([B]);
  });

  it('does not park a source that is no longer live (it is closed for good instead)', () => {
    const park = vi.spyOn(getEngineService(), 'park').mockResolvedValue();
    syncParking([A], new Set(), {}, new Set());
    expect(park).not.toHaveBeenCalled();
  });

  it('leaves a protected source alone even when its protection ends before the work runs', () => {
    const park = vi.spyOn(getEngineService(), 'park').mockResolvedValue();
    const held = new Set<string>([A]);
    // The snapshot is what the store saw when it collected; later changes do not reach it.
    const snapshot = new Set(held);
    held.clear();
    syncParking([A], new Set([A]), {}, snapshot);
    expect(park).not.toHaveBeenCalled();
  });

  it('reopens a parked source the workspace shows again', async () => {
    vi.spyOn(getEngineService(), 'isParked').mockImplementation((id) => id === A);
    const ensure = vi
      .spyOn(getEngineService(), 'ensureOpen')
      .mockResolvedValue({ ok: true, value: undefined });
    syncParking([A, B], new Set([A, B]), { [A]: {}, [B]: {} }, new Set());
    await vi.waitFor(() => {
      expect(ensure).toHaveBeenCalledWith(A);
    });
    expect(ensure).not.toHaveBeenCalledWith(B);
  });
});
