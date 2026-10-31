/**
 * The phone's scan sheet in a real browser at 390 x 844 (EDN-23): the camera's denied answer and
 * its photo fallback, a capture through a canvas stream, the review's actions, the page limit,
 * and Done opening the document through the phone's finish. The camera, the detection worker and
 * the finish are fakes; the store and the sheet are the real ones.
 */
import '../../../styles/tokens.css';
import '../../../styles/reset.css';
import '../../../styles/global.css';

import { render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { settled } from '../../../../test/settled';
import type { CameraResult } from '../../../scan/camera';
import { scanOpenNow, setScanOpen } from '../../../scan/scan-flag';
import { addPage, closeScanSheet, defaultQuad, useScanStore } from '../../../scan/scan-store';
import { useSheetStore } from '../../../ui/sheet';
import { toast } from '../../../ui/Toast';
import { PHONE_MAX_PAGES } from './phone-caps';
import { PhoneScanSheet } from './PhoneScanSheet';

interface Hoisted {
  result: CameraResult;
  openCamera: Mock;
  finish: Mock;
}

const camera = vi.hoisted(
  (): Hoisted => ({
    result: { ok: false, reason: 'denied' },
    openCamera: vi.fn(),
    finish: vi.fn(),
  }),
);

vi.mock('./finish-phone', () => ({ finishPhoneScan: camera.finish }));

vi.mock('../../../scan/camera', () => ({
  openCamera: camera.openCamera,
  stopCamera: (stream: MediaStream | null) => stream?.getTracks().forEach((t) => t.stop()),
  detectionFrame: () => Promise.resolve({ close: () => undefined } as ImageBitmap),
  jpegOf: () => Promise.resolve(new Blob(['x'], { type: 'image/jpeg' })),
  Detector: class {
    detect = () => Promise.resolve({ quad: null, stable: false });
    reset = () => undefined;
    dispose = () => undefined;
  },
}));

beforeEach(async () => {
  camera.openCamera.mockImplementation(() => Promise.resolve(camera.result));
  camera.openCamera.mockClear();
  camera.finish.mockReset();
  camera.finish.mockResolvedValue(true);
  useSheetStore.setState({ open: null, front: null, confirm: null, drafts: {} });
  await page.viewport(390, 844);
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
const pages = () => useScanStore.getState().pages;

async function openSheet() {
  render(<PhoneScanSheet />);
  setScanOpen(true);
  return settled(await screen.findByTestId('scan-sheet'));
}

/** A real photo, so the fallback has something to read. */
async function photo(width = 300, height = 400): Promise<File> {
  const canvas = new OffscreenCanvas(width, height);
  const g = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, width, height);
  const blob = await canvas.convertToBlob({ type: 'image/jpeg' });
  return new File([blob], 'p.jpg', { type: 'image/jpeg' });
}

async function choose(sheet: HTMLElement, files: File[]) {
  const input = await within(sheet).findByTestId<HTMLInputElement>('scan-file');
  const data = new DataTransfer();
  files.forEach((file) => data.items.add(file));
  input.files = data.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('the phone layout', () => {
  it('fills the window and puts a 72 px shutter in the lower part, in thumb reach', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    canvas.getContext('2d')?.fillRect(0, 0, 320, 240);
    camera.result = { ok: true, stream: canvas.captureStream() };
    const sheet = await openSheet();
    const box = sheet.getBoundingClientRect();
    expect([box.width, box.height]).toEqual([390, 844]);
    const shutter = await within(sheet).findByTestId<HTMLButtonElement>('scan-shutter');
    await waitFor(() => expect(shutter.disabled).toBe(false));
    const rect = shutter.getBoundingClientRect();
    expect(rect.width).toBe(72);
    expect(rect.height).toBe(72);
    expect(rect.bottom).toBeGreaterThan(844 * 0.75);
    expect(rect.bottom).toBeLessThanOrEqual(844);
  });
});

describe('capture and the photo fallback', () => {
  it('captures a page with the shutter, and Done appears with it', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    canvas.getContext('2d')?.fillRect(0, 0, 320, 240);
    camera.result = { ok: true, stream: canvas.captureStream() };
    const sheet = await openSheet();
    expect(within(sheet).queryByTestId('scan-done')).toBeNull();
    // The mode control is a Segmented (09-primitives §6): a radiogroup while both labels fit the
    // cell beside the shutter, a Select when they do not. That depends on the font the engine
    // has, so the test takes whichever it renders.
    const modeSelect = await within(sheet)
      .findByRole('combobox', { name: 'Capture mode' }, { timeout: 500 })
      .catch(() => null);
    if (modeSelect) {
      await userEvent.click(modeSelect);
      await userEvent.click(await screen.findByRole('option', { name: 'Manual' }));
    } else {
      await userEvent.click(within(sheet).getByRole('radio', { name: 'Manual' }));
    }
    const shutter = within(sheet).getByTestId<HTMLButtonElement>('scan-shutter');
    await waitFor(() => expect(shutter.disabled).toBe(false));
    await waitFor(() =>
      expect(within(sheet).getByTestId<HTMLVideoElement>('scan-video').videoWidth).toBeGreaterThan(
        0,
      ),
    );
    await userEvent.click(shutter);
    await waitFor(() => expect(pages()).toHaveLength(1));
    expect(within(sheet).getByTestId('scan-done')).toBeInTheDocument();
    expect(within(sheet).getByTestId('scan-stack').textContent).toContain('1');
  });

  it('blocked: says so, offers a photo, and a chosen photo opens the review', async () => {
    camera.result = { ok: false, reason: 'denied' };
    const sheet = await openSheet();
    expect((await within(sheet).findByTestId('scan-denied')).textContent).toMatch(
      /Camera access is blocked/,
    );
    expect(within(sheet).queryByTestId('scan-shutter')).toBeNull();
    await choose(sheet, [await photo()]);
    await waitFor(() => expect(useScanStore.getState().view).toBe('review'));
    expect(pages()).toHaveLength(1);
  });

  it('keeps a large photo at the phone size', async () => {
    camera.result = { ok: false, reason: 'denied' };
    const sheet = await openSheet();
    await choose(sheet, [await photo(4800, 3200)]);
    await waitFor(() => expect(pages()).toHaveLength(1));
    const { width, height } = pages()[0] ?? { width: 0, height: 0 };
    expect(Math.max(width, height)).toBe(4000);
    expect(Math.round((width / height) * 100)).toBe(150);
  });
});

describe('the page limit', () => {
  it('stops the shutter at the limit and cuts a photo batch with a toast', async () => {
    camera.result = { ok: false, reason: 'denied' };
    const failure = vi.spyOn(toast, 'failure');
    const sheet = await openSheet();
    seed(PHONE_MAX_PAGES - 1);
    await choose(sheet, [await photo(), await photo()]);
    await waitFor(() => expect(pages()).toHaveLength(PHONE_MAX_PAGES));
    expect(failure).toHaveBeenCalledWith(expect.stringMatching(/keeps 40 pages/), {
      key: 'scan-limit',
    });
    failure.mockRestore();
  });

  it('disables the shutter at the limit', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    canvas.getContext('2d')?.fillRect(0, 0, 320, 240);
    camera.result = { ok: true, stream: canvas.captureStream() };
    const sheet = await openSheet();
    seed(PHONE_MAX_PAGES);
    const shutter = within(sheet).getByTestId<HTMLButtonElement>('scan-shutter');
    await waitFor(() => expect(shutter.disabled).toBe(true));
    expect(within(sheet).getByTestId('scan-hint').textContent).toMatch(/keeps 40 pages/);
  });
});

