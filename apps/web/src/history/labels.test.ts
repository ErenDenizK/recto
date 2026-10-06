/**
 * What ↶ ↷ and the History scrubber say about a step (01-frame F3 §5, 08-feedback FB7 §5), in
 * English and Turkish, from `HistoryEntry.meta` (spec redesign X10).
 */
import {
  addSource,
  createHistory,
  createSequentialIdGenerator,
  createWorkspace,
  type DocumentId,
  type History,
  type HistoryEntryMeta,
  pushHistory,
  rotatePages,
  type SourceInput,
  setActiveDocument,
  type Workspace,
} from '@pdf-editor/document-model';
import { afterEach, describe, expect, it } from 'vitest';

import { m, setLocale } from '../i18n';
import {
  inSentence,
  labelNamesPage,
  openedLabel,
  redoTooltip,
  scrubberSteps,
  stepPhrase,
  undoTooltip,
} from './labels';

const ids = createSequentialIdGenerator('h');

function source(name: string, pageCount: number): SourceInput {
  return {
    name,
    byteLength: 1000 * pageCount,
    pageCount,
    pages: Array.from({ length: pageCount }, () => ({
      size: { width: 612, height: 792 },
      rotation: 0 as const,
    })),
    fingerprint: `fp-${name}`,
    flags: {
      encrypted: false,
      repaired: false,
      hasAcroForm: false,
      hasXfa: false,
      hasSignatures: false,
      tagged: false,
      linearized: false,
    },
    metadata: { policy: 'explicit' },
    outline: [],
  };
}

function two(): { ws: Workspace; a: DocumentId; b: DocumentId } {
  const first = addSource(createWorkspace(), source('report.pdf', 4), ids);
  const second = addSource(first.workspace, source('agreement.pdf', 2), ids);
  const ws = setActiveDocument(second.workspace, first.documentId);
  return { ws, a: first.documentId, b: second.documentId };
}

function step(label: string, meta?: HistoryEntryMeta) {
  return meta === undefined ? { label } : { label, meta };
}

afterEach(() => setLocale('en'));

describe('inSentence and labelNamesPage', () => {
  it('lowers a first word, keeps an acronym, lowers the Turkish dotted capital', () => {
    expect(inSentence('Highlight on page 3')).toBe('highlight on page 3');
    expect(inSentence('OCR applied')).toBe('OCR applied');
    setLocale('tr');
    expect(inSentence('İmza eklendi')).toBe('imza eklendi');
  });

  it('finds the words that name the page, not a bare or longer number', () => {
    expect(labelNamesPage('Highlight on page 3', 3)).toBe(true);
    expect(labelNamesPage('Pen on page 1 · 5 strokes', 1)).toBe(true);
    expect(labelNamesPage('Highlight on page 13', 1)).toBe(false);
    expect(labelNamesPage('Rotate 1 page', 1)).toBe(false);
    expect(labelNamesPage('Move highlight', 3)).toBe(false);
    setLocale('tr');
    expect(labelNamesPage('3. sayfaya vurgu eklendi', 3)).toBe(true);
    expect(labelNamesPage('13. sayfaya vurgu eklendi', 3)).toBe(false);
    expect(labelNamesPage('1 sayfa döndürüldü', 1)).toBe(false);
  });
});

describe('stepPhrase', () => {
  it('adds the page when the label does not say it, in English and Turkish', () => {
    const { ws, a } = two();
    const moved = step('Move highlight', { documentId: a, page: 3, kind: 'annotation.update' });
    expect(stepPhrase(moved, { workspace: ws })).toBe('move highlight on page 3');
    const created = step('Highlight on page 3', { documentId: a, page: 3 });
    expect(stepPhrase(created, { workspace: ws })).toBe('highlight on page 3');
    const rotated = step('Rotate 1 page', { documentId: a, page: 1, kind: 'page' });
    expect(stepPhrase(rotated, { workspace: ws })).toBe('rotate 1 page on page 1');
    setLocale('tr');
    const tr = step('Vurgu taşındı', { documentId: a, page: 3, kind: 'annotation.update' });
    expect(stepPhrase(tr, { workspace: ws })).toBe('3. sayfadaki vurgu taşındı');
  });

  it('names another document instead of the page', () => {
    const { ws, b } = two();
    const other = step('Highlight on page 2', { documentId: b, page: 2 });
    // Titles are the file names without the extension (the model's addSource).
    expect(stepPhrase(other, { workspace: ws })).toBe('highlight on page 2 in agreement');
    setLocale('tr');
    expect(stepPhrase(step('Vurgu eklendi', { documentId: b, page: 2 }), { workspace: ws })).toBe(
      'agreement içindeki vurgu eklendi',
    );
  });

  it('leaves opening and closing as their labels say, and steps with no meta', () => {
    const { ws, b } = two();
    expect(
      stepPhrase(step('Open agreement.pdf', { documentId: b, kind: 'open' }), { workspace: ws }),
    ).toBe('open agreement.pdf');
    expect(stepPhrase(step('Rotate 1 page'), { workspace: ws })).toBe('rotate 1 page');
  });
});

