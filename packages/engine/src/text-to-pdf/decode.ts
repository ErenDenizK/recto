/**
 * Plain-text intake (conversion memo step 2, PRD-19): bytes to normalised text.
 *
 * UTF-8 first (a BOM is dropped, decoding never throws). A legacy Turkish file is not valid
 * UTF-8: when the UTF-8 decode produces U+FFFD and the bytes are valid windows-1254, that
 * reading wins. Line ends become LF and tabs four spaces; form feeds stay (page breaks).
 */

/** Bytes windows-1254 leaves undefined: a file holding one is not a windows-1254 text. */
const UNDEFINED_1254 = new Set([0x81, 0x8d, 0x8e, 0x8f, 0x90, 0x9d, 0x9e]);

/** Decodes a text file's bytes: UTF-8, else windows-1254 when the bytes are not UTF-8. */
export function decodeTextBytes(bytes: Uint8Array): string {
  const utf8 = new TextDecoder('utf-8', { fatal: false, ignoreBOM: true }).decode(bytes);
  const text = utf8.charCodeAt(0) === 0xfeff ? utf8.slice(1) : utf8;
  if (!text.includes('\uFFFD')) return text;
  if (bytes.some((byte) => UNDEFINED_1254.has(byte))) return text;
  try {
    return new TextDecoder('windows-1254', { fatal: false }).decode(bytes);
  } catch {
    return text;
  }
}

/** CRLF and CR become LF; tabs become four spaces. Form feeds are kept. */
export function normalizeText(text: string): string {
  return text.replace(/\r\n?/g, '\n').replace(/\t/g, '    ');
}
