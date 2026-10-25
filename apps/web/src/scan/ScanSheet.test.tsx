/**
 * The scan sheet in a real browser (plan bm-scan-plan §3): the camera's denied and no-camera
 * answers with the photo fallback, and the review's retake, reorder and delete. The camera and the
 * detection worker are fakes; pages are seeded through the store, as a capture would add them.
 */
import '../styles/tokens.css';
import '../styles/reset.css';
import '../styles/global.css';

import { render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { settled } from '../../test/settled';
import { ConfirmHost, useSheetStore } from '../ui/sheet';
import type { CameraResult } from './camera';
import { defaultQuad, moveItem, rotateQuad } from './scan-store';
import { addPage, closeScanSheet, setView, useScanStore } from './scan-store';
import { scanOpenNow, setScanOpen } from './scan-flag';
import { ScanSheet } from './ScanSheet';

const camera = vi.hoisted((): { result: CameraResult } => ({
  result: { ok: false, reason: 'none' },
}));

vi.mock('./camera', () => ({
  openCamera: () => Promise.resolve(camera.result),
  stopCamera: () => undefined,
  detectionFrame: () => Promise.reject(new Error('no video')),
  jpegOf: () => Promise.resolve(new Blob(['x'], { type: 'image/jpeg' })),
  Detector: class {
    detect = () => Promise.resolve({ quad: null });
    reset = () => undefined;
    dispose = () => undefined;
  },
}));

beforeEach(async () => {
  useSheetStore.setState({ open: null, front: null, confirm: null, drafts: {} });
  await page.viewport(1440, 900);
});

afterEach(() => {
  closeScanSheet();
});

const seed = (count: number) => {
  for (let i = 0; i < count; i++) {
    addPage({
      source: new Blob([`page ${i}`], { type: 'image/jpeg' }),
      width: 600,
      height: 800,
      quad: defaultQuad(600, 800),
    });
  }
};
const ids = () => useScanStore.getState().pages.map((p) => p.id);

async function openSheet() {
  render(
    <>
      <ScanSheet />
      <ConfirmHost />
    </>,
  );
  setScanOpen(true);
  return settled(await screen.findByTestId('scan-sheet'));
}

describe('camera states', () => {
  it('says when the camera is blocked and offers a photo', async () => {
    camera.result = { ok: false, reason: 'denied' };
    const sheet = await openSheet();
    expect((await within(sheet).findByTestId('scan-denied')).textContent).toMatch(
      /Camera access is blocked/,
    );
    const input = within(sheet).getByTestId('scan-file');
    expect(input).toHaveAttribute('capture', 'environment');
    expect(input).toHaveAttribute('accept', 'image/*');
    expect(within(sheet).queryByTestId('scan-shutter')).toBeNull();
  });

  it('says when there is no camera and offers a photo', async () => {
    camera.result = { ok: false, reason: 'none' };
    const sheet = await openSheet();
    expect((await within(sheet).findByTestId('scan-none')).textContent).toMatch(
      /No camera was found/,
    );
    expect(within(sheet).getByTestId('scan-file')).toBeInTheDocument();
  });
});

describe('review', () => {
  beforeEach(() => {
    camera.result = { ok: false, reason: 'none' };
  });

  it('reorders with the buttons and with Alt+arrows', async () => {
    const sheet = await openSheet();
    seed(3);
    const [a, b, c] = ids() as [string, string, string];
    setView('review');
    await within(sheet).findByTestId('scan-review');
    // The last capture is selected: move it to the start.
    await userEvent.click(within(sheet).getByTestId('scan-earlier'));
    expect(ids()).toEqual([a, c, b]);
    const thumbs = within(sheet).getAllByTestId('scan-thumb');
    thumbs[0]?.focus();
    await userEvent.keyboard('{Alt>}{ArrowRight}{/Alt}');
    expect(ids()).toEqual([c, a, b]);
  });

  it('deletes the selected page and picks a neighbour', async () => {
    const sheet = await openSheet();
    seed(3);
    const before = ids();
    setView('review');
    await within(sheet).findByTestId('scan-review');
    await userEvent.click(within(sheet).getByTestId('scan-delete'));
    expect(ids()).toEqual(before.slice(0, 2));
    expect(useScanStore.getState().selected).toBe(before[1]);
  });

  it('goes back to the camera when the last page is deleted', async () => {
    const sheet = await openSheet();
    seed(1);
    setView('review');
    await userEvent.click(await within(sheet).findByTestId('scan-delete'));
    await waitFor(() => expect(useScanStore.getState().view).toBe('camera'));
    expect(useScanStore.getState().pages).toHaveLength(0);
    expect(within(sheet).getByTestId('scan-done')).toHaveAttribute('aria-disabled', 'true');
  });

  it('retakes in place: the next capture replaces that page, not appends', async () => {
    const sheet = await openSheet();
    seed(3);
    const before = ids();
    setView('review');
    await userEvent.click(
      await within(sheet)
        .findAllByTestId('scan-thumb')
        .then((t) => t[1]!),
    );
    await userEvent.click(within(sheet).getByTestId('scan-retake'));
    expect(useScanStore.getState().view).toBe('camera');
    expect(useScanStore.getState().retaking).toBe(before[1]);
    addPage({
      source: new Blob(['again'], { type: 'image/jpeg' }),
      width: 600,
      height: 800,
      quad: defaultQuad(600, 800),
    });
    expect(ids()).toEqual(before);
    expect(useScanStore.getState().retaking).toBeNull();
  });

  it('asks before Cancel throws pages away, and keeps them on Cancel', async () => {
    const sheet = await openSheet();
    seed(3);
    await userEvent.click(within(sheet).getByRole('button', { name: 'Cancel' }));
    const ask = await settled(await screen.findByTestId('confirm-sheet'));
    expect(ask.textContent).toMatch(/Discard 3 scanned pages\?/);
    await userEvent.click(within(ask).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByTestId('confirm-sheet')).toBeNull());
    expect(scanOpenNow()).toBe(true);
    expect(ids()).toHaveLength(3);
  });

  it('discards the pages and closes when the question is answered Discard', async () => {
    const sheet = await openSheet();
    seed(2);
    await userEvent.click(within(sheet).getByRole('button', { name: 'Cancel' }));
    const ask = await settled(await screen.findByTestId('confirm-sheet'));
    await userEvent.click(within(ask).getByRole('button', { name: 'Discard' }));
    await waitFor(() => expect(scanOpenNow()).toBe(false));
    expect(ids()).toHaveLength(0);
  });

  it('closes without a question when nothing was scanned', async () => {
    const sheet = await openSheet();
    await userEvent.click(within(sheet).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(scanOpenNow()).toBe(false));
    expect(screen.queryByTestId('confirm-sheet')).toBeNull();
  });
});

describe('page helpers', () => {
  it('rotates by moving the corner order a quarter turn', () => {
    const q = defaultQuad(100, 200);
    const r = rotateQuad(q);
    expect(r[0]).toEqual(q[3]);
    expect(r[1]).toEqual(q[0]);
    expect(rotateQuad(rotateQuad(rotateQuad(r)))).toEqual(q);
  });

  it('moves an item and clamps at the ends', () => {
    expect(moveItem([1, 2, 3], 2, 0)).toEqual([3, 1, 2]);
    expect(moveItem([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
    expect(moveItem([1, 2, 3], 0, 9)).toEqual([2, 3, 1]);
  });
});