describe('undoTooltip and redoTooltip', () => {
  function rotated(): History {
    const { ws, a } = two();
    const page = ws.documents[a]?.pages[2]?.id;
    if (!page) throw new Error('no page');
    let history = createHistory(ws, 'Start', 0);
    // Labels are made in the language of the moment, as the store makes them.
    history = pushHistory(history, rotatePages(ws, [page], 90), m.history_rotate({ count: 1 }), {
      now: 1,
      meta: { documentId: a, page: 3, kind: 'page' },
    });
    return history;
  }

  it('name the step, and say when there is nothing', () => {
    const history = rotated();
    expect(undoTooltip(history)).toBe('Undo rotate 1 page on page 3');
    expect(redoTooltip(history)).toBe('Nothing to redo');
    const undone = { past: [], present: history.past[0]!, future: [history.present] };
    expect(undoTooltip(undone)).toBe('Nothing to undo');
    expect(redoTooltip(undone)).toBe('Redo rotate 1 page on page 3');
  });

  it('in Turkish', () => {
    setLocale('tr');
    const history = rotated();
    expect(undoTooltip(history)).toBe('Geri al: 3. sayfadaki 1 sayfa döndürüldü');
    expect(redoTooltip(history)).toBe('Yinelenecek bir şey yok');
  });
});

describe('scrubberSteps', () => {
  it('lists newest first, skips the empty start, names documents only with two open', () => {
    const { ws, a, b } = two();
    const page = ws.documents[b]?.pages[1]?.id;
    if (!page) throw new Error('no page');
    let history = createHistory(createWorkspace(), 'Start', 0);
    history = pushHistory(history, ws, 'Open report.pdf', {
      now: 1,
      meta: { documentId: a, kind: 'open' },
    });
    history = pushHistory(history, rotatePages(ws, [page], 90), 'Rotate 1 page', {
      now: 2,
      meta: { documentId: b, page: 2, kind: 'page' },
    });
    const steps = scrubberSteps(history);
    expect(steps.map((s) => s.index)).toEqual([2, 1]);
    expect(steps[0]).toMatchObject({
      state: 'present',
      label: 'Rotate 1 page',
      page: 2,
      document: 'agreement',
    });
    expect(steps[0]?.name).toMatch(/^Rotate 1 page, page 2, \d\d[:.]\d\d$/);
    // The opening reads in the past tense in the scrubber (FB7 §5).
    expect(steps[1]).toMatchObject({
      state: 'past',
      label: 'Opened report.pdf',
      document: 'report',
    });
    expect(steps[1]?.page).toBeUndefined();
  });
});

describe('openedLabel', () => {
  it('puts an opening in the past tense, for one file or a drop of several', () => {
    expect(openedLabel(m.history_open({ name: 'report.pdf' }))).toBe('Opened report.pdf');
    expect(openedLabel('Open 2 files')).toBe('Opened 2 files');
    // Any other shape is kept.
    expect(openedLabel('Rotate 1 page')).toBe('Rotate 1 page');
    expect(openedLabel('Open ')).toBe('Open ');
  });

  it('keeps the Turkish, which is in the past tense already', () => {
    setLocale('tr');
    expect(openedLabel(m.history_open({ name: 'rapor.pdf' }))).toBe('rapor.pdf açıldı');
  });
});
