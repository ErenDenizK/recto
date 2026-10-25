/**
 * Annotation CRUD through the real PDFium adapter (EmbedPDF worker), for every kind of
 * spec viewer-annotations.md §3: create → list, update, delete, save → re-open → list, and
 * the conformance of what `save()` writes.
 */

import type { PDFArray, PDFDict, PDFNumber, PDFString } from '@cantoo/pdf-lib';
import { decodePDFRawStream, PDFDocument, PDFName, PDFRawStream } from '@cantoo/pdf-lib';
import type { Rect } from '@pdf-editor/document-model';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import rotatedUrl from '../../../test/fixtures/rotated-pages.pdf?url';
import annotationsUrl from '../../../test/fixtures/annotations.pdf?url';
import { checkAnnotationConformance } from '../src/annotations/conformance';
import { PdfLibAssembler } from '../src/pdflib/pdflib-assembler';
import { createHostedEngine } from '../src/pdfium/host';
import { PdfiumAdapter } from '../src/pdfium/pdfium-adapter';
import {
  type Annotation,
  EngineError,
  type InkAnnotation,
  type MarkupAnnotation,
  type NewAnnotation,
  type NoteAnnotation,
  type ShapeAnnotation,
} from '../src/types';
import { oneOfEach, pngBlob, quad } from './annotation-helpers';
import { makePdf, sid, wasmUrl } from './helpers';

let adapter: PdfiumAdapter;
let counter = 0;
const ZERO_RECT = { x: 0, y: 0, width: 0, height: 0 };

async function fixture(url: string): Promise<ArrayBuffer> {
  return (await fetch(url)).arrayBuffer();
}

function expectRect(actual: Rect | undefined, expected: Rect, tolerance = 0.01): void {
  expect(actual).toBeDefined();
  const a = actual as Rect;
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    expect(
      Math.abs(a[key] - expected[key]),
      `${key}: ${a[key]} vs ${expected[key]}`,
    ).toBeLessThanOrEqual(tolerance);
  }
}

function expectPoints(
  actual: readonly { x: number; y: number }[] | undefined,
  expected: readonly { x: number; y: number }[],
): void {
  expect(actual).toHaveLength(expected.length);
  expected.forEach((p, i) => {
    expect(Math.abs((actual?.[i]?.x ?? Number.NaN) - p.x)).toBeLessThanOrEqual(0.01);
    expect(Math.abs((actual?.[i]?.y ?? Number.NaN) - p.y)).toBeLessThanOrEqual(0.01);
  });
}

/** The geometry a kind keeps exactly, for create/list/re-open comparisons. */
function expectSameGeometry(actual: Annotation | undefined, expected: NewAnnotation): void {
  expect(actual?.kind).toBe(expected.kind);
  const a = actual as Annotation;
  switch (expected.kind) {
    case 'highlight':
    case 'underline':
    case 'strikeout':
    case 'squiggly':
      expected.quads.forEach((q, i) => expectRect((a as MarkupAnnotation).quads[i], q));
      break;
    case 'ink':
      expected.paths.forEach((path, i) => expectPoints((a as InkAnnotation).paths[i], path));
      expect((a as InkAnnotation).strokeWidth).toBeCloseTo(expected.strokeWidth, 2);
      break;
    case 'line':
    case 'polygon':
    case 'polyline':
      expectPoints((a as ShapeAnnotation).vertices, expected.vertices ?? []);
      expect((a as ShapeAnnotation).strokeWidth).toBeCloseTo(expected.strokeWidth, 2);
      break;
    default:
      expectRect(a.rect, expected.rect);
  }
}

/** An adapter with raw access, as the worker builds it (stamps are then updated in place). */
let rawAdapter: PdfiumAdapter;

beforeAll(async () => {
  adapter = new PdfiumAdapter({ wasmUrl, inspector: new PdfLibAssembler() });
  const host = await createHostedEngine({ wasm: wasmUrl });
  rawAdapter = new PdfiumAdapter({
    wasmUrl,
    inspector: new PdfLibAssembler(),
    engineFactory: () => host.engine,
    rawTask: (sourceId, fn, options) => host.withRawTask(sourceId, fn, options),
  });
});

afterAll(async () => {
  await adapter.destroy();
  await rawAdapter.destroy();
});

