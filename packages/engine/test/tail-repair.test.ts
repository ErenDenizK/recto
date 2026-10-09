/**
 * A file that lost only its tail opens as repaired (V1-B5; docs/plan/v1/PLAN.md "W0-q
 * findings"): `structure/tail-repair.ts` rebuilds the cross-reference table and trailer the way
 * MuPDF's repair does, and the result shows the same pages, text and Info as the file before it
 * was cut. Damage it cannot repair without guessing is still refused.
 */
import brokenXrefUrl from '../../../test/fixtures/broken-xref.pdf?url';
import simpleTextUrl from '../../../test/fixtures/simple-text.pdf?url';
import truncatedUrl from '../../../test/fixtures/truncated.pdf?url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PdfiumAdapter } from '../src/pdfium/pdfium-adapter';
import { restoreLostTail } from '../src/structure/tail-repair';
import { checkXrefStructure } from '../src/structure/xref-check';
import { sid, wasmUrl } from './helpers';

const fetchBytes = async (url: string) => new Uint8Array(await (await fetch(url)).arrayBuffer());

let adapter: PdfiumAdapter;

beforeAll(() => {
  adapter = new PdfiumAdapter({ wasmUrl });
});
afterAll(async () => {
  await adapter.destroy();
});

/** Every page's text, joined per page. */
async function texts(id: string, pageCount: number): Promise<string[]> {
  const out: string[] = [];
  for (let page = 0; page < pageCount; page++) {
    const runs = await adapter.getPageText(sid(id), page);
    out.push(runs.map((run) => run.text).join(' '));
  }
  return out;
}

describe('restoreLostTail', () => {
  it('rebuilds the xref and trailer of truncated.pdf after its own bytes', async () => {
    const cut = await fetchBytes(truncatedUrl);
    const restored = restoreLostTail(cut);
    expect(restored).toBeDefined();
    const bytes = restored as Uint8Array;
    // The original bytes are kept as they are; only a new section follows them.
    expect(bytes.subarray(0, cut.length)).toEqual(cut);
    expect(checkXrefStructure(bytes)).toEqual({ repaired: false });
  });

  it('leaves files with a trailer to PDFium (sound files and other damage)', async () => {
    expect(restoreLostTail(await fetchBytes(simpleTextUrl))).toBeUndefined();
    expect(restoreLostTail(await fetchBytes(brokenXrefUrl))).toBeUndefined();
  });

  it('refuses a file cut inside its page tree instead of guessing', async () => {
    const whole = await fetchBytes(simpleTextUrl);
    // simple-text.pdf cut after 600 bytes: the catalog survives, the pages do not.
    expect(restoreLostTail(whole.subarray(0, 600))).toBeUndefined();
    // Cut inside the last page's content stream: that page is not whole.
    const text = new TextDecoder('latin1').decode(whole);
    const lastStream = text.lastIndexOf('>>\nstream\n') + 30;
    expect(restoreLostTail(whole.subarray(0, lastStream))).toBeUndefined();
  });

  it('refuses an encrypted file whose key was in the lost trailer', () => {
    const plain =
      '%PDF-1.7\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
      '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n' +
      '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 10 10] >>\nendobj\n';
    const encrypt = '4 0 obj\n<< /Filter /Standard /V 2 /R 3 /O <00> /U <00> /P -4 >>\nendobj\n';
    expect(restoreLostTail(new TextEncoder().encode(plain + encrypt))).toBeUndefined();
    expect(restoreLostTail(new TextEncoder().encode(plain))).toBeDefined();
  });
});

describe('opening a file that lost its tail', () => {
  it('opens truncated.pdf as repaired, with the pages, text and Info of the whole file', async () => {
    const whole = await adapter.open(sid('whole'), (await fetchBytes(simpleTextUrl)).buffer);
    const wholeText = await texts('whole', whole.pageCount);
    const opened = await adapter.open(sid('cut'), (await fetchBytes(truncatedUrl)).buffer);
    expect(opened.flags.repaired).toBe(true);
    expect(opened.pageCount).toBe(3);
    expect(opened.pages).toEqual(whole.pages);
    expect(await texts('cut', opened.pageCount)).toEqual(wholeText);
    expect(wholeText.join('').length).toBeGreaterThan(0);
    expect(opened.metadata.title).toBe(whole.metadata.title);
    expect(opened.metadata.title).toBe('Simple text fixture');
    const render = await adapter.renderPage(sid('cut'), 0, { scale: 0.5 });
    expect(render.bitmap.width).toBeGreaterThan(0);
    render.bitmap.close();
    await adapter.close(sid('cut'));
    await adapter.close(sid('whole'));
  });

  it('still refuses a file cut inside its objects', async () => {
    const whole = await fetchBytes(simpleTextUrl);
    await expect(adapter.open(sid('hard'), whole.slice(0, 600).buffer)).rejects.toMatchObject({
      name: 'EngineError',
    });
  });
});
