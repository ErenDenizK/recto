/**
 * The teaching sample in the app (components/02-library.md §11, L10; redesign D4-2): the
 * `?sample` parameter's values and its removal from the address, the file's name and
 * identity, the fetch's outcomes, the link waiting for the launch's restore, a real open
 * through the workspace (Vitest browser mode, real PDFium; Vite serves `public/sample/`), and
 * the session's rule that the sample joins Recents only once changed.
 */
import { rotatePages } from '@pdf-editor/document-model';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useRecentsStore } from '../files/recents';
import { flushSession, setSessionEnabled, startSession } from '../session/session';
import { resetSessionStore, useSessionStore } from '../session/session-store';
import { memorySnapshotStorage } from '../session/storage';
import { useAnnouncer } from '../shell/announcer';
import { resetWorkspace, useWorkspaceStore } from '../state/workspace-store';
import { openSample } from './open-sample';
import {
  fetchSampleBytes,
  isSampleFile,
  SAMPLE_LAST_MODIFIED,
  sampleFile,
  sampleFileName,
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

  it('loads only from the app’s own sample folder', () => {
    expect(sampleUrl('tr', '/recto/')).toBe(`${location.origin}/recto/sample/recto-sample-tr.pdf`);
  });

  it('reports a failed or offline fetch without throwing', async () => {
    const ok = await fetchSampleBytes('en', () => Promise.resolve(new Response('%PDF')));
    expect(ok.ok).toBe(true);
    const missing = await fetchSampleBytes('en', () =>
      Promise.resolve(new Response('', { status: 404 })),
    );
    expect(missing).toEqual({ ok: false, reason: 'failed' });
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const offline = await fetchSampleBytes('en', () => Promise.reject(new TypeError('offline')));
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

  it('opens a fresh four-page document each time, the second one numbered', async () => {
    const first = await openSample('en');
    if (first === undefined) throw new Error('the sample did not open');
    const ws = () => useWorkspaceStore.getState().workspace;
    expect(ws().documents[first]?.title).toBe('Recto sample');
    expect(ws().documents[first]?.pages).toHaveLength(4);
    expect(ws().activeDocument).toBe(first);
    await vi.waitFor(() => {
      expect(useAnnouncer.getState().message).toContain('Opened the sample');
    });

    const second = await openSample('en');
    expect(second).not.toBe(first);
    expect(ws().documents[second ?? first]?.title).toBe('Recto sample (2)');
    expect(ws().activeDocument).toBe(second);

    const turkish = await openSample('tr');
    expect(ws().documents[turkish ?? first]?.title).toBe('Recto örnek belge');
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