async function openBlank(pages = 1, engine = adapter): Promise<ReturnType<typeof sid>> {
  const id = sid(`doc-${++counter}`);
  await engine.open(
    id,
    await makePdf(Array.from({ length: pages }, () => ({ size: [612, 792], text: 'Annotations' }))),
  );
  return id;
}

/** Reddish pixels (red over green and blue by 60; `pngBlob` is half-transparent red) of an unrotated page render inside a user-space rect. */
async function redPixels(
  engine: PdfiumAdapter,
  id: ReturnType<typeof sid>,
  rect: Rect,
): Promise<number> {
  const r = await engine.renderPage(id, 0, { scale: 1 });
  const canvas = new OffscreenCanvas(r.width, r.height);
  const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
  ctx.drawImage(r.bitmap, 0, 0);
  const data = ctx.getImageData(
    Math.round(rect.x),
    Math.round(r.height - rect.y - rect.height),
    Math.round(rect.width),
    Math.round(rect.height),
  ).data;
  let red = 0;
  for (let i = 0; i < data.length; i += 4) {
    const [r0, g0, b0] = [data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0];
    if (r0 - g0 > 60 && r0 - b0 > 60) red += 1;
  }
  return red;
}

describe('every kind', () => {
  test('create → list preserves geometry, save → re-open → list keeps it', async () => {
    const id = await openBlank();
    const specs = oneOfEach(0);
    const created: Annotation[] = [];
    for (const spec of specs) created.push(await adapter.createAnnotation(id, spec));

    const listed = await adapter.listAnnotations(id, 0);
    expect(listed.map((a) => a.kind)).toEqual(specs.map((s) => s.kind));
    specs.forEach((spec, i) => {
      const found = listed.find((a) => a.id === created[i]?.id);
      expectSameGeometry(found, spec);
    });
    const note = listed.find((a) => a.kind === 'text') as NoteAnnotation;
    expect(note).toMatchObject({ icon: 'Comment', open: true, contents: 'A note with a popup' });
    expect(listed.find((a) => a.kind === 'free-text')).toMatchObject({
      text: 'Typed text, café',
      fontSize: 14,
      textColor: '#C62828',
    });
    expect(listed.find((a) => a.kind === 'line')).toMatchObject({
      lineEndings: { end: 'open-arrow' },
    });
    expect(listed.find((a) => a.kind === 'polygon')).toMatchObject({ interiorColor: '#E1BEE7' });
    const stamps = listed.filter((a) => a.kind === 'stamp');
    expect(stamps.map((s) => (s.kind === 'stamp' ? s.name : undefined))).toEqual([
      'Approved',
      undefined,
    ]);
    expect(stamps[1]?.opacity).toBe(0.6);
    expect(listed.find((a) => a.kind === 'link')).toMatchObject({ uri: 'https://example.org/' });
    for (const a of listed) {
      expect(a.modified, a.kind).toBeDefined();
      expect(a.flags?.print, a.kind).toBe(true);
    }

    const saved = await adapter.save(id);
    const report = await checkAnnotationConformance(saved.slice(0));
    expect(report.problems).toEqual([]);
    expect(report.counts).toEqual([specs.length]);

    const reopened = sid(`reopened-${counter}`);
    await adapter.open(reopened, saved);
    const again = await adapter.listAnnotations(reopened, 0);
    expect(again.map((a) => a.id)).toEqual(listed.map((a) => a.id));
    specs.forEach((spec, i) => expectSameGeometry(again[i], spec));
    expect(again.find((a) => a.kind === 'text')).toMatchObject({ open: true });
    await adapter.close(reopened);
    await adapter.close(id);
  });

  test('update color, opacity, contents and move the rect; delete', async () => {
    const id = await openBlank();
    for (const spec of oneOfEach(0).filter((s) => s.kind !== 'link')) {
      const created = await adapter.createAnnotation(id, spec);
      const moved = { ...created.rect, x: created.rect.x + 10, y: created.rect.y - 20 };
      const updated = await adapter.updateAnnotation(id, {
        ...created,
        rect: moved,
        color: '#123456',
        opacity: 0.5,
        contents: 'changed',
        // A text box's /Contents is its text.
        ...(created.kind === 'free-text' ? { text: 'changed' } : {}),
      });
      expect(updated.id, spec.kind).toBe(created.id);
      expect(updated.contents, spec.kind).toBe('changed');
      expect(updated.opacity, spec.kind).toBe(0.5);
      if (spec.kind !== 'stamp' && spec.kind !== 'free-text') {
        expect(updated.color, spec.kind).toBe('#123456');
      }
      // Moving the box moves the geometry with it.
      if (updated.kind === 'ink') {
        const first = (spec as InkAnnotation).paths[0]?.[0] as { x: number; y: number };
        expectPoints(updated.paths[0]?.slice(0, 1), [{ x: first.x + 10, y: first.y - 20 }]);
      } else if ('quads' in updated) {
        const q = (spec as MarkupAnnotation).quads[0] as Rect;
        expectRect(updated.quads[0], { ...q, x: q.x + 10, y: q.y - 20 });
      } else if (
        updated.kind === 'line' ||
        updated.kind === 'polygon' ||
        updated.kind === 'polyline'
      ) {
        const v = (spec as ShapeAnnotation).vertices?.[0] as { x: number; y: number };
        expectPoints(updated.vertices?.slice(0, 1), [{ x: v.x + 10, y: v.y - 20 }]);
      } else {
        expectRect(updated.rect, moved);
      }
      await adapter.deleteAnnotation(id, 0, created.id);
      expect(
        (await adapter.listAnnotations(id, 0)).find((a) => a.id === created.id),
      ).toBeUndefined();
    }
    const saved = await adapter.save(id);
    const report = await checkAnnotationConformance(saved);
    expect(report.counts).toEqual([0]);
    expect(report.problems).toEqual([]);
    await adapter.close(id);
  });

  test('fewer quads and a new stamp image recreate the annotation with the same id', async () => {
    const id = await openBlank();
    const hl = await adapter.createAnnotation(id, oneOfEach(0)[0] as NewAnnotation);
    const fewer = await adapter.updateAnnotation(id, {
      ...(hl as MarkupAnnotation),
      quads: [quad],
    });
    expect(fewer.id).toBe(hl.id);
    expect((fewer as MarkupAnnotation).quads).toHaveLength(1);
    const stamp = await adapter.createAnnotation(id, {
      kind: 'stamp',
      pageIndex: 0,
      rect: { x: 80, y: 250, width: 150, height: 50 },
      name: 'Draft',
    });
    const renamed = await adapter.updateAnnotation(id, { ...stamp, kind: 'stamp', name: 'Final' });
    expect(renamed).toMatchObject({ id: stamp.id, name: 'Final' });
    expect(await adapter.listAnnotations(id, 0)).toHaveLength(2);
    await adapter.close(id);
  });
});

