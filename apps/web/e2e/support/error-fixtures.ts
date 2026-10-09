/**
 * Error-state fixtures (V1-B5, PLAN §2.6): one file per failure the person can meet when opening
 * a PDF. They are built here, from the corpus, at test time, so the committed corpus and its
 * manifest (`tools/fixtures`, `generate --check`) stay as the generator wrote them.
 *
 * - `corruptPdf`: a PDF header over bytes no repair can read.
 * - `truncatedPdf`: `simple-text.pdf` cut inside its first objects (the corpus's own
 *   `truncated.pdf` loses only its tail and is repaired on open, which is a separate case).
 * - `notAPdf`: plain text under a `.pdf` name. `emptyPdf`: zero bytes.
 * - Password and XFA use the corpus's `encrypted-aes-256.pdf` and `xfa-stub.pdf` as they are.
 * - Over the web size ceiling (V1-P13): not built; the ceiling is not in the app yet.
 */
import { readFileSync } from 'node:fs';

import { fixturePath } from '../helpers';

export interface ErrorFixture {
  readonly name: string;
  readonly mimeType: string;
  readonly buffer: Buffer;
}

const pdf = (name: string, buffer: Buffer): ErrorFixture => ({
  name,
  mimeType: 'application/pdf',
  buffer,
});

export function corruptPdf(): ErrorFixture {
  const junk = Buffer.alloc(2048);
  // A fixed pattern, not random: the same bytes on every run.
  for (let i = 0; i < junk.length; i++) junk[i] = (i * 131 + 17) & 0xff;
  return pdf('corrupt.pdf', Buffer.concat([Buffer.from('%PDF-1.7\n'), junk]));
}

export function truncatedPdf(): ErrorFixture {
  const whole = readFileSync(fixturePath('simple-text.pdf'));
  return pdf('truncated-hard.pdf', whole.subarray(0, 600));
}

export function notAPdf(): ErrorFixture {
  return pdf('notes.pdf', Buffer.from('These are plain notes, not a PDF.\n'));
}

export function emptyPdf(): ErrorFixture {
  return pdf('empty.pdf', Buffer.alloc(0));
}
