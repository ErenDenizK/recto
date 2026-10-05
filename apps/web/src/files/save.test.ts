/**
 * Save planning and the write (ADR-0032 §2.1; flows §8.2 J13A; spec redesign D0-8): the route
 * for each environment, the press counts (3 the first time, 1 after), the read-back that
 * verifies a write, and one save end to end against a stubbed handle (Replace asked once per
 * file and session, the write prompt once, the saved mark moving).
 */
import {
  addSource,
  createHistory,
  createSequentialIdGenerator,
  createWorkspace,
  type DocumentId,
  splitDocument,
  type Workspace,
} from '@pdf-editor/document-model';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readAnnotations, whenIdle } from '../annotations/edit-runner';
import { prepareExport } from '../export/export-service';
import { applyRedactionPlans } from '../redaction/apply';
import { resetSavedMarks, isInFile, useSavedStore, watchSavedMarks } from '../state/saved-store';
import { resetWorkspace, useWorkspaceStore } from '../state/workspace-store';
import { resetToasts, useToastStore } from '../ui/Toast/toast-store';
import { useRecentsStore } from './recents';
import {
  answerSaveQuestion,
  DONT_ASK_KEY,
  planSave,
  pressesFor,
  rememberDocumentHandle,
  resetSave,
  sameBytes,
  saveDocument,
  type SaveEnvironment,
  saveProgress,
  useSaveStore,
  type WritableFileHandle,
  writeAndVerify,
} from './save';

const written = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55]);

vi.mock(import('../export/export-service'), async (importOriginal) => ({
  ...(await importOriginal()),
  prepareExport: vi.fn(() =>
    Promise.resolve({
      ok: true as const,
      value: {
        bytes: written.slice().buffer,
        verification: { ok: true, problems: [] },
      } as never,
    }),
  ),
}));

vi.mock(import('../redaction/apply'), async (importOriginal) => ({
  ...(await importOriginal()),
  applyRedactionPlans: vi.fn((plans: readonly { plan: { areas: readonly unknown[] } }[]) =>
    Promise.resolve({
      kind: 'applied' as const,
      label: 'Redactions applied',
      sources: plans.map((p) => ({ result: { plan: { areas: p.plan.areas } } })) as never,
    }),
  ),
}));

vi.mock(import('../annotations/edit-runner'), async (importOriginal) => ({
  ...(await importOriginal()),
  readAnnotations: vi.fn(() => Promise.resolve([])),
  whenIdle: vi.fn(() => Promise.resolve()),
}));

const ENV: SaveEnvironment = {
  inFile: false,
  handle: false,
  replaceAnswered: false,
  savePicker: false,
  share: false,
};

describe('planSave', () => {
  it('writes nothing when everything is in the file', () => {
    expect(planSave({ ...ENV, inFile: true, handle: true })).toEqual({
      route: 'nothing',
      askReplace: false,
    });
  });

  it('writes in place with a handle, asking Replace until it was answered', () => {
    expect(planSave({ ...ENV, handle: true, savePicker: true })).toEqual({
      route: 'in-place',
      askReplace: true,
    });
    expect(planSave({ ...ENV, handle: true, replaceAnswered: true })).toEqual({
      route: 'in-place',
      askReplace: false,
    });
  });

  it('opens the save picker without a handle (Chromium 153 after a restore, combines)', () => {
    expect(planSave({ ...ENV, savePicker: true })).toEqual({ route: 'picker', askReplace: false });
  });

  it('shares on a touch tablet and downloads elsewhere without File System Access', () => {
    expect(planSave({ ...ENV, share: true }).route).toBe('share');
    expect(planSave(ENV).route).toBe('download');
  });

  it('J13A: 3 presses the first time (Save, Replace, the prompt), 1 after', () => {
    const first = planSave({ ...ENV, handle: true });
    expect(pressesFor(first, false)).toBe(3);
    const later = planSave({ ...ENV, handle: true, replaceAnswered: true });
    expect(pressesFor(later, true)).toBe(1);
    expect(pressesFor(planSave({ ...ENV, savePicker: true }), false)).toBe(2);
    expect(pressesFor(planSave(ENV), false)).toBe(1);
  });
});