describe('ids (/NM)', () => {
  test('a requested id becomes the /NM and survives save; duplicates are refused', async () => {
    const id = await openBlank();
    const created = await adapter.createAnnotation(id, {
      id: 'restore-me-1',
      kind: 'square',
      pageIndex: 0,
      rect: { x: 100, y: 100, width: 50, height: 50 },
      strokeWidth: 1,
    });
    expect(created.id).toBe('restore-me-1');
    await expect(
      adapter.createAnnotation(id, {
        id: 'restore-me-1',
        kind: 'square',
        pageIndex: 0,
        rect: { x: 10, y: 10, width: 5, height: 5 },
        strokeWidth: 1,
      }),
    ).rejects.toBeInstanceOf(EngineError);
    const doc = await PDFDocument.load(await adapter.save(id));
    const annot = doc.context.lookup(doc.getPage(0).node.Annots()?.get(0)) as PDFDict;
    expect((annot.get(PDFName.of('NM')) as PDFString).decodeText()).toBe('restore-me-1');
    await adapter.close(id);
  });
});

describe('rotated pages and crop boxes', () => {
  test('rects read back in user space on /Rotate 0, 90, 180 and 270', async () => {
    const id = sid('rotated');
    const opened = await adapter.open(id, await fixture(rotatedUrl));
    expect(opened.pages.map((p) => p.rotation)).toEqual([0, 90, 180, 270]);
    for (let pageIndex = 0; pageIndex < 4; pageIndex++) {
      const rect = { x: 100, y: 200, width: 50, height: 30 };
      const square = await adapter.createAnnotation(id, {
        kind: 'square',
        pageIndex,
        rect,
        strokeWidth: 1,
      });
      expectRect(square.rect, rect);
      const listed = await adapter.listAnnotations(id, pageIndex);
      expectRect(listed.find((a) => a.id === square.id)?.rect, rect);
      const hl = await adapter.createAnnotation(id, {
        kind: 'highlight',
        pageIndex,
        rect: quad,
        quads: [quad],
      });
      expectRect((hl as MarkupAnnotation).quads[0], quad);
      expectRect(hl.rect, quad);
      const note = await adapter.createAnnotation(id, {
        kind: 'text',
        pageIndex,
        rect: { x: 300, y: 300, width: 20, height: 20 },
        contents: 'rotated',
      });
      expectRect(note.rect, { x: 300, y: 300, width: 20, height: 20 });
    }
    const report = await checkAnnotationConformance(await adapter.save(id));
    expect(report.problems).toEqual([]);
    await adapter.close(id);
  });

  test('rects are absolute user space on a page whose CropBox is offset', async () => {
    const id = sid('cropped');
    await adapter.open(
      id,
      await makePdf([{ size: [612, 792] }], (doc) => doc.getPage(0).setCropBox(72, 144, 468, 576)),
    );
    const rect = { x: 100, y: 200, width: 50, height: 30 };
    const created = await adapter.createAnnotation(id, {
      kind: 'circle',
      pageIndex: 0,
      rect,
      strokeWidth: 1,
    });
    expectRect(created.rect, rect);
    const doc = await PDFDocument.load(await adapter.save(id));
    const annot = doc.context.lookup(doc.getPage(0).node.Annots()?.get(0)) as PDFDict;
    const written = (annot.get(PDFName.of('Rect')) as PDFArray)
      .asArray()
      .map((n) => (n as PDFNumber).asNumber());
    expect(written).toEqual([100, 200, 150, 230]);
    await adapter.close(id);
  });
});

