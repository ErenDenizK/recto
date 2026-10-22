/**
 * The update-ready notice (`register.ts`; `08-feedback` FB4 §2, §5, issue 9): its toast loads
 * on demand (`update-toast.ts`, kept out of the first paint, V1-P1) and still shows once, with
 * Reload and Later, saying whether documents reopen. And which engine wasm each edition warms.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { setLocale } from '../i18n';
import { resetSessionStore, useSessionStore } from '../session/session-store';
import { resetToasts, useToastStore } from '../ui/Toast/toast-store';
import {
  dismissUpdate,
  runAfterFirstPage,
  showUpdateReady,
  usePwaStore,
  warmWasmUrls,
} from './register';

afterEach(() => {
  resetToasts();
  resetSessionStore();
  usePwaStore.setState({ updateAvailable: false });
});

describe('showUpdateReady', () => {
  it('shows the system toast with Reload and Later', async () => {
    setLocale('en');
    await showUpdateReady();
    expect(usePwaStore.getState().updateAvailable).toBe(true);
    const [shown] = useToastStore.getState().shown;
    expect(shown).toMatchObject({
      kind: 'system',
      text: 'Update ready',
      detail: 'Reloading closes open documents.',
      testId: 'update-toast',
    });
    expect(shown?.action?.label).toBe('Reload');
    expect(shown?.secondary?.label).toBe('Later');
  });

  it('says documents reopen when the session keeps them, and shows once', async () => {
    setLocale('en');
    useSessionStore.setState({ keeping: 'available' });
    await showUpdateReady();
    await showUpdateReady();
    const { shown } = useToastStore.getState();
    expect(shown).toHaveLength(1);
    expect(shown[0]?.detail).toBe('Your documents reopen where they were.');
  });

  it('Later hides the notice for the session', async () => {
    await showUpdateReady();
    useToastStore.getState().shown[0]?.secondary?.run();
    expect(usePwaStore.getState().updateAvailable).toBe(false);
    dismissUpdate();
    expect(usePwaStore.getState().updateAvailable).toBe(false);
  });
});

describe('warmWasmUrls', () => {
  it('warms PDFium, then qpdf, for the full edition', () => {
    const urls = warmWasmUrls('full');
    expect(urls).toHaveLength(2);
    expect(urls[0]).toMatch(/pdfium.*\.wasm/);
    expect(urls[1]).toMatch(/qpdf.*\.wasm/);
  });

  it('warms PDFium only for the compact edition, which runs no qpdf tool', () => {
    const urls = warmWasmUrls('compact');
    expect(urls).toEqual([warmWasmUrls('full')[0]]);
  });
});

describe('runAfterFirstPage (PF-20)', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('runs once when a page canvas first reads rendered', async () => {
    const run = vi.fn();
    runAfterFirstPage(run, 5_000);
    const canvas = document.body.appendChild(document.createElement('canvas'));
    canvas.dataset.state = 'preview';
    await Promise.resolve();
    expect(run).not.toHaveBeenCalled();
    canvas.dataset.state = 'rendered';
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    canvas.dataset.state = 'placeholder';
    canvas.dataset.state = 'rendered';
    await Promise.resolve();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('runs after the fallback once armed, and not before', () => {
    vi.useFakeTimers();
    const run = vi.fn();
    const arm = runAfterFirstPage(run, 5_000);
    vi.advanceTimersByTime(60_000);
    expect(run).not.toHaveBeenCalled();
    arm();
    vi.advanceTimersByTime(4_999);
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
