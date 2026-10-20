/**
 * The Office conversion flow (ADR-0035 §5) with a fake converter and fake effects: consent
 * only when the package is missing, the download's progress and cancel, the one reload into
 * isolation, and the PDF handed to the normal open path.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { OfficeConverter } from './converter';
import { OfficeError } from './office-error';
import {
  acceptDownload,
  beginOffice,
  cancelOffice,
  type OfficeDeps,
  setOfficeDeps,
} from './office-flow';
import { closeOffice, openOffice, useOfficeStore } from './office-store';

const docx = (name = 'report.docx') =>
  new File([new Uint8Array([0x50, 0x4b, 3, 4])], name, {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

function fakeConverter(answer: (input: Uint8Array) => Promise<Uint8Array>): OfficeConverter {
  const convert: OfficeConverter['convert'] = (input, _ext, onProgress) => {
    onProgress?.({ phase: 'starting', percent: null });
    onProgress?.({ phase: 'converting', percent: 50 });
    return answer(input);
  };
  return { convert, dispose: vi.fn() };
}

const PDF = new TextEncoder().encode('%PDF-1.7 fake');

function fakes(overrides: Partial<OfficeDeps> = {}) {
  const opened: File[][] = [];
  const deps: Partial<OfficeDeps> = {
    installed: () => Promise.resolve(true),
    install: () => Promise.resolve(),
    downloadBytes: () => 79_000_000,
    isolated: () => true,
    canIsolate: () => true,
    refresh: () => Promise.resolve(true),
    stash: vi.fn(() => Promise.resolve()),
    takeStash: () => Promise.resolve([]),
    takeReloadFlag: () => false,
    reload: vi.fn(),
    converter: () => fakeConverter(() => Promise.resolve(PDF)),
    open: (files) => {
      opened.push([...files]);
      return Promise.resolve();
    },
    ...overrides,
  };
  setOfficeDeps(deps);
  return { deps, opened };
}

const step = () => useOfficeStore.getState().step;

afterEach(() => {
  setOfficeDeps(undefined);
  closeOffice();
});

describe('the Office flow (ADR-0035 §5)', () => {
  it('asks before the one-time download when the package is missing', async () => {
    fakes({ installed: () => Promise.resolve(false) });
    openOffice([docx()]);
    await beginOffice();
    expect(step()).toEqual({ kind: 'consent', downloadBytes: 79_000_000 });
  });

  it('converts straight away when the package is on the device, and opens the PDF', async () => {
    const { opened } = fakes();
    openOffice([docx('Q3 plan.docx')]);
    await beginOffice();
    expect(useOfficeStore.getState().files).toBeNull();
    expect(opened).toHaveLength(1);
    const [pdf] = opened[0] ?? [];
    expect(pdf?.name).toBe('Q3 plan.pdf');
    expect(pdf?.type).toBe('application/pdf');
    expect(new Uint8Array(await (pdf as File).arrayBuffer())).toEqual(PDF);
  });

  it('downloads with progress, then converts', async () => {
    const seen: number[] = [];
    const { opened } = fakes({
      installed: () => Promise.resolve(false),
      install: ({ onProgress }) => {
        for (const loaded of [0, 40, 79]) {
          onProgress?.({ loaded, total: 79 });
          seen.push((step() as { loaded: number }).loaded);
        }
        return Promise.resolve();
      },
    });
    openOffice([docx()]);
    await beginOffice();
    await acceptDownload();
    expect(seen).toEqual([0, 40, 79]);
    expect(opened).toHaveLength(1);
  });

  it('cancels a download: the signal fires and the sheet closes', async () => {
    let signal: AbortSignal | undefined;
    let release: () => void = () => undefined;
    fakes({
      installed: () => Promise.resolve(false),
      install: (options) =>
        new Promise((_resolve, reject) => {
          signal = options.signal;
          release = () => reject(new OfficeError('aborted', 'cancelled'));
        }),
    });
    openOffice([docx()]);
    await beginOffice();
    const running = acceptDownload();
    // The download has started: the install holds its signal.
    await vi.waitFor(() => expect(signal).toBeDefined());
    expect(step().kind).toBe('downloading');
    cancelOffice();
    expect(signal?.aborted).toBe(true);
    release();
    await running;
    expect(useOfficeStore.getState().files).toBeNull();
  });

  it('says why a download failed and offers to try again', async () => {
    fakes({
      installed: () => Promise.resolve(false),
      install: () => Promise.reject(new OfficeError('corrupt', 'bad hash')),
    });
    openOffice([docx()]);
    await beginOffice();
    await acceptDownload();
    expect(step()).toMatchObject({ kind: 'failed', reason: 'corrupt', retry: 'download' });
  });

  it('stashes the files and reloads once when the page is not isolated yet', async () => {
    const { deps } = fakes({ isolated: () => false });
    const files = [docx()];
    openOffice(files);
    await beginOffice();
    expect(step().kind).toBe('reloading');
    expect(deps.stash).toHaveBeenCalledWith(files);
    expect(deps.reload).toHaveBeenCalledTimes(1);
  });

  it('resumes from the stash after the reload and converts', async () => {
    const { opened } = fakes({
      takeStash: () => Promise.resolve([docx()]),
      takeReloadFlag: () => true,
    });
    openOffice([], true);
    await beginOffice();
    expect(opened[0]?.[0]?.name).toBe('report.pdf');
  });

  it('does not reload twice: still not isolated after the reload is a failure', async () => {
    const { deps } = fakes({
      isolated: () => false,
      takeStash: () => Promise.resolve([docx()]),
      takeReloadFlag: () => true,
    });
    openOffice([], true);
    await beginOffice();
    expect(step()).toMatchObject({ kind: 'failed', reason: 'isolation' });
    expect(deps.reload).not.toHaveBeenCalled();
  });

  it('cannot isolate without a service worker', async () => {
    const { deps } = fakes({ isolated: () => false, canIsolate: () => false });
    openOffice([docx()]);
    await beginOffice();
    expect(step()).toMatchObject({ kind: 'failed', reason: 'isolation', retry: null });
    expect(deps.reload).not.toHaveBeenCalled();
  });

  it('names the file that did not convert, and still opens the ones that did', async () => {
    let calls = 0;
    const { opened } = fakes({
      converter: () =>
        fakeConverter(() => {
          calls += 1;
          return calls === 2
            ? Promise.reject(new OfficeError('convert', 'LibreOffice said no'))
            : Promise.resolve(PDF);
        }),
    });
    openOffice([docx('a.docx'), docx('b.docx')]);
    await beginOffice();
    expect(opened[0]?.map((file) => file.name)).toEqual(['a.pdf']);
    expect(step()).toMatchObject({ kind: 'failed', reason: 'convert', name: 'b.docx' });
  });
});
