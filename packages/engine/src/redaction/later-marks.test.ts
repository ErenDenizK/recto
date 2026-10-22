/**
 * A mark drawn over a redaction after it was applied (RED-1): an ink stroke across the
 * black box is the user's new content, not redacted content, so the export's self-check
 * passes when the plan names it in `laterMarks`, while every other check (text, strings,
 * bytes, pixels of the box itself) still runs on the area.
 */

import wasmUrl from '@embedpdf/pdfium/pdfium.wasm?url';
import type { SourceId } from '@pdf-editor/document-model';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import textRunsUrl from '../../../../test/fixtures/redact-text-runs.pdf?url';
import { createHostedEngine, type HostedEngine } from '../pdfium/host';
import { PdfiumAdapter } from '../pdfium/pdfium-adapter';
import type { ApplyRedactionsResult, ForensicReport, RedactionPlan } from '../types';
import { applyRedactions } from './apply';
import { withForensicDeps } from './engine-session';
import { verifyRedactedOutput } from './verify-output';

const AREA = { x: 163.61, y: 675.7, width: 94.58, height: 17.85 };
const PLAN: RedactionPlan = {
  areas: [
    { pageIndex: 0, rect: AREA },
    { pageIndex: 0, rect: { ...AREA, x: 165.93, y: 635.7 } },
    { pageIndex: 0, rect: { ...AREA, x: 168.27, y: 595.7 } },
  ],
  strings: [],
};

let host: HostedEngine;
let adapter: PdfiumAdapter;
let applied: ApplyRedactionsResult;
let counter = 0;

beforeAll(async () => {
  host = await createHostedEngine({ wasm: wasmUrl });
  adapter = new PdfiumAdapter({
    wasmUrl,
    engineFactory: () => host.engine,
    rawTask: (sourceId, fn, options) => host.withRawTask(sourceId, fn, options),
  });
  const original = await (await fetch(textRunsUrl)).arrayBuffer();
  applied = await applyRedactions(host, original, PLAN);
});
afterAll(async () => {
  await adapter.destroy();
});

/** The redacted file with one red ink stroke drawn straight across the box; its /NM. */
async function withStrokeAcross(): Promise<{ bytes: ArrayBuffer; nm: string }> {
  const id = `later-mark-${++counter}` as SourceId;
  await adapter.open(id, applied.bytes.slice(0));
  const y = AREA.y + AREA.height / 2;
  const created = await adapter.createAnnotation(id, {
    kind: 'ink',
    pageIndex: 0,
    rect: { x: 0, y: 0, width: 0, height: 0 },
    paths: [
      [
        { x: AREA.x - 20, y },
        { x: AREA.x + AREA.width + 20, y },
      ],
    ],
    strokeWidth: 3,
    color: '#E53935',
  });
  const bytes = await adapter.save(id);
  await adapter.close(id);
  return { bytes, nm: created.id };
}

function verify(bytes: ArrayBuffer, plans: readonly RedactionPlan[]): Promise<ForensicReport> {
  return withForensicDeps(host, bytes, (deps) => verifyRedactedOutput(bytes, plans, deps));
}

const failing = (report: ForensicReport) => report.checks.filter((c) => !c.passed).map((c) => c.id);

describe('a mark drawn over an applied redaction', () => {
  test('without being named, the stroke fails the annotation and pixel checks', async () => {
    const { bytes } = await withStrokeAcross();
    const report = await verify(bytes, [applied.plan]);
    expect(failing(report)).toEqual(['no-annotations-in-areas', 'fill-pixels']);
  });

  test('named as a later mark, it passes every check', async () => {
    const { bytes, nm } = await withStrokeAcross();
    const report = await verify(bytes, [{ ...applied.plan, laterMarks: [nm] }]);
    expect(failing(report)).toEqual([]);
  });

  test('a later mark excuses only itself: the box under it must still be filled', async () => {
    // The original bytes still show the text: naming the stroke does not hide it.
    const original = await (await fetch(textRunsUrl)).arrayBuffer();
    const id = `later-mark-${++counter}` as SourceId;
    await adapter.open(id, original.slice(0));
    const created = await adapter.createAnnotation(id, {
      kind: 'ink',
      pageIndex: 0,
      rect: { x: 0, y: 0, width: 0, height: 0 },
      paths: [
        [
          { x: AREA.x, y: AREA.y + 2 },
          { x: AREA.x + AREA.width, y: AREA.y + 2 },
        ],
      ],
      strokeWidth: 1,
      color: '#E53935',
    });
    const bytes = await adapter.save(id);
    await adapter.close(id);
    const report = await verify(bytes, [{ ...applied.plan, laterMarks: [created.id] }]);
    expect(failing(report)).toEqual(
      expect.arrayContaining(['no-text-in-areas', 'byte-grep', 'fill-pixels']),
    );
    expect(failing(report)).not.toContain('no-annotations-in-areas');
  });

  test('an annotation not named in the area still fails', async () => {
    const { bytes } = await withStrokeAcross();
    const report = await verify(bytes, [{ ...applied.plan, laterMarks: ['someone-else'] }]);
    expect(failing(report)).toContain('no-annotations-in-areas');
  });
});
