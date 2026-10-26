/**
 * Moving and resizing a paragraph (TXT-24): the writer translates the paragraph's text
 * objects (`setMatrix`) instead of deleting and writing them again, re-places only what a new
 * width wraps differently, moves links and markup with their words, refuses what it cannot
 * move, and replays byte-identically. Corpus fixtures: word-tagged, tagged, latex-justified,
 * two-column, text-edit-rotated, rotated-paragraph; synthetic pages for clips, marks, widgets.
 */
import { PDFDocument, PDFName, PDFString } from '@cantoo/pdf-lib';
import type { EngineEdit, SourceId } from '@pdf-editor/document-model';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import taggedUrl from '../../../../test/fixtures/tagged.pdf?url';
import rotatedParagraphUrl from '../../../../test/fixtures/text-edit-corpus/rotated-paragraph.pdf?url';
import latexUrl from '../../../../test/fixtures/text-edit-corpus/latex-justified.pdf?url';
import twoColumnUrl from '../../../../test/fixtures/text-edit-corpus/two-column.pdf?url';
import wordUrl from '../../../../test/fixtures/text-edit-corpus/word-tagged.pdf?url';
import rotatedPagesUrl from '../../../../test/fixtures/text-edit-rotated.pdf?url';
import { toBuffer } from '../../test/helpers';
import {
  applyEngineEditWithResult,
  type EditTarget,
  paragraphEditPayloadOf,
  readParagraphEditPayload,
  replayEngineEdits,
} from '../edits';
import type { ParagraphBlock, ParagraphEdit } from '../types';
import { textEditFailureReason } from './errors';
import { finalizeTextEdits } from './finalize';
import { frameRefusalOf, paragraphRefusalReason, type ParagraphModel } from './paragraph-input';
import { createHarness, fixture, type Harness, rawPdf, rejection, sameBytes } from './test-helpers';

let h: Harness;
let target: EditTarget;

beforeAll(async () => {
  h = await createHarness();
  target = {
    applyParagraphEdit: h.editor.applyParagraphEdit.bind(h.editor),
  } as unknown as EditTarget;
});

afterAll(async () => {
  await h.adapter.destroy();
});

async function blocksOf(source: SourceId, pageIndex = 0): Promise<readonly ParagraphBlock[]> {
  return h.editor.analyzeParagraphs(source, pageIndex);
}

/** No text change, only a frame. */
function moveOf(block: ParagraphBlock, dx: number, dy: number): ParagraphEdit {
  return { ref: block.ref, text: block.text, caretSpan: { start: 0, end: 0 }, frame: { dx, dy } };
}

function resizeOf(
  block: ParagraphBlock,
  left: number,
  right: number,
  dx = 0,
  dy = 0,
): ParagraphEdit {
  return {
    ref: block.ref,
    text: block.text,
    caretSpan: { start: 0, end: 0 },
    frame: { dx, dy, measure: { left, right } },
  };
}

/** Every line's left edge and baseline moved by (dx, dy), to 0.01 pt. */
function expectMoved(before: ParagraphBlock, after: ParagraphBlock, dx: number, dy: number): void {
  expect(after.text).toBe(before.text);
  expect(after.lines).toHaveLength(before.lines.length);
  before.lines.forEach((line, i) => {
    const now = after.lines[i];
    expect(now?.x0).toBeCloseTo(line.x0 + dx, 2);
    expect(now?.x1).toBeCloseTo(line.x1 + dx, 2);
    expect(now?.baseline).toBeCloseTo(line.baseline + dy, 2);
  });
}

