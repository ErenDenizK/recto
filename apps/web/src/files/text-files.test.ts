/**
 * Which files convert as text (PRD-19): only `*.txt` by name, only when dropped or picked
 * themselves, and not over 2 MB.
 */
import { describe, expect, it } from 'vitest';

import type { DirectoryHandleLike, FileHandleLike } from './file-filters';
import { filesFromItems } from './open-files';
import { isTextFile, openTextFiles, pdfNameForText, TEXT_MAX_BYTES } from './text-files';

const file = (name: string, type = 'text/plain') => new File(['x'], name, { type });

describe('isTextFile', () => {
  it('takes .txt by name, in any case', () => {
    expect(isTextFile(file('notes.txt'))).toBe(true);
    expect(isTextFile(file('NOTES.TXT', ''))).toBe(true);
  });

  it('refuses other text types: a text/plain MIME alone is not enough', () => {
    for (const name of ['server.log', 'data.csv', 'readme.md', 'notes']) {
      expect(isTextFile(file(name)), name).toBe(false);
    }
  });

  it('refuses hidden files and PDFs', () => {
    expect(isTextFile(file('._notes.txt'))).toBe(false);
    expect(isTextFile(file('a.pdf', 'application/pdf'))).toBe(false);
  });

  it('names the document after the file', () => {
    expect(pdfNameForText('notes.txt')).toBe('notes.pdf');
    expect(pdfNameForText('NOTES.TXT')).toBe('NOTES.pdf');
  });
});

describe('text files in a drop', () => {
  const fileHandle = (f: File): FileHandleLike => ({
    kind: 'file',
    name: f.name,
    getFile: () => Promise.resolve(f),
  });
  const folder = (name: string, children: FileHandleLike[]): DirectoryHandleLike =>
    ({
      kind: 'directory',
      name,
      async *values() {
        await Promise.resolve();
        yield* children;
      },
    }) as unknown as DirectoryHandleLike;
  const item = (handle: FileHandleLike | DirectoryHandleLike) =>
    ({
      kind: 'file',
      getAsFileSystemHandle: () => Promise.resolve(handle),
      webkitGetAsEntry: () => null,
      getAsFile: () => null,
    }) as unknown as DataTransferItem;

  it('converts a dropped .txt but not the ones inside a dropped folder', async () => {
    const direct = file('direct.txt');
    const inner = file('inner.txt');
    const pdf = new File(['%PDF-1.7'], 'inner.pdf', { type: 'application/pdf' });
    const accept = (f: { name: string }) => f.name.endsWith('.pdf');
    const files = await filesFromItems(
      [item(fileHandle(direct)), item(folder('notes', [fileHandle(inner), fileHandle(pdf)]))],
      [],
      accept,
      isTextFile,
    );
    expect(files.map((f) => f.name)).toEqual(['direct.txt', 'inner.pdf']);
  });
});

describe('openTextFiles', () => {
  it('refuses a file over 2 MB and opens nothing', async () => {
    const big = new File([new Uint8Array(TEXT_MAX_BYTES + 1)], 'big.txt', { type: 'text/plain' });
    expect(await openTextFiles([big])).toEqual([]);
  });
});