describe('notes, popups and comments', () => {
  test('save writes a popup with /Parent, /Open and removes it with the note', async () => {
    const id = await openBlank();
    const note = await adapter.createAnnotation(id, {
      kind: 'text',
      pageIndex: 0,
      rect: { x: 100, y: 600, width: 20, height: 20 },
      contents: 'Hello',
      open: false,
    });
    let doc = await PDFDocument.load(await adapter.save(id));
    let annots = doc.getPage(0).node.Annots() as PDFArray;
    expect(annots.size()).toBe(2);
    const noteDict = doc.context.lookup(annots.get(0)) as PDFDict;
    const popup = doc.context.lookup(noteDict.get(PDFName.of('Popup'))) as PDFDict;
    expect(popup.get(PDFName.of('Parent'))).toBe(annots.get(0));
    expect(String(popup.get(PDFName.of('Open')))).toBe('false');

    await adapter.updateAnnotation(id, { ...(note as NoteAnnotation), open: true });
    doc = await PDFDocument.load(await adapter.save(id));
    annots = doc.getPage(0).node.Annots() as PDFArray;
    const popupAgain = doc.context.lookup(
      (doc.context.lookup(annots.get(0)) as PDFDict).get(PDFName.of('Popup')),
    ) as PDFDict;
    expect(String(popupAgain.get(PDFName.of('Open')))).toBe('true');

    const withoutComments = await PDFDocument.load(
      await adapter.save(id, { includeComments: false }),
    );
    expect(withoutComments.getPage(0).node.Annots()?.size()).toBe(1);

    await adapter.deleteAnnotation(id, 0, note.id);
    const afterDelete = await PDFDocument.load(await adapter.save(id));
    expect(afterDelete.getPage(0).node.Annots()?.size() ?? 0).toBe(0);
    await adapter.close(id);
  });

  test('the fixture keeps its notes and popups conformant through an edit', async () => {
    const id = sid('fixture');
    await adapter.open(id, await fixture(annotationsUrl));
    const page2 = await adapter.listAnnotations(id, 1);
    expect(page2.map((a) => a.kind)).toEqual(['text', 'ink']);
    expect(page2[0]).toMatchObject({ kind: 'text', open: false });
    const original = await checkAnnotationConformance(await fixture(annotationsUrl));
    expect(original.problems).toEqual([]);
    const ink = page2[1] as InkAnnotation;
    await adapter.updateAnnotation(id, { ...ink, color: '#FF0000' });
    const saved = await adapter.save(id);
    const report = await checkAnnotationConformance(saved);
    expect(report.problems).toEqual([]);
    expect(report.counts).toEqual([2, 2]);
    await adapter.close(id);
  });
});