describe('a pure move', () => {
  test('word-tagged: every line lands exactly dx, dy away, nothing is rewritten', async () => {
    const id = await h.open(await fixture(wordUrl));
    const blocks = await blocksOf(id);
    const block = blocks[1];
    if (!block) throw new Error('no paragraph');
    const analysis = await h.editor.analyzeParagraphLayout(block.ref);
    expect(analysis.frameRefusal).toBeUndefined();
    expect(analysis.roomLeft).toBeGreaterThanOrEqual(0);
    expect(analysis.roomRight).toBeGreaterThanOrEqual(0);

    const edit = moveOf(block, 24, -18);
    const dry = await h.editor.applyParagraphEdit(id, 0, edit, { commit: false });
    expect(dry.committed).toBe(false);
    expect(dry.translated).toEqual({ dx: 24, dy: -18 });
    expect((await blocksOf(id))[1]?.lines[0]?.x0).toBeCloseTo(block.lines[0]!.x0, 6);

    const done = await h.editor.applyParagraphEdit(id, 0, edit, { commit: true });
    expect(done.committed).toBe(true);
    expect(done.layout.lines.every((l) => l.status === 'kept')).toBe(true);
    expect(done.verification.objectsWritten).toBe(0);
    expect(done.verification.maxDrift).toBeLessThanOrEqual(0.01);
    expect(done.verification.changedPixelsOutside).toBe(0);
    expect(done.verification.objectsMoved).toBeGreaterThan(0);
    expect(done.tier).toBe(2);

    const after = await blocksOf(id);
    expectMoved(block, after[1]!, 24, -18);
    // The other paragraphs did not move.
    blocks.forEach((b, i) => {
      if (i === 1) return;
      expect(after[i]?.box).toEqual(b.box);
      expect(after[i]?.text).toBe(b.text);
    });
    await h.adapter.close(id);
  });

  test('a zero move writes nothing', async () => {
    const id = await h.open(await fixture(wordUrl));
    const block = (await blocksOf(id))[1]!;
    const before = await h.adapter.save(id);
    const result = await h.editor.applyParagraphEdit(id, 0, moveOf(block, 0, 0), { commit: true });
    expect(result.committed).toBe(false);
    expect(result.translated).toBeUndefined();
    expect(sameBytes(await h.adapter.save(id), before)).toBe(true);
    await h.adapter.close(id);
  });

  test('moving and typing: the edited line is written in place, the rest follows', async () => {
    const id = await h.open(await fixture(wordUrl));
    const block = (await blocksOf(id))[1]!;
    const start = block.text.indexOf('quay');
    const edit: ParagraphEdit = {
      ref: block.ref,
      text: block.text.slice(0, start) + 'quai' + block.text.slice(start + 4),
      caretSpan: { start, end: start + 4 },
      frame: { dx: -10, dy: 30 },
    };
    const result = await h.editor.applyParagraphEdit(id, 0, edit, { commit: true });
    expect(result.committed).toBe(true);
    expect(result.verification.maxDrift).toBeLessThanOrEqual(0.01);
    expect(result.verification.changedPixelsOutside).toBe(0);
    const after = (await blocksOf(id)).find((b) => b.text === edit.text)!;
    expect(after.lines).toHaveLength(block.lines.length);
    block.lines.forEach((line, i) => {
      expect(after.lines[i]?.x0).toBeCloseTo(line.x0 - 10, 2);
      expect(after.lines[i]?.baseline).toBeCloseTo(line.baseline + 30, 2);
    });
    await h.adapter.close(id);
  });

  test('marked content survives: word-tagged and tagged keep their MCIDs and elements', async () => {
    for (const [url, index, tag] of [
      [wordUrl, 1, undefined],
      [taggedUrl, 0, 'P'],
    ] as const) {
      const id = await h.open(await fixture(url));
      const block = (await blocksOf(id))[index]!;
      const mcids = async (b: ParagraphBlock) =>
        (await h.editor.locateRuns(id, 0))
          .filter((r) => b.ref.runs.some((x) => x.charStart === r.charStart))
          .map((r) => r.mcid);
      const before = await mcids(block);
      await h.editor.applyParagraphEdit(id, 0, moveOf(block, 12, -9), { commit: true });
      const finalized = await finalizeTextEdits(await h.adapter.save(id));
      expect(finalized.mcidsReassigned).toBe(0);
      const reopened = await h.open(finalized.bytes);
      const after = (await blocksOf(reopened))[index]!;
      expect(after.source).toBe('tags');
      if (tag) expect(after.tag).toBe(tag);
      expectMoved(block, after, 12, -9);
      const runs = (await h.editor.locateRuns(reopened, 0)).filter((r) =>
        after.ref.runs.some((x) => x.charStart === r.charStart),
      );
      expect(runs.map((r) => r.mcid)).toEqual(before);
      await h.adapter.close(reopened);
      await h.adapter.close(id);
    }
  });

  test('pages with /Rotate: dx, dy are unrotated user space and the paragraph lands there', async () => {
    for (const [url, page, index] of [
      [rotatedParagraphUrl, 0, 1],
      [rotatedPagesUrl, 0, 0],
      [rotatedPagesUrl, 1, 0],
    ] as const) {
      const id = await h.open(await fixture(url));
      const block = (await blocksOf(id, page))[index];
      if (!block || block.refusal) throw new Error(`no paragraph ${index} on page ${page}`);
      const result = await h.editor.applyParagraphEdit(id, page, moveOf(block, 17, -11), {
        commit: true,
      });
      expect(result.verification.changedPixelsOutside).toBe(0);
      expect(result.verification.maxDrift).toBeLessThanOrEqual(0.01);
      const after = (await blocksOf(id, page)).find((b) => b.text === block.text)!;
      expect(after.box.x).toBeCloseTo(block.box.x + 17, 1);
      expect(after.box.y).toBeCloseTo(block.box.y - 11, 1);
      await h.adapter.close(id);
    }
  });
});

