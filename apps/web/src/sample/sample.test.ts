/**
 * The teaching sample in the app (MOB-11, MOB-12; components/02-library.md §11, L10; redesign
 * D4-2): the `?sample` parameter's values and its removal from the address, the file per
 * edition and its name and identity, the fetch's outcomes, the link waiting for the launch's
 * restore, a real open through the workspace (Vitest browser mode, real PDFium; Vite serves
 * `public/sample/`) with the page count the manifest gives, the invoice page's details found
 * by Find sensitive data, and the session's rule that the sample joins Recents only once
 * changed.
 */
import { rotatePages } from '@pdf-editor/document-model';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import manifest from '../../test/sample-manifest.json';
import { getEngineService } from '../engine/engine-service';
import { useRecentsStore } from '../files/recents';
import { findPatterns } from '../redaction/patterns';
import { indexPageText } from '../redaction/text-index';
import { flushSession, setSessionEnabled, startSession } from '../session/session';
import { resetSessionStore, useSessionStore } from '../session/session-store';
import { memorySnapshotStorage } from '../session/storage';
import { useAnnouncer } from '../shell/announcer';
import { useUiStore } from '../state/ui-store';
import { resetWorkspace, useWorkspaceStore } from '../state/workspace-store';
import { openSample } from './open-sample';
import {
  fetchSampleBytes,
  isSampleFile,
  SAMPLE_LAST_MODIFIED,
  loadSampleFile,
  sampleFile,
  sampleFileName,
  sampleFileOf,
  sampleUrl,
} from './sample-file';
import { openSampleFromLink, resetSampleLink } from './sample-link';
import { sampleLocaleFromSearch, takeSampleParam } from './sample-param';

describe('sampleLocaleFromSearch', () => {
  it('reads en and tr, and the UI language for any other value', () => {
    expect(sampleLocaleFromSearch('?sample=tr', 'en')).toBe('tr');
    expect(sampleLocaleFromSearch('?sample=EN', 'tr')).toBe('en');
    expect(sampleLocaleFromSearch('?sample', 'tr')).toBe('tr');
    expect(sampleLocaleFromSearch('?sample=', 'en')).toBe('en');
    expect(sampleLocaleFromSearch('?sample=https://example.com/x.pdf', 'tr')).toBe('tr');
    expect(sampleLocaleFromSearch('?lang=tr', 'en')).toBeNull();
    expect(sampleLocaleFromSearch('', 'en')).toBeNull();
  });
});

describe('takeSampleParam', () => {
  let original: string;
  beforeEach(() => {
    original = location.href;
  });
  afterEach(() => {
    history.replaceState(history.state, '', original);
  });

  it('removes the parameter and keeps the rest of the address', () => {
    history.replaceState(history.state, '', `${location.pathname}?lang=tr&sample=en#page=2`);
    expect(takeSampleParam('tr')).toBe('en');
    expect(location.search).toBe('?lang=tr');
    expect(location.hash).toBe('#page=2');
    expect(takeSampleParam('tr')).toBeNull();
  });

  it('leaves an address without it alone', () => {
    history.replaceState(history.state, '', `${location.pathname}?lang=tr`);
    const replace = vi.spyOn(history, 'replaceState');
    expect(takeSampleParam('en')).toBeNull();
    expect(replace).not.toHaveBeenCalled();
    replace.mockRestore();
  });
});

describe('the sample file', () => {
  it('is named for its language, with the first free number beside open copies', () => {
    expect(sampleFileName('en', [])).toBe('Recto sample.pdf');
    expect(sampleFileName('tr', ['Recto sample'])).toBe('Recto örnek belge.pdf');
    expect(sampleFileName('en', ['Recto sample'])).toBe('Recto sample (2).pdf');
    expect(sampleFileName('en', ['Recto sample', 'Recto sample (2)'])).toBe('Recto sample (3).pdf');
  });

  it('is told from a file of the same name by its date', () => {
    const file = sampleFile('tr', new ArrayBuffer(4), ['Recto örnek belge']);
    expect(file.name).toBe('Recto örnek belge (2).pdf');
    expect(file.lastModified).toBe(SAMPLE_LAST_MODIFIED);
    expect(isSampleFile(file)).toBe(true);
    expect(isSampleFile({ name: 'Recto sample.pdf', lastModified: Date.now() })).toBe(false);
    expect(isSampleFile({ name: 'report.pdf', lastModified: SAMPLE_LAST_MODIFIED })).toBe(false);
  });

  it('loads only from the app’s own sample folder, the file of the edition (MOB-12)', () => {
    expect(sampleUrl('tr', 'full', '/recto/')).toBe(
      `${location.origin}/recto/sample/recto-sample-tr.pdf`,
    );
    expect(sampleUrl('en', 'compact', '/')).toBe(
      `${location.origin}/sample/recto-sample-phone-en.pdf`,
    );
    for (const locale of ['en', 'tr'] as const) {
      for (const edition of ['full', 'compact'] as const) {
        const entry = manifest.files.find((f) => f.file === sampleFileOf(locale, edition));
        expect(entry?.edition).toBe(edition === 'compact' ? 'phone' : 'full');
        expect(entry?.locale).toBe(locale);
      }
    }
  });

  it('reports a failed or offline fetch without throwing', async () => {
    const ok = await fetchSampleBytes('en', 'full', () => Promise.resolve(new Response('%PDF')));
    expect(ok.ok).toBe(true);
    const missing = await fetchSampleBytes('en', 'full', () =>
      Promise.resolve(new Response('', { status: 404 })),
    );
    expect(missing).toEqual({ ok: false, reason: 'failed' });
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const offline = await fetchSampleBytes('en', 'full', () =>
      Promise.reject(new TypeError('offline')),
    );
    expect(offline).toEqual({ ok: false, reason: 'offline' });
    online.mockRestore();
  });
});

