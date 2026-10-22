import { describe, expect, it } from 'vitest';

import {
  choosePrintMethod,
  PRINT_DPI,
  PRINT_MIN_DPI,
  printDpi,
  printEnvironment,
} from './print-method';

const letter = { width: 612, height: 792 };
const pages = (count: number) => Array.from({ length: count }, () => letter);

describe('choosePrintMethod (PRD-25)', () => {
  it('prints the PDF in a frame only where a PDF viewer exists and the engine is not WebKit', () => {
    expect(choosePrintMethod({ pdfViewer: true, webkit: false })).toBe('frame');
    expect(choosePrintMethod({ pdfViewer: true, webkit: true })).toBe('pages');
    expect(choosePrintMethod({ pdfViewer: false, webkit: false })).toBe('pages');
    expect(choosePrintMethod({ pdfViewer: undefined, webkit: false })).toBe('pages');
  });

  it('tells WebKit by GestureEvent or navigator.standalone', () => {
    const win = (extra: object, nav: object = {}) =>
      ({ ...extra, navigator: { pdfViewerEnabled: true, ...nav } }) as unknown as Window;
    expect(printEnvironment(win({}))).toEqual({ pdfViewer: true, webkit: false });
    expect(printEnvironment(win({ GestureEvent: Event })).webkit).toBe(true);
    expect(printEnvironment(win({}, { standalone: false })).webkit).toBe(true);
  });
});

describe('printDpi', () => {
  it('renders at print resolution while the pages fit the pixel budget', () => {
    expect(printDpi(pages(1))).toBe(PRINT_DPI);
    expect(printDpi(pages(100))).toBe(PRINT_DPI);
    expect(printDpi([])).toBe(PRINT_DPI);
  });

  it('lowers the resolution for long documents, never below the floor', () => {
    const long = printDpi(pages(400));
    expect(long).toBeLessThan(PRINT_DPI);
    expect(long).toBeGreaterThanOrEqual(PRINT_MIN_DPI);
    expect(printDpi(pages(5000))).toBe(PRINT_MIN_DPI);
  });
});
