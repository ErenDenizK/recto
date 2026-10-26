/**
 * Test doubles for the Text view's contract (`contract.ts`): a loader over pages written in the
 * test, crops that answer with a one-pixel PNG, and an OCR offer that records its runs. Only the
 * view's tests import this; nothing in the app does.
 */
import type { TextViewBlock, TextViewPage } from '@pdf-editor/engine';

import type { PageFrame } from '../viewer/geometry';
import type { ImageCrops, OcrOffer, TextViewLoader, TextViewPageState } from './contract';

const box = (y: number, height = 20) => ({ x: 40, y, width: 400, height });

export function paragraph(page: number, n: number, text: string, y = 40 + n * 60): TextViewBlock {
  return { kind: 'paragraph', id: `p${page + 1}-${n}`, page, bbox: box(y, 40), text };
}

export function heading(page: number, n: number, level: number, text: string): TextViewBlock {
  return { kind: 'heading', id: `p${page + 1}-${n}`, page, bbox: box(n * 60, 30), level, text };
}

export function textPage(page: number, blocks: readonly TextViewBlock[]): TextViewPage {
  return {
    page,
    pageAnchor: `page-${page + 1}`,
    size: { width: 480, height: 640 },
    needsOcr: false,
    blocks,
  };
}

export function scanPage(page: number): TextViewPage {
  return {
    page,
    pageAnchor: `page-${page + 1}`,
    size: { width: 480, height: 640 },
    needsOcr: true,
    blocks: [
      { kind: 'image', id: `p${page + 1}-0`, page, bbox: { x: 0, y: 0, width: 480, height: 640 } },
    ],
  };
}

export interface FakeLoader extends TextViewLoader {
  readonly asked: number[];
  /** Puts a page's state and tells the subscribers. */
  set(page: number, state: TextViewPageState): void;
  readonly invalidated: number[][];
}

/**
 * A loader whose pages are `ready` (back at once when asked) unless the test holds them:
 * `set(page, 'loading')` and `ensure` then leaves the page loading.
 */
export function fakeLoader(
  pages: readonly TextViewPage[],
  options: { hold?: boolean; language?: string } = {},
): FakeLoader {
  const states = new Map<number, TextViewPageState>(
    options.hold ? [] : pages.map((page) => [page.page, page]),
  );
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of [...listeners]) listener();
  };
  const frame: PageFrame = {
    width: 480,
    height: 640,
    rotation: 0,
    cropBox: undefined,
  } as unknown as PageFrame;
  const asked: number[] = [];
  const invalidated: number[][] = [];
  return {
    asked,
    invalidated,
    pageCount: pages.length,
    language: options.language,
    frame: () => frame,
    ensure(page) {
      asked.push(page);
      return Promise.resolve();
    },
    peek: (page) => states.get(page) ?? 'loading',
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    retry(page) {
      asked.push(page);
      const next = pages[page];
      if (next) states.set(page, next);
      notify();
      return Promise.resolve();
    },
    invalidate(list) {
      invalidated.push([...list]);
      for (const page of list) states.delete(page);
      notify();
    },
    dispose: () => undefined,
    set(page, state) {
      states.set(page, state);
      notify();
    },
  };
}

const PNG = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  ),
  (char) => char.charCodeAt(0),
);

export function fakeCrops(): ImageCrops & { readonly calls: { page: number; widthPx: number }[] } {
  const calls: { page: number; widthPx: number }[] = [];
  return {
    calls,
    render(page, _bbox, widthPx) {
      calls.push({ page, widthPx });
      return Promise.resolve(new Blob([PNG], { type: 'image/png' }));
    },
  };
}

export function fakeOcr(): OcrOffer & {
  readonly runs: (readonly number[])[];
  finish(written?: boolean): void;
  fail(): void;
  progress(done: number, total: number): void;
} {
  const runs: (readonly number[])[] = [];
  let settle: { resolve(value: boolean): void; reject(error: Error): void } | undefined;
  let report: ((done: number, total: number) => void) | undefined;
  return {
    runs,
    info: () =>
      Promise.resolve({
        languages: ['tur', 'eng'],
        languageLabel: 'Turkish and English',
        downloadBytes: 25_000_000,
      }),
    run(pages, control) {
      runs.push(pages);
      report = control.onProgress;
      return new Promise<boolean>((resolve, reject) => {
        settle = { resolve, reject };
      });
    },
    finish: (written = true) => settle?.resolve(written),
    fail: () => settle?.reject(new Error('no')),
    progress: (done, total) => report?.(done, total),
  };
}