describe('links, markup and clips', () => {
  async function linkPage(): Promise<ArrayBuffer> {
    const base = await rawPdf({
      size: [400, 300],
      content: [
        'BT /F1 12 Tf 1 0 0 1 40 250 Tm (The harbour master walked along the quay) Tj ET',
        'BT /F1 12 Tf 1 0 0 1 40 235.6 Tm (and counted the boats that came in with) Tj ET',
        'BT /F1 12 Tf 1 0 0 1 40 221.2 Tm (the evening tide.) Tj ET',
      ].join('\n'),
    });
    const doc = await PDFDocument.load(base);
    const link = doc.context.register(
      doc.context.obj({
        Type: 'Annot',
        Subtype: 'Link',
        Rect: [58, 218, 102, 232],
        NM: PDFString.of('link-1'),
        Border: [0, 0, 0],
      }),
    );
    const highlight = doc.context.register(
      doc.context.obj({
        Type: 'Annot',
        Subtype: 'Highlight',
        Rect: [124, 232, 156, 247],
        QuadPoints: [124, 247, 156, 247, 124, 232, 156, 232],
        NM: PDFString.of('highlight-1'),
        C: [1, 1, 0],
      }),
    );
    doc.getPage(0).node.set(PDFName.of('Annots'), doc.context.obj([link, highlight]));
    return toBuffer(await doc.save());
  }

  test('a link and a highlight move by exactly dx, dy with their words', async () => {
    const id = await h.open(await linkPage());
    const [block] = await blocksOf(id);
    if (!block) throw new Error('no paragraph');
    const result = await h.editor.applyParagraphEdit(id, 0, moveOf(block, 20, -35), {
      commit: true,
    });
    expect(result.moved.map((m) => m.id).sort()).toEqual(['highlight-1', 'link-1']);
    for (const m of result.moved) {
      expect(m.to.x).toBeCloseTo(m.from.x + 20, 2);
      expect(m.to.y).toBeCloseTo(m.from.y - 35, 2);
      expect(m.to.width).toBeCloseTo(m.from.width, 2);
    }
    const listed = await h.adapter.listAnnotations(id, 0);
    const rect = listed.find((a) => a.id === 'link-1')?.rect;
    expect(rect?.x).toBeCloseTo(58 + 20, 1);
    expect(rect?.y).toBeCloseTo(218 - 35, 1);
    const marked = listed.find((a) => a.id === 'highlight-1');
    const quad = marked?.kind === 'highlight' ? marked.quads[0] : undefined;
    expect(quad?.x).toBeCloseTo(124 + 20, 1);
    await h.adapter.close(id);
  });

  test('a clip that cuts the text refuses a move (PDFium reports a clip where it cuts the object)', async () => {
    const bytes = await rawPdf({
      content: [
        'q 30 100 150 80 re W n',
        'BT /F1 12 Tf 1 0 0 1 40 150 Tm (The clipped line of text goes) Tj ET',
        'BT /F1 12 Tf 1 0 0 1 40 135.6 Tm (on past the window here.) Tj ET',
        'Q',
      ].join('\n'),
    });
    const id = await h.open(bytes);
    const [block] = await blocksOf(id);
    if (!block) throw new Error('no paragraph');
    const out = await rejection(
      h.editor.applyParagraphEdit(id, 0, moveOf(block, 5, 0), { commit: false }),
    );
    expect(paragraphRefusalReason(out)).toBe('move-clipped');
    expect(textEditFailureReason(out)).toBe('not-editable');
    await h.adapter.close(id);
  });
});