describe('openSampleFromLink', () => {
  let original: string;
  beforeEach(() => {
    original = location.href;
    resetSampleLink();
  });
  afterEach(() => {
    history.replaceState(history.state, '', original);
    delete document.documentElement.dataset.session;
    useSessionStore.setState({ keeping: 'pending', restoring: false });
    resetSampleLink();
  });

  it('opens once, after the launch’s restore, and never again on a second call', () => {
    history.replaceState(history.state, '', `${location.pathname}?sample=tr`);
    document.documentElement.dataset.session = 'restoring';
    const open = vi.fn(() => Promise.resolve());
    const cancel = openSampleFromLink(open);
    // The parameter leaves the address at once.
    expect(location.search).toBe('');
    useSessionStore.setState({ keeping: 'available', restoring: true });
    expect(open).not.toHaveBeenCalled();
    useSessionStore.setState({ restoring: false });
    expect(open).toHaveBeenCalledExactlyOnceWith('tr');
    cancel();
    openSampleFromLink(open)();
    expect(open).toHaveBeenCalledOnce();
  });

  it('survives a cancelled first call (a development double mount)', () => {
    history.replaceState(history.state, '', `${location.pathname}?sample`);
    document.documentElement.dataset.session = 'restoring';
    const open = vi.fn(() => Promise.resolve());
    openSampleFromLink(open)();
    openSampleFromLink(open);
    useSessionStore.setState({ keeping: 'unavailable' });
    expect(open).toHaveBeenCalledOnce();
  });

  it('does nothing without the parameter', () => {
    const open = vi.fn(() => Promise.resolve());
    openSampleFromLink(open)();
    expect(open).not.toHaveBeenCalled();
  });
});

describe('openSample', () => {
  beforeEach(() => {
    resetWorkspace();
  });
  afterEach(() => {
    resetWorkspace();
  });

  it('opens a fresh document of the full cut each time, the second one numbered', async () => {
    const first = await openSample('en');
    if (first === undefined) throw new Error('the sample did not open');
    const ws = () => useWorkspaceStore.getState().workspace;
    const full = manifest.files.find((f) => f.file === 'recto-sample-en.pdf');
    expect(ws().documents[first]?.title).toBe('Recto sample');
    expect(ws().documents[first]?.pages).toHaveLength(full?.pageCount ?? 0);
    expect(full?.pageCount).toBe(8);
    expect(ws().activeDocument).toBe(first);
    // The cover opens whole (MOB-15); a zoom picked afterwards is the person's.
    expect(useUiStore.getState().fitMode).toBe('page');
    useUiStore.getState().zoomIn();
    await vi.waitFor(() => {
      expect(useAnnouncer.getState().message).toContain('Opened the sample');
    });
    expect(useUiStore.getState().fitMode).toBeNull();

    const second = await openSample('en');
    expect(second).not.toBe(first);
    expect(useUiStore.getState().fitMode).toBe('page');
    expect(ws().documents[second ?? first]?.title).toBe('Recto sample (2)');
    expect(ws().activeDocument).toBe(second);

    const turkish = await openSample('tr');
    expect(ws().documents[turkish ?? first]?.title).toBe('Recto örnek belge');
    expect(useUiStore.getState().fitMode).toBe('page');
    // Turning to another document while the cover's fit stands brings back the view from
    // before the sample (the zoom picked on the first one), not a fit page for every file.
    const picked = useUiStore.getState().zoom;
    useWorkspaceStore.getState().setActive(first);
    expect(useUiStore.getState().fitMode).toBeNull();
    expect(useUiStore.getState().zoom).toBe(picked);
  });

  it('fits the cover whole, then gives fit width back to the next document', async () => {
    useUiStore.getState().zoomFit();
    const other = await openSample('en');
    const sample = await openSample('en');
    if (other === undefined || sample === undefined) throw new Error('the sample did not open');
    expect(useUiStore.getState().fitMode).toBe('page');
    useWorkspaceStore.getState().setActive(other);
    expect(useUiStore.getState().fitMode).toBe('width');
    // The watch ends there: going back to the sample keeps the person's fit width.
    useWorkspaceStore.getState().setActive(sample);
    expect(useUiStore.getState().fitMode).toBe('width');
  });
});