describe('stamps', () => {
  test('unknown named stamps and unsupported images fail clearly', async () => {
    const id = await openBlank();
    await expect(
      adapter.createAnnotation(id, { kind: 'stamp', pageIndex: 0, rect: quad, name: 'NotAStamp' }),
    ).rejects.toMatchObject({ code: 'unsupported' });
    await expect(
      adapter.createAnnotation(id, {
        kind: 'stamp',
        pageIndex: 0,
        rect: quad,
        imageBlob: new Blob(['GIF89a'], { type: 'image/gif' }),
      }),
    ).rejects.toMatchObject({ code: 'unsupported' });
    await adapter.close(id);
  });

  test.each([
    ['with raw access', () => rawAdapter],
    ['without raw access', () => adapter],
  ])(
    'a moved image stamp still draws, after save → re-open and after the undo update (%s)',
    async (_, engineOf) => {
      const engine = engineOf();
      const id = await openBlank(1, engine);
      const at = { x: 100, y: 100, width: 60, height: 60 };
      const to = { x: 300, y: 400, width: 60, height: 60 };
      const stamp = await engine.createAnnotation(id, {
        kind: 'stamp',
        pageIndex: 0,
        rect: at,
        imageBlob: pngBlob(),
      });
      expect(await redPixels(engine, id, at)).toBeGreaterThan(1000);
      // A drag commits the stamp with only its rect changed (no imageBlob), like the UI does.
      await engine.updateAnnotation(id, { ...stamp, rect: to });
      expect(await redPixels(engine, id, to)).toBeGreaterThan(1000);
      expect(await redPixels(engine, id, at)).toBe(0);

      const saved = await engine.save(id);
      const reopened = sid(`doc-${++counter}`);
      await engine.open(reopened, saved);
      expect(await redPixels(engine, reopened, to)).toBeGreaterThan(1000);
      await engine.close(reopened);

      // Undo replays the previous state as another rect-only update.
      await engine.updateAnnotation(id, { ...stamp, rect: at });
      expect(await redPixels(engine, id, at)).toBeGreaterThan(1000);
      // A style change (the selection bar's opacity) is an update too.
      await engine.updateAnnotation(id, { ...stamp, rect: at, opacity: 0.8 });
      expect(await redPixels(engine, id, at)).toBeGreaterThan(1000);
      await engine.close(id);
    },
  );

  test('a stamp moved back and forth 25 times, with Undo and Redo, still draws and stays small', async () => {
    const id = await openBlank(1, rawAdapter);
    const at = { x: 100, y: 100, width: 60, height: 60 };
    const to = { x: 300, y: 400, width: 60, height: 60 };
    const stamp = await rawAdapter.createAnnotation(id, {
      kind: 'stamp',
      pageIndex: 0,
      rect: at,
      imageBlob: pngBlob(),
    });
    await rawAdapter.updateAnnotation(id, { ...stamp, rect: to });
    const firstMove = (await rawAdapter.save(id)).byteLength;
    for (let i = 1; i < 25; i++) {
      await rawAdapter.updateAnnotation(id, { ...stamp, rect: i % 2 === 0 ? to : at });
    }
    // Undo and Redo replay the neighbouring states as further updates (edits/apply.ts).
    for (let i = 0; i < 4; i++) {
      await rawAdapter.updateAnnotation(id, { ...stamp, rect: i % 2 === 0 ? to : at });
    }
    expect(await redPixels(rawAdapter, id, at)).toBeGreaterThan(1000);
    expect(await redPixels(rawAdapter, id, to)).toBe(0);
    // A resize scales the same appearance into the new rect.
    const big = { x: 300, y: 400, width: 120, height: 120 };
    await rawAdapter.updateAnnotation(id, { ...stamp, rect: big });
    expect(await redPixels(rawAdapter, id, big)).toBeGreaterThan(4 * 1000);
    await rawAdapter.updateAnnotation(id, { ...stamp, rect: at });
    const saved = await rawAdapter.save(id);
    expect(saved.byteLength).toBeLessThan(firstMove * 1.2);
    const reopened = sid(`doc-${++counter}`);
    await rawAdapter.open(reopened, saved);
    expect(await redPixels(rawAdapter, reopened, at)).toBeGreaterThan(1000);
    await rawAdapter.close(reopened);
    await rawAdapter.close(id);
  });

  test('a moved or restyled stamp keeps its place in the z-order and its comment', async () => {
    const id = await openBlank(1, rawAdapter);
    const stamp = await rawAdapter.createAnnotation(id, {
      kind: 'stamp',
      pageIndex: 0,
      rect: { x: 100, y: 100, width: 60, height: 60 },
      imageBlob: pngBlob(),
    });
    await rawAdapter.createAnnotation(id, {
      kind: 'ink',
      pageIndex: 0,
      rect: ZERO_RECT,
      paths: [
        [
          { x: 90, y: 90 },
          { x: 170, y: 170 },
        ],
      ],
      strokeWidth: 4,
      color: '#000000',
    });
    const kinds = async (doc: ReturnType<typeof sid>) =>
      (await rawAdapter.listAnnotations(doc, 0)).map((a) => a.kind);
    expect(await kinds(id)).toEqual(['stamp', 'ink']);
    const restyled = await rawAdapter.updateAnnotation(id, {
      ...stamp,
      opacity: 0.6,
      contents: 'Signed here',
    });
    expect(restyled).toMatchObject({ id: stamp.id, opacity: 0.6, contents: 'Signed here' });
    expect(await kinds(id)).toEqual(['stamp', 'ink']);
    await rawAdapter.updateAnnotation(id, {
      ...restyled,
      rect: { x: 200, y: 200, width: 60, height: 60 },
    });
    expect(await kinds(id)).toEqual(['stamp', 'ink']);
    const reopened = sid(`doc-${++counter}`);
    const saved = await rawAdapter.save(id);
    // Listing reads a stamp's opacity from what the adapter keeps, so check the saved /CA.
    const annots = (await PDFDocument.load(saved))
      .getPage(0)
      .node.lookup(PDFName.of('Annots')) as PDFArray;
    expect((annots.lookup(0) as PDFDict).lookup(PDFName.of('CA'))?.toString()).toBe('0.6');
    await rawAdapter.open(reopened, saved);
    const listed = await rawAdapter.listAnnotations(reopened, 0);
    expect(listed.map((a) => a.kind)).toEqual(['stamp', 'ink']);
    expect(listed[0]).toMatchObject({ contents: 'Signed here' });
    expectRect(listed[0]?.rect, { x: 200, y: 200, width: 60, height: 60 });
    await rawAdapter.close(reopened);
    await rawAdapter.close(id);
  });

  test('moved ink and text boxes still draw (the move path a stamp shares)', async () => {
    const id = await openBlank();
    const ink = await adapter.createAnnotation(id, {
      kind: 'ink',
      pageIndex: 0,
      rect: { x: 0, y: 0, width: 0, height: 0 },
      paths: [
        [
          { x: 100, y: 100 },
          { x: 150, y: 150 },
        ],
      ],
      strokeWidth: 6,
      color: '#FF0000',
    });
    const box = await adapter.createAnnotation(id, {
      kind: 'free-text',
      pageIndex: 0,
      rect: { x: 100, y: 300, width: 160, height: 40 },
      text: 'WWWW',
      fontSize: 28,
      textColor: '#FF0000',
    });
    const dx = 250;
    const dy = 200;
    if (ink.kind !== 'ink' || box.kind !== 'free-text') throw new Error('unexpected kinds');
    // What a drag commits (geometry.ts translateAnnotation): the rect and the paths moved.
    await adapter.updateAnnotation(id, {
      ...ink,
      rect: { ...ink.rect, x: ink.rect.x + dx, y: ink.rect.y + dy },
      paths: ink.paths.map((path) => path.map((p) => ({ x: p.x + dx, y: p.y + dy }))),
    });
    await adapter.updateAnnotation(id, {
      ...box,
      rect: { ...box.rect, x: box.rect.x + dx, y: box.rect.y + dy },
    });
    const inkTo = { x: 100 + dx, y: 100 + dy, width: 50, height: 50 };
    const boxTo = { ...box.rect, x: box.rect.x + dx, y: box.rect.y + dy };
    expect(await redPixels(adapter, id, inkTo)).toBeGreaterThan(100);
    expect(await redPixels(adapter, id, boxTo)).toBeGreaterThan(100);
    const reopened = sid(`doc-${++counter}`);
    await adapter.open(reopened, await adapter.save(id));
    expect(await redPixels(adapter, reopened, inkTo)).toBeGreaterThan(100);
    expect(await redPixels(adapter, reopened, boxTo)).toBeGreaterThan(100);
    await adapter.close(reopened);
    await adapter.close(id);
  });

  test('the appearance of a deleted stamp recreates it', async () => {
    const id = await openBlank();
    const stamp = await adapter.createAnnotation(id, {
      kind: 'stamp',
      pageIndex: 0,
      rect: { x: 100, y: 100, width: 60, height: 60 },
      imageBlob: pngBlob(),
    });
    const appearance = await adapter.getAnnotationAppearance(id, 0, stamp.id);
    expect(appearance.type).toBe('application/pdf');
    await adapter.deleteAnnotation(id, 0, stamp.id);
    const again = await adapter.createAnnotation(id, {
      id: stamp.id,
      kind: 'stamp',
      pageIndex: 0,
      rect: stamp.rect,
      imageBlob: appearance,
    });
    expect(again.id).toBe(stamp.id);
    expectRect(again.rect, stamp.rect);
    const report = await checkAnnotationConformance(await adapter.save(id));
    expect(report.problems).toEqual([]);
    await adapter.close(id);
  });
});