describe('a new width', () => {
  test('latex-justified at half the width: about twice the lines, justified, verified', async () => {
    const id = await h.open(await fixture(latexUrl));
    const block = (await blocksOf(id)).find((b) => b.text.startsWith('The tidal gauge'))!;
    expect(block.align).toBe('justify');
    const width = block.measure.right - block.measure.left;
    const edit = resizeOf(block, block.measure.left, block.measure.left + width / 2);
    const result = await h.editor.applyParagraphEdit(id, 0, edit, { commit: true });
    expect(result.committed).toBe(true);
    expect(result.layout.lines.every((l) => l.status === 'rewritten')).toBe(true);
    expect(result.layout.lines.length).toBeGreaterThanOrEqual(Math.floor(block.lines.length * 1.8));
    expect(result.layout.lines.length).toBeLessThanOrEqual(Math.ceil(block.lines.length * 2.6));
    expect(result.verification.maxDrift).toBeLessThanOrEqual(0.01);
    expect(result.verification.maxBoxError).toBeLessThanOrEqual(0.05);
    expect(result.verification.changedPixelsOutside).toBe(0);
    // The next paragraph is close: the longer text runs over it, which the decision reports.
    expect(result.decision.kind).toBe('overflow');
    const squash = (t: string) => t.replace(/[\s-]+/g, '');
    expect(squash(result.verification.readback)).toBe(squash(block.text));
    for (const line of result.layout.lines) {
      expect(line.x).toBeGreaterThanOrEqual(block.measure.left - 1e-6);
      expect(line.x + line.width).toBeLessThanOrEqual(block.measure.left + width / 2 + 1e-6);
    }
    await h.adapter.close(id);
  });

  test('resizing and moving together: lines laid out in the new measure, shifted', async () => {
    const id = await h.open(await fixture(latexUrl));
    const block = (await blocksOf(id)).find((b) => b.text.startsWith('The tidal gauge'))!;
    const width = block.measure.right - block.measure.left;
    const edit = resizeOf(block, block.measure.left, block.measure.left + width * 0.75, 14, -6);
    const result = await h.editor.applyParagraphEdit(id, 0, edit, { commit: true });
    expect(result.translated).toEqual({ dx: 14, dy: -6 });
    expect(result.verification.maxDrift).toBeLessThanOrEqual(0.01);
    const first = (await blocksOf(id)).find((b) => b.text.startsWith('The tidal gauge'))!;
    expect(first.lines[0]!.baseline).toBeCloseTo(block.lines[0]!.baseline - 6, 1);
    expect(first.lines[0]!.x0).toBeGreaterThanOrEqual(block.measure.left + 14 - 1);
    await h.adapter.close(id);
  });

  test('a width under four times the size is refused as an invalid range', async () => {
    const id = await h.open(await fixture(latexUrl));
    const block = (await blocksOf(id)).find((b) => b.text.startsWith('The tidal gauge'))!;
    const error = await rejection(
      h.editor.applyParagraphEdit(
        id,
        0,
        resizeOf(block, block.measure.left, block.measure.left + block.size * 3),
        { commit: false },
      ),
    );
    expect(textEditFailureReason(error)).toBe('invalid-range');
    await h.adapter.close(id);
  });

  test('two-column: a narrower paragraph grows into the space below and stays in its column', async () => {
    const id = await h.open(await fixture(twoColumnUrl));
    const block = (await blocksOf(id)).find((b) => b.text.startsWith('Sorting is done'))!;
    const width = block.measure.right - block.measure.left;
    const result = await h.editor.applyParagraphEdit(
      id,
      0,
      resizeOf(block, block.measure.left, block.measure.left + width * 0.7),
      { commit: true },
    );
    expect(result.decision.kind).toBe('grow');
    expect(result.verification.changedPixelsOutside).toBe(0);
    expect(result.verification.maxDrift).toBeLessThanOrEqual(0.01);
    const after = (await blocksOf(id)).find((b) => b.text.startsWith('Sorting is done'))!;
    expect(after.text).toBe(block.text);
    expect(after.lines.length).toBeGreaterThan(block.lines.length);
    expect(after.measure.right).toBeLessThanOrEqual(block.measure.left + width * 0.7 + 0.5);
    await h.adapter.close(id);
  });

  test('two columns: the room beside a paragraph stops at the other column', async () => {
    const id = await h.open(await fixture(twoColumnUrl));
    const blocks = await blocksOf(id);
    const leftBlock = blocks.find((b) => b.text.startsWith('Sorting is done'))!;
    const rightBlock = blocks.find((b) => b.measure.left > 300 && !b.refusal)!;
    const a = await h.editor.analyzeParagraphLayout(leftBlock.ref);
    const b = await h.editor.analyzeParagraphLayout(rightBlock.ref);
    const rightColumnLeft = Math.min(
      ...blocks.filter((x) => x.measure.left > 300).map((x) => x.box.x),
    );
    expect(a.roomRight).toBeGreaterThan(0);
    expect(leftBlock.measure.right + (a.roomRight ?? 0)).toBeLessThanOrEqual(rightColumnLeft + 0.5);
    const leftColumnRight = Math.max(
      ...blocks.filter((x) => x.measure.left < 300).map((x) => x.box.x + x.box.width),
    );
    expect(rightBlock.measure.left - (b.roomLeft ?? 0)).toBeGreaterThanOrEqual(
      leftColumnRight - 0.5,
    );
    // Nothing to the left of the left column but the page edge.
    expect(a.roomLeft).toBeCloseTo(leftBlock.measure.left, 0);
    await h.adapter.close(id);
  });
});

