/**
 * Done on the phone (EDN-23): the open document is closed only once the scan document exists. A
 * failure to warp or to open leaves it alone.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ScanPage } from '../../../scan/scan-store';

const fake = vi.hoisted(() => ({
  render: vi.fn(),
  open: vi.fn(),
  closeOthers: vi.fn(),
}));

vi.mock('../../../scan/render-files', () => ({
  renderScanFiles: fake.render,
  scanTitle: () => 'Scan',
}));
vi.mock('../../../stage/section-operations', () => ({ openImagesAsDocument: fake.open }));
vi.mock('../../../state/workspace-store', () => ({
  useWorkspaceStore: {
    getState: () => ({
      workspace: { documents: {}, documentOrder: [] },
      closeDocument: fake.closeOthers,
    }),
  },
}));
vi.mock('../../../session/session', () => ({ flushSession: () => Promise.resolve() }));

import { finishPhoneScan } from './finish-phone';

const pages = [{ id: 'scan-1' }] as unknown as readonly ScanPage[];

beforeEach(() => {
  fake.render.mockReset().mockResolvedValue([new File(['x'], 'a.jpg')]);
  fake.open.mockReset();
  fake.closeOthers.mockReset();
});

describe('finishPhoneScan', () => {
  it('leaves the open document when the pages cannot be warped', async () => {
    fake.render.mockRejectedValue(new Error('no'));
    await expect(finishPhoneScan(pages)).rejects.toThrow('no');
    expect(fake.open).not.toHaveBeenCalled();
    expect(fake.closeOthers).not.toHaveBeenCalled();
  });

  it('leaves the open document when the new one does not open', async () => {
    fake.open.mockResolvedValue(undefined);
    expect(await finishPhoneScan(pages)).toBe(false);
    expect(fake.closeOthers).not.toHaveBeenCalled();
  });
});