describe('free text', () => {
  test('characters outside WinAnsi are refused instead of producing an empty appearance', async () => {
    const id = await openBlank();
    await expect(
      adapter.createAnnotation(id, {
        kind: 'free-text',
        pageIndex: 0,
        rect: { x: 100, y: 100, width: 200, height: 30 },
        text: 'Ağaç',
        fontSize: 12,
      }),
    ).rejects.toMatchObject({ code: 'unsupported' });
    await adapter.close(id);
  });
});

describe('flatten and verification', () => {
  test('flattening removes every annotation but links, and verify counts them', async () => {
    const id = await openBlank();
    for (const spec of oneOfEach(0)) await adapter.createAnnotation(id, spec);
    const flat = await adapter.save(id, { flattenAnnotations: true });
    const size = [{ width: 612, height: 792 }];
    expect(
      await adapter.verify(flat.slice(0), {
        pageCount: 1,
        pageSizes: size,
        annotationCounts: { 0: 0 },
      }),
    ).toEqual({ ok: true, problems: [] });
    const flatDoc = await PDFDocument.load(flat);
    const kinds = (flatDoc.getPage(0).node.Annots()?.asArray() ?? []).map((ref) =>
      String((flatDoc.context.lookup(ref) as PDFDict).get(PDFName.of('Subtype'))),
    );
    expect(kinds).toEqual(['/Link']);

    const saved = await adapter.save(id);
    const ok = await adapter.verify(saved.slice(0), {
      pageCount: 1,
      pageSizes: size,
      annotationCounts: { 0: oneOfEach(0).length - 1 },
      checkAnnotations: true,
    });
    expect(ok).toEqual({ ok: true, problems: [] });
    const wrong = await adapter.verify(saved.slice(0), {
      pageCount: 1,
      pageSizes: size,
      annotationCounts: { 0: 3 },
    });
    expect(wrong.problems.join(' ')).toContain('expected 3');
    await adapter.close(id);
  });
});