describe('refusals', () => {
  test('text that is not along a multiple of 90 degrees moves but cannot be resized', async () => {
    const c = Math.cos(Math.PI / 6).toFixed(4);
    const s = Math.sin(Math.PI / 6).toFixed(4);
    const line = (y: number, text: string) =>
      `BT /F1 12 Tf ${c} ${s} -${s} ${c} 100 ${y} Tm (${text}) Tj ET`;
    const bytes = await rawPdf({
      size: [500, 500],
      content: [
        line(100, 'The harbour master walked along the quay'),
        `BT /F1 12 Tf ${c} ${s} -${s} ${c} ${100 - 12 * Number(s)} ${100 - 12 * Number(c)} Tm (and counted the boats that came in with) Tj ET`,
      ].join('\n'),
    });
    const id = await h.open(bytes);
    const [block] = await blocksOf(id);
    if (!block) throw new Error('no paragraph');
    const analysis = await h.editor.analyzeParagraphLayout(block.ref);
    expect(analysis.frameRefusal).toBe('resize-direction');
    const error = await rejection(
      h.editor.applyParagraphEdit(
        id,
        0,
        resizeOf(block, block.measure.left, block.measure.right - 40),
        {
          commit: false,
        },
      ),
    );
    expect(paragraphRefusalReason(error)).toBe('resize-direction');
    const moved = await h.editor.applyParagraphEdit(id, 0, moveOf(block, 10, 10), { commit: true });
    expect(moved.committed).toBe(true);
    expect(moved.verification.maxDrift).toBeLessThanOrEqual(0.01);
    await h.adapter.close(id);
  });

  test('a form widget over the words refuses a move and a resize', async () => {
    const base = await rawPdf({
      size: [400, 300],
      content: [
        'BT /F1 12 Tf 1 0 0 1 40 250 Tm (The harbour master walked along the quay) Tj ET',
        'BT /F1 12 Tf 1 0 0 1 40 235.6 Tm (and counted the boats that came in with) Tj ET',
      ].join('\n'),
    });
    const doc = await PDFDocument.load(base);
    const widget = doc.context.register(
      doc.context.obj({
        Type: 'Annot',
        Subtype: 'Widget',
        FT: 'Tx',
        T: PDFString.of('field'),
        Rect: [100, 230, 180, 262],
        F: 4,
      }),
    );
    doc.getPage(0).node.set(PDFName.of('Annots'), doc.context.obj([widget]));
    const id = await h.open(toBuffer(await doc.save()));
    const [block] = await blocksOf(id);
    if (!block) throw new Error('no paragraph');
    expect((await h.editor.analyzeParagraphLayout(block.ref)).frameRefusal).toBe('move-form-field');
    for (const edit of [
      moveOf(block, 10, 0),
      resizeOf(block, block.measure.left, block.measure.right - 30),
    ]) {
      const error = await rejection(h.editor.applyParagraphEdit(id, 0, edit, { commit: false }));
      expect(paragraphRefusalReason(error)).toBe('move-form-field');
    }
    await h.adapter.close(id);
  });

  test('a text object that also draws another paragraph refuses', () => {
    const model = {
      lineObjects: [[4], [5]],
      sharedObjects: new Set([5]),
      widgets: [],
      chars: [],
      u: { x: 1, y: 0 },
    } as unknown as ParagraphModel;
    expect(frameRefusalOf(model)).toBe('move-shared-object');
  });

  test('a paragraph paragraph mode already refuses stays refused', async () => {
    const bytes = await rawPdf({
      content: [
        'BT 3 Tr /F1 12 Tf 1 0 0 1 40 150 Tm (Recognised text that nobody) Tj ET',
        'BT 3 Tr /F1 12 Tf 1 0 0 1 40 135.6 Tm (can see on the page.) Tj ET',
      ].join('\n'),
    });
    const id = await h.open(bytes);
    const [block] = await blocksOf(id);
    if (!block) throw new Error('no paragraph');
    const error = await rejection(
      h.editor.applyParagraphEdit(id, 0, moveOf(block, 5, 5), { commit: false }),
    );
    expect(paragraphRefusalReason(error)).toBe('invisible');
    await h.adapter.close(id);
  });
});