describe('the phone cut and the invoice', () => {
  beforeEach(() => {
    resetWorkspace();
  });
  afterEach(() => {
    resetWorkspace();
  });

  it('loads the compact edition’s file: its own pages, untouched (pristine)', async () => {
    for (const locale of ['en', 'tr'] as const) {
      const file = await loadSampleFile(locale, 'compact', []);
      if (file === undefined) throw new Error('the phone sample did not load');
      const entry = manifest.files.find((f) => f.file === sampleFileOf(locale, 'compact'));
      expect(file.size).toBe(entry?.bytes);
      expect(isSampleFile(file)).toBe(true);
      const { opened } = await useWorkspaceStore.getState().openFiles([file]);
      const id = opened[0]?.documentId;
      const doc =
        id === undefined ? undefined : useWorkspaceStore.getState().workspace.documents[id];
      expect(doc?.pages).toHaveLength(entry?.pageCount ?? -1);
      expect(entry?.pageCount).toBe(6);
    }
  });

  it('has bank details, an e-mail, a phone number and a date for Find sensitive data', async () => {
    for (const locale of ['en', 'tr'] as const) {
      const entry = manifest.files.find((f) => f.file === sampleFileOf(locale, 'full'));
      const invoice = (entry?.pages.indexOf('invoice') ?? -1) + 1;
      expect(invoice).toBe(7);
      const id = await openSample(locale);
      if (id === undefined) throw new Error('the sample did not open');
      const page = useWorkspaceStore.getState().workspace.documents[id]?.pages[invoice - 1];
      if (page?.ref.kind !== 'source') throw new Error('no invoice page');
      const runs = await getEngineService().getPageText(page.ref.source, page.ref.index);
      if (!runs.ok) throw new Error('no text on the invoice page');
      const index = indexPageText(runs.value);
      const found = findPatterns(index.text).map((f) => [f.pattern, f.text]);
      expect(found).toEqual(
        expect.arrayContaining([
          [
            'iban',
            locale === 'en' ? 'GB82 WEST 1234 5698 7654 32' : 'TR33 0006 1005 1978 6457 8413 26',
          ],
          ['email', 'accounts@saltmarsh-press.example'],
          ['phone', locale === 'en' ? '+44 7700 900412' : '+90 212 000 04 12'],
          ['date', locale === 'en' ? '15 October 2026' : '15 Ekim 2026'],
        ]),
      );
    }
  });
});

describe('the sample and Recents', { timeout: 40_000 }, () => {
  beforeEach(() => {
    resetWorkspace();
    resetSessionStore();
    setSessionEnabled(true);
  });
  afterEach(() => {
    resetWorkspace();
    setSessionEnabled(false);
  });

  it('joins Recents only once changed (02.14)', async () => {
    const storage = memorySnapshotStorage();
    const stop = startSession({ edition: 'full', storage, tabId: 'tab-sample' });
    try {
      await vi.waitFor(() => expect(document.documentElement.dataset.session).toBe('ready'), {
        timeout: 15_000,
      });
      const model = () => useWorkspaceStore.getState();
      const untouched = await openSample('en');
      const changed = await openSample('en');
      if (untouched === undefined || changed === undefined) throw new Error('no sample');
      const page = model().workspace.documents[changed]?.pages[0]?.id;
      if (page === undefined) throw new Error('no page');
      model().applyOperation((ws) => rotatePages(ws, [page], 90), 'Rotate');
      model().closeDocument(untouched);
      await flushSession();
      model().closeDocument(changed);
      await flushSession();
      await vi.waitFor(() => {
        const rows = useRecentsStore.getState().entries;
        expect(rows.find((e) => e.kept?.snapshotId === `kept-${changed}`)?.name).toBe(
          'Recto sample (2).pdf',
        );
      });
      expect(storage.files.has(`kept/kept-${changed}.json`)).toBe(true);
      expect(storage.files.has(`kept/kept-${untouched}.json`)).toBe(false);
      expect(useRecentsStore.getState().entries.some((e) => e.name === 'Recto sample.pdf')).toBe(
        false,
      );
    } finally {
      stop();
      delete document.documentElement.dataset.session;
    }
  });
});
