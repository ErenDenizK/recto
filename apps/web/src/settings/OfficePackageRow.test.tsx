/**
 * The Office package row in Settings (PRD-21): hidden with no package and the flag off; shown
 * with the stored size when the package is installed; Remove asks, deletes the package, and the
 * next `isPackageInstalled()` is false.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import { OFFICE_FLAG_KEY, resetOfficeFlag } from '../office/flag';
import {
  markerUrl,
  OFFICE_CACHE,
  OFFICE_LOCK,
  packageFiles,
  STORED_ENCODING_HEADER,
} from '../office/package';
import { isPackageInstalled, packageStoredBytes } from '../office/package-store';
import { OfficePackageRow } from './OfficePackageRow';

const ask = vi.hoisted(() => ({ answer: true }));
vi.mock('../ui/sheet', async (importActual) => ({
  ...(await importActual<Record<string, unknown>>()),
  confirm: vi.fn(() => Promise.resolve(ask.answer)),
}));
vi.mock('../pwa/office-worker', () => ({
  askServiceWorker: () => Promise.resolve(true),
  serviceWorkerControls: () => true,
}));

async function stubInstalled(): Promise<void> {
  const cache = await caches.open(OFFICE_CACHE);
  const [first] = packageFiles();
  if (first) await cache.put(first.storedUrl, new Response('x'));
  await cache.put(
    markerUrl(),
    new Response(JSON.stringify({ directory: OFFICE_LOCK.directory }), {
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

describe('OfficePackageRow', () => {
  beforeEach(async () => {
    ask.answer = true;
    localStorage.removeItem(OFFICE_FLAG_KEY);
    resetOfficeFlag();
    await caches.delete(OFFICE_CACHE);
  });
  afterEach(async () => {
    localStorage.removeItem(OFFICE_FLAG_KEY);
    resetOfficeFlag();
    await caches.delete(OFFICE_CACHE);
  });

  it('is hidden with no package and the flag off', async () => {
    const { container } = render(<OfficePackageRow />);
    await new Promise((r) => setTimeout(r, 300));
    expect(container.querySelector('[data-row="officePackage"]')).toBeNull();
  });

  it('is shown when the flag is on, with Remove disabled until a package is stored', async () => {
    localStorage.setItem(OFFICE_FLAG_KEY, '1');
    render(<OfficePackageRow />);
    const remove = await screen.findByTestId('settings-office-remove');
    expect((remove as HTMLButtonElement).disabled || remove.ariaDisabled === 'true').toBe(true);
  });

  it('removes an installed package after confirming', async () => {
    await stubInstalled();
    expect(await isPackageInstalled()).toBe(true);
    render(<OfficePackageRow />);
    await userEvent.click(await screen.findByTestId('settings-office-remove'));
    await waitFor(async () => expect(await isPackageInstalled()).toBe(false));
  });

  it('keeps the package when the confirmation is declined', async () => {
    await stubInstalled();
    ask.answer = false;
    render(<OfficePackageRow />);
    await userEvent.click(await screen.findByTestId('settings-office-remove'));
    await new Promise((r) => setTimeout(r, 200));
    expect(await isPackageInstalled()).toBe(true);
  });

  it('counts a gzip-stored file at its download size and a plain one at its own', async () => {
    const [a, b] = packageFiles();
    if (!a || !b) throw new Error('the lock has fewer than two files');
    const cache = await caches.open(OFFICE_CACHE);
    await cache.put(
      a.storedUrl,
      new Response('x', { headers: { [STORED_ENCODING_HEADER]: 'gzip' } }),
    );
    await cache.put(b.storedUrl, new Response('x'));
    expect(await packageStoredBytes()).toBe(a.downloadBytes + b.bytes);
  });

  it('says Not downloaded when the flag is on and nothing was ever stored', async () => {
    localStorage.setItem(OFFICE_FLAG_KEY, '1');
    const { container } = render(<OfficePackageRow />);
    await screen.findByTestId('settings-office-remove');
    expect(container.textContent).toContain('Not downloaded');
  });
});