describe('the edit log', () => {
  test('the frame is validated, and payloads without one read as before', () => {
    const good = {
      paragraph: { index: 1, runs: [{ objectPath: [3], charStart: 0, charCount: 1, text: 'T' }] },
      text: 'The',
      caretSpan: { start: 0, end: 0 },
    };
    expect(readParagraphEditPayload(good).frame).toBeUndefined();
    const frame = { dx: 4, dy: -2, measure: { left: 10, right: 200 } };
    expect(readParagraphEditPayload({ ...good, frame }).frame).toEqual(frame);
    expect(readParagraphEditPayload({ ...good, frame: { dx: 1, dy: 2 } }).frame).toEqual({
      dx: 1,
      dy: 2,
    });
    for (const bad of [
      { dx: 'a', dy: 0 },
      { dx: 0, dy: Number.NaN },
      { dx: 0, dy: 0, measure: { left: 5, right: 5 } },
      { dx: 0, dy: 0, measure: { left: 5 } },
      null,
    ]) {
      expect(() => readParagraphEditPayload({ ...good, frame: bad })).toThrow(
        /Invalid text.editParagraph payload/,
      );
    }
  });

  test('a move and a resize replay to the same bytes', async () => {
    const original = await fixture(latexUrl);
    const id = await h.open(original);
    const block = (await blocksOf(id)).find((b) => b.text.startsWith('The tidal gauge'))!;
    const width = block.measure.right - block.measure.left;
    const edits: EngineEdit[] = [
      {
        id: 'move-1',
        source: id,
        pageIndex: 0,
        kind: 'text.editParagraph',
        payload: paragraphEditPayloadOf(
          resizeOf(block, block.measure.left, block.measure.left + width * 0.6, 9, -7),
        ),
      },
    ];
    const applied = await applyEngineEditWithResult(target, edits[0]!);
    expect(applied.paragraphEdit?.committed).toBe(true);
    expect(readParagraphEditPayload(applied.applied.payload).frame?.dx).toBe(9);
    const session = await h.adapter.save(id);
    await h.adapter.close(id);

    const log = JSON.parse(JSON.stringify([applied.applied])) as EngineEdit[];
    const fresh = await h.open(original);
    const replayed = await replayEngineEdits(
      target,
      log.map((e) => ({ ...e, source: fresh })),
    );
    expect(replayed.failed).toEqual([]);
    expect(sameBytes(await h.adapter.save(fresh), session)).toBe(true);
    await h.adapter.close(fresh);
  });
});