describe('progress and bytes', () => {
  it('progress only moves forward through the phases and stays under the write', () => {
    const steps = [
      saveProgress({ phase: 'reading', done: 0, total: 2 }),
      saveProgress({ phase: 'reading', done: 2, total: 2 }),
      saveProgress({ phase: 'assembling', done: 3, total: 6 }),
      saveProgress({ phase: 'assembling', done: 6, total: 6 }),
      saveProgress({ phase: 'verifying', done: 1, total: 1 }),
      saveProgress({ phase: 'redaction', done: 1, total: 1 }),
    ];
    for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeGreaterThanOrEqual(steps[i - 1]!);
    expect(steps.at(-1)).toBeLessThanOrEqual(95);
  });

  it('compares bytes exactly', () => {
    expect(sameBytes(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).toBe(true);
    expect(sameBytes(new Uint8Array([1, 2]), new Uint8Array([1, 3]))).toBe(false);
    expect(sameBytes(new Uint8Array([1]), new Uint8Array([1, 2]))).toBe(false);
  });
});

interface StubHandle extends WritableFileHandle {
  bytes: Uint8Array<ArrayBuffer>;
  prompts: number;
  permission: PermissionState;
  /** Corrupts what is read back (a write that did not land as written). */
  corrupt?: boolean;
  /** The file is gone (moved or deleted). */
  missing?: boolean;
}

function stubHandle(name = 'report.pdf'): StubHandle {
  const gone = () => Promise.reject(new DOMException('gone', 'NotFoundError'));
  const handle: StubHandle = {
    kind: 'file',
    name,
    bytes: new Uint8Array([1, 2, 3]),
    prompts: 0,
    permission: 'prompt',
    getFile() {
      if (handle.missing) return gone();
      const bytes = handle.corrupt ? handle.bytes.map((b) => b ^ 1) : handle.bytes;
      return Promise.resolve(new File([bytes], name, { type: 'application/pdf' }));
    },
    createWritable() {
      if (handle.missing) return gone();
      const chunks: Uint8Array[] = [];
      return Promise.resolve({
        write(data: BufferSource) {
          const view = ArrayBuffer.isView(data)
            ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
            : new Uint8Array(data);
          chunks.push(view.slice());
          return Promise.resolve();
        },
        close() {
          const size = chunks.reduce((n, c) => n + c.byteLength, 0);
          const all = new Uint8Array(size);
          let at = 0;
          for (const chunk of chunks) {
            all.set(chunk, at);
            at += chunk.byteLength;
          }
          handle.bytes = all;
          return Promise.resolve();
        },
        abort() {
          chunks.length = 0;
          return Promise.resolve();
        },
      });
    },
    queryPermission({ mode }) {
      return Promise.resolve(mode === 'read' ? 'granted' : handle.permission);
    },
    requestPermission() {
      handle.prompts += 1;
      handle.permission = 'granted';
      return Promise.resolve('granted');
    },
  };
  return handle;
}

describe('writeAndVerify', () => {
  it('writes, then reads the file back and compares it', async () => {
    const handle = stubHandle();
    await writeAndVerify(handle, written.slice().buffer);
    expect([...handle.bytes]).toEqual([...written]);
  });

  it('fails when the file does not read back as written', async () => {
    const handle = stubHandle();
    handle.corrupt = true;
    await expect(writeAndVerify(handle, written.slice().buffer)).rejects.toMatchObject({
      reason: 'mismatch',
    });
  });

  it('fails as "moved" when the file is gone', async () => {
    const handle = stubHandle();
    handle.missing = true;
    await expect(writeAndVerify(handle, written.slice().buffer)).rejects.toMatchObject({
      reason: 'moved',
    });
  });
});

const ids = createSequentialIdGenerator('save');

function redactMark(id: string): never {
  const rect = { x: 72, y: 700, width: 120, height: 14 };
  return { kind: 'redact', id, pageIndex: 0, quads: [rect], rect, color: '#ff0000' } as never;
}

function openedWorkspace(): Workspace {
  return addSource(
    createWorkspace(),
    {
      name: 'report.pdf',
      byteLength: 3,
      pageCount: 2,
      pages: [
        { size: { width: 612, height: 792 }, rotation: 0 },
        { size: { width: 612, height: 792 }, rotation: 0 },
      ],
      fingerprint: 'report',
      flags: {
        encrypted: false,
        repaired: false,
        hasAcroForm: false,
        hasXfa: false,
        hasSignatures: false,
        tagged: false,
        linearized: false,
      },
      metadata: { policy: 'inherit-first-source' },
      outline: [],
    },
    ids,
  ).workspace;
}

/** Waits until a question is open (or the save finished). */
async function question(): Promise<string | undefined> {
  await vi.waitFor(() => {
    const { pending, jobs } = useSaveStore.getState();
    if (pending === null && Object.keys(jobs).length > 0) throw new Error('not yet');
  });
  return useSaveStore.getState().pending?.question.kind;
}

function rotateFirstPage(id: DocumentId): void {
  const page = useWorkspaceStore.getState().workspace.documents[id]?.pages[0]?.id;
  if (page) useWorkspaceStore.getState().rotatePages([page], 90);
}

describe('saveDocument', () => {
  let id: DocumentId;

  beforeEach(() => {
    resetWorkspace();
    resetSavedMarks();
    resetSave();
    resetToasts();
    watchSavedMarks();
    const workspace = openedWorkspace();
    id = workspace.documentOrder[0] as DocumentId;
    useWorkspaceStore.setState({ history: createHistory(workspace, 'Open', 1), workspace });
  });

  afterEach(() => {
    resetSave();
    resetWorkspace();
    vi.mocked(applyRedactionPlans).mockClear();
  });

  it('says everything is in the file and writes nothing when nothing is new', async () => {
    const handle = stubHandle();
    rememberDocumentHandle(id, handle);
    expect(isInFile(useWorkspaceStore.getState().workspace, id)).toBe(true);
    await saveDocument(id);
    expect(useSaveStore.getState().pending).toBeNull();
    expect([...handle.bytes]).toEqual([1, 2, 3]);
  });

  it('asks Replace and the write prompt the first time, then saves with one press', async () => {
    const handle = stubHandle();
    rememberDocumentHandle(id, handle);
    rotateFirstPage(id);
    expect(isInFile(useWorkspaceStore.getState().workspace, id)).toBe(false);

    const first = saveDocument(id);
    expect(await question()).toBe('replace');
    answerSaveQuestion('replace');
    await first;
    expect(handle.prompts).toBe(1);
    expect([...handle.bytes]).toEqual([...written]);
    expect(isInFile(useWorkspaceStore.getState().workspace, id)).toBe(true);
    expect(useSavedStore.getState().marks[id]?.handleKept).toBe(true);
    expect(useToastStore.getState().shown.map((t) => t.text)).toContain('Saved · verified');

    // The second save over the same file this session: no question, no prompt.
    rotateFirstPage(id);
    handle.bytes = new Uint8Array([9]);
    await saveDocument(id);
    expect(useSaveStore.getState().pending).toBeNull();
    expect(handle.prompts).toBe(1);
    expect([...handle.bytes]).toEqual([...written]);
    expect(isInFile(useWorkspaceStore.getState().workspace, id)).toBe(true);
  });

  it('"Save a copy…" and Esc write nothing', async () => {
    const handle = stubHandle();
    rememberDocumentHandle(id, handle);
    rotateFirstPage(id);
    const cancelled = saveDocument(id);
    expect(await question()).toBe('replace');
    answerSaveQuestion('cancel');
    await cancelled;
    expect([...handle.bytes]).toEqual([1, 2, 3]);
    expect(handle.prompts).toBe(0);
    expect(isInFile(useWorkspaceStore.getState().workspace, id)).toBe(false);
  });

  it('"Don\'t ask again for this file" is kept on this device', async () => {
    const handle = stubHandle();
    rememberDocumentHandle(id, handle);
    rotateFirstPage(id);
    const first = saveDocument(id);
    expect(await question()).toBe('replace');
    answerSaveQuestion('replace', { dontAsk: true });
    await first;
    expect(JSON.parse(localStorage.getItem(DONT_ASK_KEY) ?? '[]')).toEqual(['report.pdf']);

    // A new session (the handle is a new object): the question is not asked again.
    resetSave();
    const again = stubHandle();
    again.permission = 'granted';
    rememberDocumentHandle(id, again);
    rotateFirstPage(id);
    await saveDocument(id);
    expect([...again.bytes]).toEqual([...written]);
  });

  it('a failed read-back keeps the change out of the file and says so', async () => {
    const handle = stubHandle();
    handle.permission = 'granted';
    handle.corrupt = true;
    rememberDocumentHandle(id, handle);
    rotateFirstPage(id);
    const save = saveDocument(id);
    expect(await question()).toBe('replace');
    answerSaveQuestion('replace');
    await save;
    expect(isInFile(useWorkspaceStore.getState().workspace, id)).toBe(false);
    const failure = useToastStore.getState().shown.find((t) => t.kind === 'failure');
    expect(failure?.text).toBe(
      'Could not save report.pdf: the file did not read back as it was written',
    );
  });

  it('asks about unapplied marks first; "Save without applying" leaves them and saves', async () => {
    const handle = stubHandle();
    handle.permission = 'granted';
    rememberDocumentHandle(id, handle);
    vi.mocked(readAnnotations).mockResolvedValueOnce([redactMark('m1'), redactMark('m2')]);
    rotateFirstPage(id);
    const save = saveDocument(id);
    expect(await question()).toBe('marks');
    expect(useSaveStore.getState().pending?.question).toMatchObject({ kind: 'marks', count: 2 });
    answerSaveQuestion('without');
    expect(await question()).toBe('replace');
    answerSaveQuestion('replace');
    await save;
    expect(applyRedactionPlans).not.toHaveBeenCalled();
    expect(useToastStore.getState().shown.map((t) => t.text)).toContain('Saved · verified');
  });

  it('"Apply and save" applies the marks first and names the removed areas', async () => {
    const handle = stubHandle();
    handle.permission = 'granted';
    rememberDocumentHandle(id, handle);
    vi.mocked(readAnnotations).mockResolvedValueOnce([redactMark('m1'), redactMark('m2')]);
    rotateFirstPage(id);
    const save = saveDocument(id);
    expect(await question()).toBe('marks');
    answerSaveQuestion('apply');
    expect(await question()).toBe('replace');
    answerSaveQuestion('replace');
    await save;
    expect(applyRedactionPlans).toHaveBeenCalledTimes(1);
    expect(useToastStore.getState().shown.map((t) => t.text)).toContain(
      'Saved · 2 areas removed for good · verified',
    );
  });

  it('a split part never writes over the file it came from; its first Save is Save as', async () => {
    // report.pdf was opened through the picker: Recents holds its handle, and its Replace
    // question was answered for good. Splitting makes new documents from report.pdf's pages.
    const original = stubHandle();
    original.permission = 'granted';
    rememberDocumentHandle(id, original);
    localStorage.setItem(DONT_ASK_KEY, JSON.stringify(['report.pdf']));
    useRecentsStore.setState({
      entries: [{ id: 'recent-1', name: 'report.pdf', size: 3, openedAt: 1, handle: original }],
    });
    useWorkspaceStore
      .getState()
      .applyOperation((ws, gen) => splitDocument(ws, id, { mode: 'every', n: 1 }, gen), 'Split');
    const part = useWorkspaceStore.getState().workspace.documentOrder[0] as DocumentId;
    expect(part).not.toBe(id);

    const picked = stubHandle('report (1 of 2).pdf');
    const picker = vi.fn(() => Promise.resolve(picked));
    const before = Object.getOwnPropertyDescriptor(window, 'showSaveFilePicker');
    Object.defineProperty(window, 'showSaveFilePicker', { value: picker, configurable: true });
    try {
      await saveDocument(part);
    } finally {
      if (before) Object.defineProperty(window, 'showSaveFilePicker', before);
      else delete (window as { showSaveFilePicker?: unknown }).showSaveFilePicker;
      useRecentsStore.setState({ entries: [] });
      localStorage.removeItem(DONT_ASK_KEY);
    }
    expect([...original.bytes]).toEqual([1, 2, 3]);
    expect(picker).toHaveBeenCalledTimes(1);
    expect([...picked.bytes]).toEqual([...written]);
  });

  /** Replaces the save picker for one test; returns the restore. */
  function withSavePicker(picker: unknown): () => void {
    const before = Object.getOwnPropertyDescriptor(window, 'showSaveFilePicker');
    Object.defineProperty(window, 'showSaveFilePicker', { value: picker, configurable: true });
    return () => {
      if (before) Object.defineProperty(window, 'showSaveFilePicker', before);
      else delete (window as { showSaveFilePicker?: unknown }).showSaveFilePicker;
    };
  }

  /** A picked file (the picker created it, empty) that can be removed. */
  function pickedHandle(): StubHandle & { removed: number } {
    const handle = Object.assign(stubHandle('report.pdf'), { removed: 0 });
    handle.bytes = new Uint8Array();
    handle.permission = 'granted';
    return Object.assign(handle, {
      remove: () => {
        handle.removed += 1;
        return Promise.resolve();
      },
    });
  }

  it('07.7: a picked file the save could not fill is removed, and the failure says so', async () => {
    const picked = pickedHandle();
    const restore = withSavePicker(() => Promise.resolve(picked));
    vi.mocked(prepareExport).mockResolvedValueOnce({
      ok: true,
      value: { bytes: written.slice().buffer, verification: { ok: false, problems: [] } } as never,
    });
    try {
      rotateFirstPage(id);
      await saveDocument(id);
    } finally {
      restore();
    }
    expect(picked.removed).toBe(1);
    const failure = useToastStore.getState().shown.find((t) => t.kind === 'failure');
    expect(failure?.detail).toBe('The empty file was removed.');
    expect(isInFile(useWorkspaceStore.getState().workspace, id)).toBe(false);
  });

  it('opens the write prompt before reading the marks when no question renews the press', async () => {
    const handle = stubHandle();
    rememberDocumentHandle(id, handle);
    localStorage.setItem(DONT_ASK_KEY, JSON.stringify(['report.pdf']));
    let idle: () => void = () => undefined;
    vi.mocked(whenIdle).mockImplementationOnce(
      () => new Promise<void>((resolve) => (idle = resolve)),
    );
    try {
      rotateFirstPage(id);
      const save = saveDocument(id);
      // The edit runner is still busy: the prompt has had the press's activation already.
      await vi.waitFor(() => expect(handle.prompts).toBe(1));
      idle();
      await save;
    } finally {
      localStorage.removeItem(DONT_ASK_KEY);
    }
    expect([...handle.bytes]).toEqual([...written]);
  });

  it('opens the save picker before reading the marks, then still asks about them', async () => {
    const picked = pickedHandle();
    const picker = vi.fn(() => Promise.resolve(picked));
    const restore = withSavePicker(picker);
    let idle: () => void = () => undefined;
    vi.mocked(whenIdle).mockImplementationOnce(
      () => new Promise<void>((resolve) => (idle = resolve)),
    );
    vi.mocked(readAnnotations).mockResolvedValueOnce([redactMark('m1')]);
    try {
      rotateFirstPage(id);
      const save = saveDocument(id);
      await vi.waitFor(() => expect(picker).toHaveBeenCalledTimes(1));
      idle();
      expect(await question()).toBe('marks');
      // Cancelling now leaves no empty file behind.
      answerSaveQuestion('cancel');
      await save;
    } finally {
      restore();
    }
    expect(picked.removed).toBe(1);
    expect(isInFile(useWorkspaceStore.getState().workspace, id)).toBe(false);
  });

  it('downloads a copy where the browser cannot write in place', async () => {
    const picker = Object.getOwnPropertyDescriptor(window, 'showSaveFilePicker');
    Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    try {
      rotateFirstPage(id);
      await saveDocument(id);
      expect(click).toHaveBeenCalledTimes(1);
      const shown = useToastStore.getState().shown;
      expect(shown.map((t) => t.text)).toContain('Downloaded report.pdf');
      expect(shown.find((t) => t.text === 'Downloaded report.pdf')?.detail).toMatch(
        /new copy\. The opened file is unchanged/,
      );
      expect(isInFile(useWorkspaceStore.getState().workspace, id)).toBe(true);
    } finally {
      click.mockRestore();
      if (picker) Object.defineProperty(window, 'showSaveFilePicker', picker);
      else delete (window as { showSaveFilePicker?: unknown }).showSaveFilePicker;
    }
  });
});