describe('review', () => {
  it('has the per-page actions, and rotate turns the corners', async () => {
    camera.result = { ok: false, reason: 'none' };
    const sheet = await openSheet();
    seed(2);
    useScanStore.setState({ view: 'review' });
    for (const id of [
      'scan-adjust',
      'scan-rotate',
      'scan-retake',
      'scan-delete',
      'scan-earlier',
      'scan-later',
      'scan-another',
    ]) {
      expect(await within(sheet).findByTestId(id)).toBeInTheDocument();
    }
    expect(within(sheet).getByRole('radio', { name: 'Greyscale' })).toBeInTheDocument();
    const quad = pages()[1]?.quad;
    await userEvent.click(within(sheet).getByTestId('scan-rotate'));
    expect(pages()[1]?.quad[0]).toEqual(quad?.[3]);
    await userEvent.click(within(sheet).getByTestId('scan-delete'));
    expect(pages()).toHaveLength(1);
  });
});

describe('Done and Close', () => {
  it('Done makes the document through the phone finish and closes the sheet', async () => {
    camera.result = { ok: false, reason: 'none' };
    const sheet = await openSheet();
    seed(2);
    const done = await within(sheet).findByTestId('scan-done');
    done.click();
    await waitFor(() => expect(camera.finish).toHaveBeenCalledTimes(1));
    expect(camera.finish.mock.calls[0]?.[0]).toHaveLength(2);
    await waitFor(() => expect(scanOpenNow()).toBe(false));
  });

  it('keeps the sheet and the pages and says so when the PDF could not be made', async () => {
    camera.finish.mockResolvedValue(false);
    camera.result = { ok: false, reason: 'none' };
    const failure = vi.spyOn(toast, 'failure');
    const sheet = await openSheet();
    seed(1);
    (await within(sheet).findByTestId('scan-done')).click();
    await waitFor(() => expect(failure).toHaveBeenCalled());
    expect(failure.mock.calls[0]?.[0]).toMatch(/could not be made into a PDF/);
    expect(scanOpenNow()).toBe(true);
    expect(pages()).toHaveLength(1);
    failure.mockRestore();
  });

  it('Close asks before throwing pages away, and discards on Discard', async () => {
    camera.result = { ok: false, reason: 'none' };
    const sheet = await openSheet();
    seed(2);
    await userEvent.click(within(sheet).getByTestId('scan-close'));
    const ask = await settled(await screen.findByTestId('confirm-sheet'));
    expect(ask.textContent).toMatch(/Discard 2 scanned pages\?/);
    await userEvent.click(within(ask).getByRole('button', { name: 'Discard' }));
    await waitFor(() => expect(scanOpenNow()).toBe(false));
    expect(pages()).toHaveLength(0);
  });

  it('Close needs no question when nothing was scanned', async () => {
    camera.result = { ok: false, reason: 'none' };
    const sheet = await openSheet();
    await userEvent.click(within(sheet).getByTestId('scan-close'));
    await waitFor(() => expect(scanOpenNow()).toBe(false));
  });
});