describe('redaction marks (/Redact)', () => {
  function redactDict(pdf: PDFDocument): PDFDict {
    const annots = pdf.getPage(0).node.Annots()?.asArray() ?? [];
    const dict = annots
      .map((ref) => pdf.context.lookup(ref) as PDFDict)
      .find((d) => String(d.get(PDFName.of('Subtype'))) === '/Redact');
    if (!dict) throw new Error('no /Redact annotation');
    return dict;
  }

  function colorOf(dict: PDFDict, key: string): number[] | undefined {
    const value = dict.lookup(PDFName.of(key)) as PDFArray | undefined;
    return value?.asArray().map((n) => Math.round((n as PDFNumber).asNumber() * 255));
  }

  test('/IC defaults to black; outline, fill, overlay text and colour round-trip', async () => {
    const id = await openBlank();
    const area: Rect = { x: 100, y: 600, width: 120, height: 20 };
    const plain = await adapter.createAnnotation(id, {
      kind: 'redact',
      pageIndex: 0,
      rect: area,
      quads: [area],
    });
    expect(plain).toMatchObject({ kind: 'redact', interiorColor: '#000000' });
    expect((plain as MarkupAnnotation).overlayText).toBeUndefined();

    const second: Rect = { x: 100, y: 500, width: 80, height: 14 };
    const styled = await adapter.createAnnotation(id, {
      kind: 'redact',
      pageIndex: 0,
      rect: second,
      quads: [second],
      color: '#E53935',
      interiorColor: '#1E88E5',
      overlayText: 'REDACTED',
      overlayColor: '#FFFFFF',
    });
    expect(styled).toMatchObject({
      color: '#E53935',
      interiorColor: '#1E88E5',
      overlayText: 'REDACTED',
      overlayColor: '#FFFFFF',
    });

    // An update carries the full state: dropping the overlay text clears it.
    const {
      overlayText: _text,
      overlayColor: _color,
      ...withoutOverlay
    } = styled as MarkupAnnotation;
    const cleared = await adapter.updateAnnotation(id, withoutOverlay);
    expect((cleared as MarkupAnnotation).overlayText).toBeUndefined();
    expect((cleared as MarkupAnnotation).overlayColor).toBeUndefined();
    const restored = await adapter.updateAnnotation(id, styled);
    expect(restored).toMatchObject({ overlayText: 'REDACTED', interiorColor: '#1E88E5' });

    const saved = await adapter.save(id);
    const report = await checkAnnotationConformance(saved.slice(0));
    expect(report.problems).toEqual([]);
    const pdf = await PDFDocument.load(saved.slice(0), { updateMetadata: false });
    const first = redactDict(pdf);
    expect(colorOf(first, 'IC')).toEqual([0, 0, 0]);

    const reopened = sid(`reopened-redact-${counter}`);
    await adapter.open(reopened, saved);
    const again = await adapter.listAnnotations(reopened, 0);
    const marks = again.filter((a) => a.kind === 'redact') as MarkupAnnotation[];
    expect(marks).toHaveLength(2);
    expectRect(marks[0]?.quads[0], area);
    expect(marks[0]).toMatchObject({ interiorColor: '#000000', color: '#E53935' });
    expect(marks[1]).toMatchObject({
      interiorColor: '#1E88E5',
      overlayText: 'REDACTED',
      overlayColor: '#FFFFFF',
    });
    await adapter.close(reopened);
    await adapter.close(id);
  });
});

