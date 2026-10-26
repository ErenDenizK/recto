/**
 * The scan sheet in a real browser (plan bm-scan-plan §3): the camera's denied and no-camera
 * answers with the photo fallback, and the review's retake, reorder and delete. The camera and the
 * detection worker are fakes; pages are seeded through the store, as a capture would add them.
 */
import '../styles/tokens.css';
import '../styles/reset.css';
import '../styles/global.css';

import { render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { settled } from '../../test/settled';
import { toast } from '../ui/Toast';
import { ConfirmHost, useSheetStore } from '../ui/sheet';
import type { CameraResult } from './camera';
import { defaultQuad, moveItem, rotateQuad } from './scan-store';
import { addPage, closeScanSheet, retakePage, setView, useScanStore } from './scan-store';
import { scanOpenNow, setScanOpen } from './scan-flag';
import { ScanSheet } from './ScanSheet';

interface Hoisted {
  result: CameraResult;
  openCamera: Mock;
  stopCamera: Mock;
  finish: Mock;
}

const camera = vi.hoisted(
  (): Hoisted => ({
    result: { ok: false, reason: 'none' },
    openCamera: vi.fn(),
    stopCamera: vi.fn(),
    finish: vi.fn(),
  }),
);

vi.mock('./finish', () => ({ finishScan: camera.finish }));

vi.mock('./camera', () => ({
  openCamera: camera.openCamera,
  stopCamera: camera.stopCamera,
  detectionFrame: () => Promise.reject(new Error('no video')),
  jpegOf: () => Promise.resolve(new Blob(['x'], { type: 'image/jpeg' })),
  Detector: class {
    detect = () => Promise.resolve({ quad: null });
    reset = () => undefined;
    dispose = () => undefined;
  },
}));

beforeEach(async () => {
  camera.openCamera.mockImplementation(() => Promise.resolve(camera.result));
  camera.openCamera.mockClear();
  camera.stopCamera.mockClear();
  camera.finish.mockReset();
  camera.finish.mockResolvedValue(true);
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

/** A real JPEG, so the preview's warp has something to read. */
async function jpeg(): Promise<Blob> {
  const canvas = new OffscreenCanvas(300, 400);
  const g = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, 300, 400);
  g.fillStyle = '#000';
  g.fillRect(20, 20, 160, 24);
  return canvas.convertToBlob({ type: 'image/jpeg' });
}

const setHidden = (hidden: boolean) => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event('visibilitychange'));
};

describe('the stream', () => {
  afterEach(() => setHidden(false));

  it('stops when the tab hides and when the sheet closes, and comes back with the tab', async () => {
    const stream = new MediaStream();
    camera.result = { ok: true, stream };
    const sheet = await openSheet();
    await waitFor(() =>
      expect(within(sheet).getByTestId<HTMLButtonElement>('scan-shutter').disabled).toBe(false),
    );
    setHidden(true);
    expect(camera.stopCamera).toHaveBeenCalledWith(stream);
    setHidden(false);
    await waitFor(() => expect(camera.openCamera).toHaveBeenCalledTimes(2));
    camera.stopCamera.mockClear();
    await userEvent.click(within(sheet).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(camera.stopCamera).toHaveBeenCalled());
  });

  it('does not ask again when the tab shows after the camera was denied', async () => {
    camera.result = { ok: false, reason: 'denied' };
    const sheet = await openSheet();
    await within(sheet).findByTestId('scan-denied');
    setHidden(true);
    setHidden(false);
    // The restart, if any, is synchronous in the tab-show handler: nothing to wait for.
    expect(within(sheet).getByTestId('scan-denied')).toBeInTheDocument();
    expect(camera.openCamera).toHaveBeenCalledTimes(1);
  });
});

describe('the photo fallback', () => {
  it('adds the photos it can read, skips the others and opens the review', async () => {
    camera.result = { ok: false, reason: 'denied' };
    const sheet = await openSheet();
    const input = await within(sheet).findByTestId<HTMLInputElement>('scan-file');
    const failure = vi.spyOn(toast, 'failure');
    const data = new DataTransfer();
    data.items.add(new File([await jpeg()], 'a.jpg', { type: 'image/jpeg' }));
    data.items.add(new File(['not an image'], 'b.heic', { type: 'image/heic' }));
    input.files = data.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await waitFor(() => expect(useScanStore.getState().view).toBe('review'));
    expect(useScanStore.getState().pages).toHaveLength(1);
    expect(failure).toHaveBeenCalledWith(expect.stringMatching(/1 photos could not be read/));
    failure.mockRestore();
  });
});

describe('review changes', () => {
  it('rotating turns the corners and makes a new preview', async () => {
    const sheet = await openSheet();
    addPage({
      source: await jpeg(),
      width: 300,
      height: 400,
      quad: defaultQuad(300, 400),
    });
    setView('review');
    // The preview is a real warp in a worker, so on a busy machine it takes seconds: wait for it.
    const slow = { timeout: 20_000 };
    const first = await within(sheet).findByTestId('scan-preview', undefined, slow);
    const before = first.getAttribute('src');
    const quad = useScanStore.getState().pages[0]?.quad;
    await userEvent.click(within(sheet).getByTestId('scan-rotate'));
    expect(useScanStore.getState().pages[0]?.quad[0]).toEqual(quad?.[3]);
    await waitFor(
      () => expect(within(sheet).getByTestId('scan-preview').getAttribute('src')).not.toBe(before),
      slow,
    );
  });

  it('a retake ends when the view leaves the camera', () => {
    seed(1);
    retakePage(ids()[0] as string);
    expect(useScanStore.getState().retaking).not.toBeNull();
    setView('review');
    expect(useScanStore.getState().retaking).toBeNull();
  });
});

describe('corner adjust', () => {
  it('has its own Apply and Back, hides the sheet footer and Back restores the corners', async () => {
    const sheet = await openSheet();
    seed(1);
    const before = useScanStore.getState().pages[0]?.quad;
    setView('adjust');
    await within(sheet).findByTestId('scan-corners');
    expect(within(sheet).queryByTestId('scan-done')).toBeNull();
    expect(within(sheet).queryByRole('button', { name: 'Cancel' })).toBeNull();
    const handle = within(sheet).getByRole('button', { name: 'Top left corner' });
    handle.focus();
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    expect(useScanStore.getState().pages[0]?.quad).not.toEqual(before);
    await userEvent.click(within(sheet).getByTestId('scan-adjust-back'));
    expect(useScanStore.getState().pages[0]?.quad).toEqual(before);
    expect(useScanStore.getState().view).toBe('review');
  });
});

describe('Done', () => {
  it('keeps the sheet and the pages and says so when the PDF could not be made', async () => {
    camera.finish.mockRejectedValue(new Error('no'));
    const failure = vi.spyOn(toast, 'failure');
    const sheet = await openSheet();
    seed(2);
    // A native click: the locator cannot build a selector for the primary button.
    const done = () => within(sheet).getByTestId('scan-done');
    await waitFor(() => expect(done().getAttribute('aria-disabled')).not.toBe('true'));
    done().click();
    await waitFor(() => expect(failure).toHaveBeenCalled());
    expect(failure.mock.calls[0]?.[0]).toMatch(/could not be made into a PDF/);
    expect(ids()).toHaveLength(2);
    expect(within(sheet).getByTestId('scan-done')).toBeInTheDocument();
    failure.mockRestore();
  });
});