describe('links', () => {
  test('a saved link has /C equal to its underline appearance colour', async () => {
    const id = await openBlank();
    const rect: Rect = { x: 72, y: 600, width: 150, height: 18 };
    await adapter.createAnnotation(id, {
      kind: 'link',
      pageIndex: 0,
      rect,
      uri: 'https://example.org/',
    });
    await adapter.createAnnotation(id, {
      kind: 'link',
      pageIndex: 0,
      rect: { ...rect, y: 560 },
      uri: 'https://example.org/red',
      color: '#FF0000',
    });
    const saved = await adapter.save(id);
    await adapter.close(id);
    const pdf = await PDFDocument.load(saved, { updateMetadata: false });
    const links = (pdf.getPage(0).node.Annots()?.asArray() ?? [])
      .map((ref) => pdf.context.lookup(ref) as PDFDict)
      .filter((d) => String(d.get(PDFName.of('Subtype'))) === '/Link');
    expect(links).toHaveLength(2);
    const expected = [
      [0, 0, 1],
      [1, 0, 0],
    ];
    links.forEach((dict, i) => {
      const c = (dict.lookup(PDFName.of('C')) as PDFArray | undefined)
        ?.asArray()
        .map((n) => (n as PDFNumber).asNumber());
      expect(c).toEqual(expected[i]);
      // The generated underline strokes in the same colour.
      const ap = dict.lookup(PDFName.of('AP')) as PDFDict | undefined;
      const normal = ap?.lookup(PDFName.of('N'));
      expect(normal).toBeInstanceOf(PDFRawStream);
      const ops = new TextDecoder('latin1').decode(
        decodePDFRawStream(normal as PDFRawStream).decode(),
      );
      const strokes = [...ops.matchAll(/([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+RG/g)].map((m) =>
        [m[1], m[2], m[3]].map(Number),
      );
      expect(strokes.length).toBeGreaterThan(0);
      for (const rgb of strokes) expect(rgb).toEqual(expected[i]);
    });
  });
});
